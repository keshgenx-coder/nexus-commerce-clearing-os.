import { describe, it, expect } from 'vitest';
import {
  calculateLandedCost,
  calculateLandedMarginFloorPrice,
  createShardedInventoryPool,
  getPoolTotalAvailable,
  getNextStripedSaltHint,
  acquireShardedLotLease,
  releaseShardedLotLease,
  executeFundsFirstOutboxSaga,
  reconcileOutboxReaper,
  replicateShardQuorumWal,
  sweepDeadLetterReconciliation,
  computeAuditVelocityMetrics,
  decayEmaTrackerWithTime,
  isCanaryProbeEligible,
  updateEmaRetryCost,
  evaluateEdgeAdmission,
  deterministicDigestHex,
  buildMerkleRoot,
  EmaCostTracker,
  EdgeAdmissionController,
  TransactionalOutboxRecord
} from '../src/utils/commerceLogic';

describe('Sharded Outbox & Funds-First SAGA Suite (v4.4.0-Enterprise)', () => {
  describe('1. Bounded 32-Shard Escrow Sub-Lots (Zero Cross-AZ Consensus)', () => {
    it('partitions SKU inventory cleanly into K=32 sub-lots preserving exact total units', () => {
      const pool = createShardedInventoryPool('SKU-ANC-PRO-09', 12000, 32);
      expect(pool.shardCount).toBe(32);
      expect(pool.shards).toHaveLength(32);
      expect(getPoolTotalAvailable(pool)).toBe(12000);
      expect(pool.shards.every((s) => s.availableUnits >= 375 && s.availableUnits <= 376)).toBe(true);
    });

    it('enforces strict units >= 0 invariant and performs bounded single-hop CAS rebalancing when a hot shard depletes', () => {
      const pool = createShardedInventoryPool('SKU-ANC-PRO-09', 3200, 32); // 100 units per shard

      // Request 250 units targeting shard 3 -> triggers single-hop rebalance from sibling shard
      const lease1 = acquireShardedLotLease(pool, 250, 3);
      expect(lease1.acquired).toBe(true);
      expect(lease1.shardIndex).toBe(3);
      expect(lease1.rebalancedFromShard).toBeDefined();
      expect(pool.shards.every((s) => s.availableUnits >= 0)).toBe(true);
      expect(getPoolTotalAvailable(pool)).toBe(2950);

      // Request more than remaining pool total -> fails safely with zero negative inventory
      const exhausted = acquireShardedLotLease(pool, 4000, 3);
      expect(exhausted.acquired).toBe(false);
      expect(pool.shards.every((s) => s.availableUnits >= 0)).toBe(true);

      // Releasing lease restores units to the shard atomically
      const released = releaseShardedLotLease(pool, 3, 250);
      expect(released.remainingPoolTotalAvailable).toBe(3200);
      expect(pool.shards[3].reservedUnits).toBe(0);
    });
  });

  describe('2. Funds-First Transactional Outbox SAGA & Lease-Expiration Reaper', () => {
    it('executes Stripe Escrow Hold strictly BEFORE FedEx WMS Pick Dispatch on happy path', () => {
      const pool = createShardedInventoryPool('SKU-ANC-PRO-09', 6400, 32);
      const lease = acquireShardedLotLease(pool, 150, 5);
      expect(lease.acquired).toBe(true);

      const result = executeFundsFirstOutboxSaga({
        sagaId: 'SAGA-FF-1001',
        pool,
        shardIndex: lease.shardIndex,
        units: 150,
        fencingToken: lease.fencingToken!
      });

      expect(result.finalState).toBe('SETTLED');
      expect(result.compensated).toBe(false);
      expect(result.escrowStatus).toBe('FUNDS_GUARANTEED_LOCKED');
      expect(result.wmsStatus).toBe('DISPATCHED');
      expect(result.outboxRecord.externalIdempotencyKey).toBe(`SAGA-FF-1001:${lease.fencingToken}`);

      const escrowIdx = result.steps.findIndex((s) => s.step === 'STRIPE_ESCROW_FUNDS_FIRST_HOLD');
      const wmsIdx = result.steps.findIndex((s) => s.step === 'FEDEX_WMS_PICK_DISPATCH');
      expect(escrowIdx).toBeGreaterThan(-1);
      expect(wmsIdx).toBeGreaterThan(escrowIdx);
    });

    it('never invokes FedEx WMS when Funds-First Stripe Escrow declines (0 physical orphans)', () => {
      const pool = createShardedInventoryPool('SKU-ANC-PRO-09', 6400, 32);
      const lease = acquireShardedLotLease(pool, 120, 2);
      expect(lease.acquired).toBe(true);

      const result = executeFundsFirstOutboxSaga({
        sagaId: 'SAGA-FF-ESCROW-FAIL',
        pool,
        shardIndex: lease.shardIndex,
        units: 120,
        fencingToken: lease.fencingToken!,
        simulateEscrowFailure: true
      });

      expect(result.finalState).toBe('COMPENSATED_ROLLED_BACK');
      expect(result.compensated).toBe(true);
      expect(result.escrowStatus).toBe('ESCROW_FAILED_NEVER_DISPATCHED_WMS');
      expect(result.wmsStatus).toBe('NEVER_INVOKED_SAFE');
      expect(result.steps.some((s) => s.step === 'FEDEX_WMS_PICK_DISPATCH')).toBe(false);
      expect(getPoolTotalAvailable(pool)).toBe(6400);
    });

    it('software-voids Stripe Escrow and restores sub-lot units if FedEx WMS fails post-escrow', () => {
      const pool = createShardedInventoryPool('SKU-ANC-PRO-09', 6400, 32);
      const lease = acquireShardedLotLease(pool, 100, 4);

      const result = executeFundsFirstOutboxSaga({
        sagaId: 'SAGA-FF-WMS-FAIL',
        pool,
        shardIndex: lease.shardIndex,
        units: 100,
        fencingToken: lease.fencingToken!,
        simulateWmsFailure: true
      });

      expect(result.finalState).toBe('COMPENSATED_ROLLED_BACK');
      expect(result.escrowStatus).toBe('ESCROW_HOLD_VOIDED');
      expect(result.wmsStatus).toBe('NOT_DISPATCHED');
      expect(result.steps.some((s) => s.step === 'STRIPE_ESCROW_HOLD_VOIDED' && s.status === 'COMPENSATED')).toBe(true);
      expect(getPoolTotalAvailable(pool)).toBe(6400);
    });

    it('recovers IN_FLIGHT_CRASHED worker state deterministically via Lease-Expiration Reaper', () => {
      const pool = createShardedInventoryPool('SKU-ANC-PRO-09', 6400, 32);
      const lease = acquireShardedLotLease(pool, 80, 1);

      const crashed = executeFundsFirstOutboxSaga({
        sagaId: 'SAGA-FF-CRASH',
        pool,
        shardIndex: lease.shardIndex,
        units: 80,
        fencingToken: lease.fencingToken!,
        simulateWorkerCrashBeforeWms: true
      });

      expect(crashed.finalState).toBe('IN_FLIGHT_CRASHED');
      expect(crashed.outboxRecord.status).toBe('IN_FLIGHT_CRASHED');
      expect(crashed.escrowStatus).toBe('FUNDS_GUARANTEED_LOCKED');

      const outboxQueue: TransactionalOutboxRecord[] = [crashed.outboxRecord];
      const recovery = reconcileOutboxReaper(outboxQueue);

      expect(recovery.recoveredCount).toBe(1);
      expect(recovery.recoveredIds).toEqual([crashed.outboxRecord.outboxId]);
      expect(outboxQueue[0].status).toBe('SETTLED');
      expect(outboxQueue[0].wmsDispatchRef).toContain('FDX-REAPER-');
    });
  });

  describe('3. Dynamic EMA Retry Costing & Edge Token-Bucket Load Shedding', () => {
    it('inflates effective egress overhead dynamically on 3P retries and decays back under healthy runs', () => {
      const tracker: EmaCostTracker = {
        baseEgressCost: 0.0032,
        emaRetryRate: 0,
        alpha: 0.25,
        effectiveEgressCost: 0.0032
      };

      updateEmaRetryCost(tracker, true);
      expect(tracker.emaRetryRate).toBe(0.25);
      expect(tracker.effectiveEgressCost).toBeCloseTo(0.004, 5);

      updateEmaRetryCost(tracker, false);
      expect(tracker.emaRetryRate).toBe(0.1875);
      expect(tracker.effectiveEgressCost).toBeLessThan(0.004);
    });

    it('sheds low-margin burst traffic via HTTP 429 semantics while admitting high-margin priority orders', () => {
      const controller: EdgeAdmissionController = {
        maxTxPerSec: 280,
        minPriorityMarginPct: 22.0,
        windowStartMs: 100000,
        windowCount: 280,
        shedCount: 0
      };

      // Low-margin overflow bid is shed cleanly
      const shedDecision = evaluateEdgeAdmission(controller, 17.5, 100200, false);
      expect(shedDecision.admitted).toBe(false);
      expect(shedDecision.action).toBe('EDGE_SHED_DEFERRED_BATCH');
      expect(controller.shedCount).toBe(1);

      // High-margin priority bid still admitted even at burst ceiling
      const priorityDecision = evaluateEdgeAdmission(controller, 28.0, 100200, false);
      expect(priorityDecision.admitted).toBe(true);
      expect(priorityDecision.action).toBe('ADMITTED_PLANE_A');
    });
  });

  describe('4. Partitioned WAL & Merkle Epoch Anchoring', () => {
    it('computes deterministic Merkle roots and handles 1,000-leaf rollback storms rapidly', () => {
      const leaves = Array.from({ length: 1000 }, (_, idx) =>
        deterministicDigestHex(`ROLLBACK_LEAF_${idx}_SKU-ANC-PRO-09`)
      );

      const t0 = performance.now();
      const root1 = buildMerkleRoot(leaves);
      const elapsedMs = performance.now() - t0;
      const root2 = buildMerkleRoot(leaves);

      expect(root1.startsWith('0x')).toBe(true);
      expect(root1).toBe(root2);
      expect(elapsedMs).toBeLessThan(150);

      // Single leaf mutation changes Merkle root deterministically
      const mutated = [...leaves];
      mutated[500] = deterministicDigestHex('TAMPERED_LEAF');
      expect(buildMerkleRoot(mutated)).not.toBe(root1);
    });
  });

  describe('5. v4.4.1-Hardened Remediation (Void CM3, Asym EMA, DLQ Reaper, Striped Salting)', () => {
    it('factors expected Void Hold compensation cost into C_landed and P_min (Claim C2)', () => {
      const baseLanded = calculateLandedCost({
        baseCogs: 168.00,
        freightCost: 8.50,
        paymentFeePct: 2.9,
        rtoProbability: 0.03,
        reverseLogisticsCost: 22.00,
        computeEgressCost: 0.0032,
        assumedSellingPrice: 239.00
      });

      const voidCostedLanded = calculateLandedCost({
        baseCogs: 168.00,
        freightCost: 8.50,
        paymentFeePct: 2.9,
        rtoProbability: 0.03,
        reverseLogisticsCost: 22.00,
        computeEgressCost: 0.0032,
        expectedVoidCompCost: 0.05,
        assumedSellingPrice: 239.00
      });

      expect(voidCostedLanded.expectedVoidCompCost).toBe(0.05);
      expect(voidCostedLanded.totalLandedCogs).toBeGreaterThan(baseLanded.totalLandedCogs);

      const basePmin = calculateLandedMarginFloorPrice(
        { baseCogs: 168.00, freightCost: 8.50, paymentFeePct: 2.9, rtoProbability: 0.03, reverseLogisticsCost: 22.00 },
        18.5
      );
      const voidPmin = calculateLandedMarginFloorPrice(
        { baseCogs: 168.00, freightCost: 8.50, paymentFeePct: 2.9, rtoProbability: 0.03, reverseLogisticsCost: 22.00, expectedVoidCompCost: 0.05 },
        18.5
      );
      expect(voidPmin).toBeGreaterThan(basePmin);
    });

    it('uses Asymmetric Fast-Attack (0.65) / Slow-Decay (0.20) EMA and prices Void Hold penalty ($0.05)', () => {
      const asymTracker: EmaCostTracker = {
        baseEgressCost: 0.0032,
        alpha: 0.25,
        alphaAttack: 0.65,
        alphaDecay: 0.20,
        emaRetryRate: 0,
        compCostPenalty: 0.05,
        emaCompensationRate: 0,
        expectedVoidCompCost: 0,
        effectiveEgressCost: 0.0032
      };

      // Burst of 1 WMS post-escrow void spikes EMA aggressively via alphaAttack = 0.65
      updateEmaRetryCost(asymTracker, true, true);
      expect(asymTracker.emaRetryRate).toBe(0.65);
      expect(asymTracker.emaCompensationRate).toBe(0.65);
      expect(asymTracker.expectedVoidCompCost).toBeCloseTo(0.0325, 5);
      expect(asymTracker.effectiveEgressCost).toBeCloseTo(0.00528, 5);

      // Healthy settlement decays gradually via alphaDecay = 0.20 (0.65 * 0.8 = 0.52)
      updateEmaRetryCost(asymTracker, false, false);
      expect(asymTracker.emaRetryRate).toBe(0.52);
      expect(asymTracker.emaCompensationRate).toBe(0.52);
      expect(asymTracker.expectedVoidCompCost).toBeCloseTo(0.026, 5);
    });

    it('enforces exponential backoff and transitions to DEAD_LETTER_RECONCILIATION after maxRetries=3', () => {
      const pool = createShardedInventoryPool('SKU-ANC-PRO-09', 6400, 32);
      const lease = acquireShardedLotLease(pool, 100, 9);
      const crashed = executeFundsFirstOutboxSaga({
        sagaId: 'SAGA-DLQ-01',
        pool,
        shardIndex: lease.shardIndex,
        units: 100,
        fencingToken: lease.fencingToken!,
        simulateWorkerCrashBeforeWms: true
      });

      const queue = [crashed.outboxRecord];

      // Attempt 1 under persistent brownout at t=1000 -> retry 1 deferred by 1000ms (nextRetryAtMs=2000)
      const r1 = reconcileOutboxReaper(queue, { simulatePersistentFailure: true, nowMs: 1000, baseBackoffMs: 1000, maxRetries: 3 });
      expect(r1.deferredBackoffIds).toEqual([crashed.outboxRecord.outboxId]);
      expect(r1.deadLetterIds).toEqual([]);
      expect(queue[0].retries).toBe(1);
      expect(queue[0].nextRetryAtMs).toBe(2000);

      // Calling too early at t=1500 is skipped without incrementing retries (no retry storm)
      const rTooEarly = reconcileOutboxReaper(queue, { simulatePersistentFailure: true, nowMs: 1500, baseBackoffMs: 1000, maxRetries: 3 });
      expect(rTooEarly.deferredBackoffIds).toEqual([crashed.outboxRecord.outboxId]);
      expect(queue[0].retries).toBe(1);

      // Attempt 2 at t=2500 -> retry 2 deferred by 2000ms (nextRetryAtMs=4500)
      const r2 = reconcileOutboxReaper(queue, { simulatePersistentFailure: true, nowMs: 2500, baseBackoffMs: 1000, maxRetries: 3 });
      expect(queue[0].retries).toBe(2);
      expect(queue[0].nextRetryAtMs).toBe(4500);

      // Attempt 3 at t=5000 hits maxRetries=3 -> trips DEAD_LETTER_RECONCILIATION circuit breaker
      const r3 = reconcileOutboxReaper(queue, { simulatePersistentFailure: true, nowMs: 5000, baseBackoffMs: 1000, maxRetries: 3 });
      expect(r3.deadLetterIds).toEqual([crashed.outboxRecord.outboxId]);
      expect(queue[0].status).toBe('DEAD_LETTER_RECONCILIATION');
      expect(queue[0].compensationVoided).toBe(true);
    });

    it('distributes viral single-SKU flash drop uniformly across all K=32 shards via striped salting', () => {
      const pool = createShardedInventoryPool('SKU-VIRAL-DROP-01', 3200, 32); // 100 per shard
      const touchedShards = new Set<number>();

      for (let seq = 0; seq < 64; seq++) {
        const hint = getNextStripedSaltHint(seq, 32);
        const lease = acquireShardedLotLease(pool, 10, hint);
        expect(lease.acquired).toBe(true);
        touchedShards.add(lease.shardIndex);
      }

      // All 32 shards served 2x each -> zero single-shard hotspotting
      expect(touchedShards.size).toBe(32);
      expect(pool.shards.every((s) => s.availableUnits === 80)).toBe(true);
    });
  });

  describe('6. v4.5.0-Resilient Red-Team Gap Closures ([G1], [G2], [G3])', () => {
    it('[G1] replicates per-shard WAL across 3-AZ same-region metro Raft with RPO=0 and automated AZ leader failover', () => {
      const nominal = replicateShardQuorumWal({
        shardId: 'SKU-ANC-PRO-09#shard-00',
        shardIndex: 0,
        fencingToken: 8001,
        simulatePrimaryAzOutage: false
      });
      expect(nominal.quorumAchieved).toBe(true);
      expect(nominal.rpoUnits).toBe(0);
      expect(nominal.replicationTopology).toBe('PER_SHARD_3AZ_METRO_RAFT');
      expect(nominal.failoverTriggered).toBe(false);
      expect(nominal.leaderAz).toBe('us-west-1a');
      expect(nominal.syncedFollowerAzs).toHaveLength(2);
      expect(nominal.metroCrossAzRttMs).toBeLessThanOrEqual(3.0);

      const failover = replicateShardQuorumWal({
        shardId: 'SKU-ANC-PRO-09#shard-00',
        shardIndex: 0,
        fencingToken: 8002,
        simulatePrimaryAzOutage: true
      });
      expect(failover.quorumAchieved).toBe(true);
      expect(failover.rpoUnits).toBe(0);
      expect(failover.failoverTriggered).toBe(true);
      expect(failover.leaderAz).toBe('us-west-1b');
      expect(failover.syncedFollowerAzs).toEqual(['us-west-1b', 'us-west-1c']);
    });

    it('[G2] autonomously reconciles DLQ entries via Stripe+FedEx ground truth and proves <0.1 FTE Audit Velocity at 280 tx/s', () => {
      const dlqQueue: TransactionalOutboxRecord[] = [
        {
          outboxId: 'obx_auto_void',
          sagaId: 'SAGA-G2-1',
          shardId: 'SKU#shard-01',
          shardIndex: 1,
          units: 50,
          fencingToken: 901,
          externalIdempotencyKey: 'SAGA-G2-1:901',
          status: 'DEAD_LETTER_RECONCILIATION',
          escrowHoldId: 'esc_ff_901',
          retries: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          providerTruth: { stripeStatus: 'VOIDED', fedexStatus: 'NOT_FOUND' }
        },
        {
          outboxId: 'obx_auto_settled',
          sagaId: 'SAGA-G2-2',
          shardId: 'SKU#shard-02',
          shardIndex: 2,
          units: 50,
          fencingToken: 902,
          externalIdempotencyKey: 'SAGA-G2-2:902',
          status: 'DEAD_LETTER_RECONCILIATION',
          escrowHoldId: 'esc_ff_902',
          retries: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          providerTruth: { stripeStatus: 'CAPTURED', fedexStatus: 'DISPATCHED' }
        },
        {
          outboxId: 'obx_byzantine',
          sagaId: 'SAGA-G2-3',
          shardId: 'SKU#shard-03',
          shardIndex: 3,
          units: 50,
          fencingToken: 903,
          externalIdempotencyKey: 'SAGA-G2-3:903',
          status: 'DEAD_LETTER_RECONCILIATION',
          escrowHoldId: 'esc_ff_903',
          retries: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          providerTruth: { stripeStatus: 'VOIDED', fedexStatus: 'DISPATCHED' }
        }
      ];

      const sweep = sweepDeadLetterReconciliation(dlqQueue);
      expect(sweep.sweptTotal).toBe(3);
      expect(sweep.autoReconciledVoidedIds).toEqual(['obx_auto_void']);
      expect(sweep.autoPromotedSettledIds).toEqual(['obx_auto_settled']);
      expect(sweep.byzantineEscalatedIds).toEqual(['obx_byzantine']);
      expect(sweep.zeroHumanOpexCount).toBe(2);
      expect(dlqQueue[0].status).toBe('AUTO_RECONCILED_VOIDED');
      expect(dlqQueue[1].status).toBe('AUTO_PROMOTED_SETTLED');
      expect(dlqQueue[2].status).toBe('BYZANTINE_INCIDENT_ESCALATED');

      // Audit velocity at 280 tx/s (24,192,000 tx/day), 1% DLQ, 99.9% auto-reconciled -> 0.042 FTEs (vs ~4,000 FTEs manual)
      const velocity = computeAuditVelocityMetrics({
        totalTxPerSec: 280,
        dlqRate: 0.01,
        byzantineFractionOfDlq: 0.001,
        rootCauseBatchSize: 12,
        auditorCapacityBatchesPerDay: 480
      });
      expect(velocity.autoReconciledPct).toBe(99.9);
      expect(velocity.requiredFtes).toBeLessThan(0.1);
      expect(velocity.requiredFtes).toBeCloseTo(0.042, 3);
      expect(velocity.humanOpexPerTxUsd).toBeLessThan(0.0001);
    });

    it('[G3] applies continuous wall-clock half-life EMA decay during idle silence, enforces $0.05 cap, and gates Canary Probes', () => {
      const tracker: EmaCostTracker = {
        baseEgressCost: 0.0032,
        alpha: 0.25,
        alphaAttack: 0.65,
        alphaDecay: 0.20,
        emaRetryRate: 0.80,
        compCostPenalty: 0.05,
        maxVoidCompPenalty: 0.05,
        emaCompensationRate: 0.80,
        expectedVoidCompCost: 0.04,
        lastUpdatedAtMs: 100000,
        halfLifeMs: 30000,
        canaryProbeIntervalMs: 5000,
        effectiveEgressCost: 0.00576
      };

      // After 30s (1 half-life) of zero clearing traffic, failure & void EMAs halve cleanly
      decayEmaTrackerWithTime(tracker, 130000);
      expect(tracker.emaRetryRate).toBeCloseTo(0.40, 3);
      expect(tracker.emaCompensationRate).toBeCloseTo(0.40, 3);
      expect(tracker.expectedVoidCompCost).toBeCloseTo(0.02, 4);

      // Canary Probe is eligible once when emaCompensationRate >= 0.25 and throttled until interval passes
      expect(isCanaryProbeEligible(tracker, 130000)).toBe(true);
      expect(isCanaryProbeEligible(tracker, 131000)).toBe(false);
      expect(isCanaryProbeEligible(tracker, 136000)).toBe(true);

      // After another 30s (total 60s = 2 half-lives), EMAs halve again
      decayEmaTrackerWithTime(tracker, 160000);
      expect(tracker.emaRetryRate).toBeCloseTo(0.20, 3);
      expect(tracker.emaCompensationRate).toBeCloseTo(0.20, 3);
      expect(tracker.expectedVoidCompCost).toBeLessThanOrEqual(0.05);
    });
  });
});

