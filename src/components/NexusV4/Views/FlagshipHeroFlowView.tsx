import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  RotateCcw, 
  ShieldCheck, 
  Zap, 
  Terminal, 
  CheckCircle2, 
  Lock, 
  Layers, 
  Database, 
  Cpu, 
  TrendingUp, 
  AlertTriangle, 
  ExternalLink, 
  Copy, 
  Check, 
  ArrowRight, 
  Share2, 
  FileCode2, 
  Sparkles, 
  Eye, 
  Clock, 
  Workflow,
  Truck,
  PackageCheck,
  Coins,
  Compass,
  Radio,
  GitCommit,
  Download,
  FileText,
  Printer,
  LogIn,
  Gauge,
  RefreshCw
} from 'lucide-react';
import { audioVibe } from '../../../utils/audioVibe';
import { useCurrency } from '../../../context/CurrencyContext';
import { useAuth } from '../../../context/AuthContext';

type HeroFlowType = 'margin_floor_clearance' | 'supply_demand_reconciliation' | 'order_orchestration';
export type ViewTab = 'flagship_demo' | 'lifecycle_workflow' | 'agentforce_spec' | 'security_baseline' | 'technical_dossier' | 'live_connectors';

export interface FlagshipHeroFlowViewProps {
  controlledTab?: ViewTab;
  onTabChange?: (tab: ViewTab) => void;
}

interface StepProgress {
  stage: number;
  label: string;
  subtext: string;
  latencyMs: number;
  status: 'pending' | 'active' | 'completed';
  auditHash?: string;
  details: string;
}

export const FlagshipHeroFlowView: React.FC<FlagshipHeroFlowViewProps> = ({
  controlledTab,
  onTabChange,
}) => {
  const { formatPrice } = useCurrency();
  const { user, idToken, loading: authLoading, authError, signInWithGoogle, getFreshToken } = useAuth();
  const [activeFlow, setActiveFlow] = useState<HeroFlowType>('margin_floor_clearance');
  const [activeTab, setActiveTab] = useState<ViewTab>(controlledTab || 'flagship_demo');
  const [selectedLifecyclePoint, setSelectedLifecyclePoint] = useState<'start' | 'execution' | 'delivery' | 'end'>('start');

  const currentTab: ViewTab = controlledTab ?? activeTab;

  const selectTab = (tab: ViewTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
    audioVibe.playClick();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);
  const [currentStage, setCurrentStage] = useState(0); // 0 = idle, 1..4 = steps, 5 = completed
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Live Agentforce Action Execution State (Cloud SQL PostgreSQL ACID + CM3 Guardrails + Simulated 3P Outbox)
  const [liveSku, setLiveSku] = useState('SKU-ANC-PRO-09');
  const [liveExcessUnits, setLiveExcessUnits] = useState(1200);
  const [liveMarginFloorPct, setLiveMarginFloorPct] = useState(18.5);
  const [liveCogs, setLiveCogs] = useState(168.00);
  const [liveCompetitorPrice, setLiveCompetitorPrice] = useState(215.00);
  const [liveFreightCost, setLiveFreightCost] = useState(8.50);
  const [livePaymentFeePct, setLivePaymentFeePct] = useState(2.9);
  const [liveRtoProb, setLiveRtoProb] = useState(0.03);
  const [liveInventoryAgeDays, setLiveInventoryAgeDays] = useState(14);
  const [liveFallbackMode, setLiveFallbackMode] = useState<'HARD_HALT' | 'TIME_DECAY_FLOOR' | 'HUMAN_APPROVAL_QUEUE'>('HARD_HALT');
  const [liveShardHint, setLiveShardHint] = useState('auto');
  const [liveIdempotencyKey, setLiveIdempotencyKey] = useState('');
  const [liveForceCircuitBreaker, setLiveForceCircuitBreaker] = useState(false);
  const [liveSimulateEscrowFail, setLiveSimulateEscrowFail] = useState(false);
  const [liveSimulateWmsFail, setLiveSimulateWmsFail] = useState(false);
  const [liveSimulateCrashBeforeWms, setLiveSimulateCrashBeforeWms] = useState(false);
  const [liveSimulateBurstOverflow, setLiveSimulateBurstOverflow] = useState(false);
  const [isExecutingLiveCall, setIsExecutingLiveCall] = useState(false);
  const [isReapingOutbox, setIsReapingOutbox] = useState(false);
  const [isSweepingDlq, setIsSweepingDlq] = useState(false);
  const [isDecayingEma, setIsDecayingEma] = useState(false);
  const [isReplenishingLots, setIsReplenishingLots] = useState(false);
  const [liveExecutionResult, setLiveExecutionResult] = useState<any>(null);
  const [reaperResult, setReaperResult] = useState<any>(null);
  const [dlqSweepResult, setDlqSweepResult] = useState<any>(null);
  const [emaDecayNotice, setEmaDecayNotice] = useState<any>(null);
  const [auditLedger, setAuditLedger] = useState<any[]>([]);
  const [activeEdgeTokens, setActiveEdgeTokens] = useState<any[]>([]);
  const [shardSummary, setShardSummary] = useState<any>(null);
  const [merkleEpochs, setMerkleEpochs] = useState<any[]>([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);
  const [isChainValid, setIsChainValid] = useState(true);
  const [shredTarget, setShredTarget] = useState('buyer-enterprise-01');
  const [shredResult, setShredResult] = useState<any>(null);
  const [isShredding, setIsShredding] = useState(false);

  // Concurrent PostgreSQL Load Benchmark State
  const [benchTotalRequests, setBenchTotalRequests] = useState(64);
  const [benchConcurrency, setBenchConcurrency] = useState(16);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<any>(null);
  const [benchmarkHistory, setBenchmarkHistory] = useState<any[]>([]);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

  // Phase 1 & 2: Multi-Tenant Config, RBAC, Stripe Manual-Capture Escrow & Signed Shopify Webhooks
  const [tenantConfig, setTenantConfig] = useState<any>(null);
  const [tenantMembers, setTenantMembers] = useState<any[]>([]);
  const [cfgDomainInput, setCfgDomainInput] = useState('nexus-verified-store.myshopify.com');
  const [cfgFloorInput, setCfgFloorInput] = useState(18.5);
  const [cfgSecretInput, setCfgSecretInput] = useState('');
  const [isSavingTenantCfg, setIsSavingTenantCfg] = useState(false);
  const [tenantSaveBanner, setTenantSaveBanner] = useState<string | null>(null);
  const [shopifyEvents, setShopifyEvents] = useState<any[]>([]);
  const [stripeEscrows, setStripeEscrows] = useState<any[]>([]);
  const [stripeLiveConfigured, setStripeLiveConfigured] = useState(false);
  const [isTestingShopifyWebhook, setIsTestingShopifyWebhook] = useState(false);
  const [shopifyWebhookTestOutcome, setShopifyWebhookTestOutcome] = useState<any>(null);
  const [settlingEscrowRef, setSettlingEscrowRef] = useState<string | null>(null);

  const latestBenchSummary = benchmarkResult || benchmarkHistory[0] || null;

  // Flows configuration
  const flows = {
    margin_floor_clearance: {
      id: 'margin_floor_clearance',
      title: 'Margin-Floor Clearance',
      badge: 'FLAGSHIP ACID FLOW',
      tagline: 'Cloud SQL PostgreSQL SELECT FOR UPDATE locking across K=32 striped sub-lots + Half-Life EMA CM3 guardrails.',
      scenario: 'Competitor initiated a sharp price drop ($299 -> $215) on flagship ANC Audio SKU. NEXUS routes through an edge token-bucket admission gate and K=32 striped sub-lot allocator, evaluates deterministic CM3 net landed cost margin guardrails (with 30s half-life EMA + $0.05 penalty cap), locks inventory atomically inside a single-region Cloud SQL PostgreSQL ACID transaction (CHECK available_units >= 0), persists outbox state + SHA-256 hash-chained audit logs, and exercises simulated Stripe/FedEx SAGA fault recovery.',
      measurableOutcomes: {
        latency: latestBenchSummary ? `${latestBenchSummary.p50LatencyMs}ms P50` : 'Run Benchmark',
        marginFloor: '18.5% CM3 + Half-Life EMA',
        fillRate: 'ACID Sub-Lots (units >= 0)',
        realizedGmvLift: 'Elastic $239 Bundle',
        securityStatus: 'Firebase Auth + SHA-256'
      },
      agentforceActionName: 'NexusCommerce.clearMarginFloor',
      steps: [
        {
          stage: 1,
          label: 'Firebase Auth Gate & Zero-PII Edge Tokenizer (K=32 Salt)',
          subtext: 'Verifies Firebase ID token, sheds simulated burst floods (HTTP 429), and routes SKU writes across 32 striped sub-lot rows.',
          latencyMs: 3.2,
          status: 'completed',
          auditHash: '0x3f7a91c84b',
          details: 'Requires valid Google Sign-In Bearer token. Maps subjectId to edge token and assigns striped shard index (0..31) to distribute lock contention.'
        },
        {
          stage: 2,
          label: 'Cloud SQL PostgreSQL ACID Sub-Lot Lock & CM3 Guardrail',
          subtext: 'Evaluates landed CM3 margin floor + 30s half-life EMA and locks inventory row via SELECT ... FOR UPDATE (CHECK available_units >= 0).',
          latencyMs: latestBenchSummary ? Number(latestBenchSummary.p50LatencyMs) : 18.0,
          status: 'completed',
          auditHash: '0x99e2a4b71d',
          details: 'Single-region Cloud SQL PostgreSQL ACID commit updates available_units, reserved_units, and inserts durable outbox + idempotency rows.'
        },
        {
          stage: 3,
          label: 'Outbox SAGA State Machine & Ground-Truth DLQ Sweeper',
          subtext: 'Models funds-first Stripe Escrow -> FedEx WMS sequencing, Reaper backoff (maxRetries=3), and analytical DLQ sensitivity calculator.',
          latencyMs: 24.5,
          status: 'completed',
          auditHash: '0x5c8e3104f2',
          details: 'External Stripe & FedEx connectors are simulated state machines for testing pre-WMS compensation, worker crash recovery, and DLQ triage.'
        },
        {
          stage: 4,
          label: 'SHA-256 Hash-Chained Audit Ledger & Merkle Epoch Seal',
          subtext: 'Appends tamper-evident SHA-256 chain block and Merkle root directly inside PostgreSQL alongside edge KMS crypto-shredding.',
          latencyMs: 1.4,
          status: 'completed',
          auditHash: '0x7e112d8a90',
          details: 'Audit chain integrity verified across persisted audit_blocks; crypto-shredding destroys KMS key reference in edge_pii_vault without mutating hashes.'
        }
      ]
    },
    supply_demand_reconciliation: {
      id: 'supply_demand_reconciliation',
      title: 'Supply-Demand Reconciliation',
      badge: 'INVENTORY REBALANCE MODEL',
      tagline: 'Cross-shard PostgreSQL sub-lot rebalancing when primary shard inventory dips below order size.',
      scenario: 'Regional demand depletes primary sub-lot shard below requested order quantity. NEXUS acquires ordered row locks across SKU sub-lot shards in ascending index order inside a single Cloud SQL PostgreSQL transaction, rebalancing donor stock cleanly with zero negative inventory.',
      measurableOutcomes: {
        latency: latestBenchSummary ? `${latestBenchSummary.p95LatencyMs}ms P95` : 'Run Benchmark',
        marginFloor: 'Ordered Lock Rebalance',
        fillRate: 'SQL CHECK >= 0',
        realizedGmvLift: 'Zero Stockout Oversell',
        securityStatus: 'ACID Row Locking'
      },
      agentforceActionName: 'NexusCommerce.reconcileInventoryTelemetry',
      steps: [
        {
          stage: 1,
          label: 'Sub-Lot Deficit Detection',
          subtext: 'Detects when target shard has fewer available units than requested clearance quantity.',
          latencyMs: 2.1,
          status: 'completed',
          auditHash: '0x12a884ef01',
          details: 'Inspects primary shard inside PostgreSQL transaction before falling back to deterministic multi-shard lock acquisition.'
        },
        {
          stage: 2,
          label: 'Deadlock-Free Ordered Shard Lock',
          subtext: 'Locks all 32 SKU sub-lot shards in strictly ascending shardIndex order (ORDER BY shard_index ASC FOR UPDATE).',
          latencyMs: 14.0,
          status: 'completed',
          auditHash: '0x66c92d04a8',
          details: 'Ordered lock acquisition guarantees concurrent rebalances cannot deadlock while aggregating pool capacity.'
        },
        {
          stage: 3,
          label: 'Donor-to-Primary Unit Transfer',
          subtext: 'Draws needed deficit from highest-stock donor shards and increments primary shard atomically.',
          latencyMs: 6.4,
          status: 'completed',
          auditHash: '0xaa44198ec2',
          details: 'SQL CHECK (available_units >= 0) guarantees physical pool invariants hold under concurrent load.'
        },
        {
          stage: 4,
          label: 'SHA-256 Ledger & Merkle Epoch Commit',
          subtext: 'Commits updated sub-lot balances alongside signed audit_blocks entry in one ACID transaction.',
          latencyMs: 1.8,
          status: 'completed',
          auditHash: '0x88f01b3329',
          details: 'All balance deltas and audit hashes persist durably in PostgreSQL.'
        }
      ]
    },
    order_orchestration: {
      id: 'order_orchestration',
      title: 'End-to-End Order Orchestration',
      badge: 'SAGA FAULT SIMULATION',
      tagline: 'Demonstrates compensating rollbacks and Reaper/DLQ recovery over durable PostgreSQL outbox records.',
      scenario: 'Simulates an asynchronous 3P settlement sequence where Stripe Escrow authorization precedes FedEx WMS pick dispatch. Fault toggles inject Escrow decline, post-Escrow WMS failure, or worker SIGKILL crashes to prove atomic PostgreSQL compensation and durable Reaper recovery.',
      measurableOutcomes: {
        latency: 'Measured Per-Call',
        marginFloor: 'Idempotent Key Guard',
        fillRate: 'Compensated Rollback',
        realizedGmvLift: 'Durable Outbox State',
        securityStatus: 'Simulated 3P Faults'
      },
      agentforceActionName: 'NexusCommerce.orchestrateCartToClearance',
      steps: [
        {
          stage: 1,
          label: 'Idempotency Key & Request Validation',
          subtext: 'Checks idempotency_keys table in PostgreSQL so duplicate client retries replay safely without double-debit.',
          latencyMs: 2.0,
          status: 'completed',
          auditHash: '0x55d118a7c2',
          details: 'Returns cached statusCode + JSON payload whenever idempotencyKey already committed.'
        },
        {
          stage: 2,
          label: 'CM3 Net Landed Margin Guardrail',
          subtext: 'Evaluates freight, payment fee, RTO risk, egress cost, and capped void compensation penalty before locking stock.',
          latencyMs: 1.5,
          status: 'completed',
          auditHash: '0x22b09fae48',
          details: 'Supports HARD_HALT (422), TIME_DECAY_FLOOR, and HUMAN_APPROVAL_QUEUE (202) modes.'
        },
        {
          stage: 3,
          label: 'Simulated Escrow -> WMS Outbox SAGA',
          subtext: 'Executes simulated Stripe hold prior to FedEx WMS pick; compensates reserved PostgreSQL stock on downstream failure.',
          latencyMs: 34.8,
          status: 'completed',
          auditHash: '0x992cf1a004',
          details: 'Worker crashes persist IN_FLIGHT_CRASHED rows in outbox_records for Reaper recovery or DLQ circuit-breaking.'
        },
        {
          stage: 4,
          label: 'Merkle Epoch & Audit Chain Seal',
          subtext: 'Records SAGA outcome (SETTLED, COMPENSATED_ROLLED_BACK, or IN_FLIGHT_CRASHED) in audit_blocks.',
          latencyMs: 1.6,
          status: 'completed',
          auditHash: '0x44fa78119e',
          details: 'Full execution trace returned to caller for audit inspection.'
        }
      ]
    }
  };

  const currentFlowData = flows[activeFlow];

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const requireAuthHeaders = async (): Promise<Record<string, string> | null> => {
    const token = (await getFreshToken()) || idToken;
    if (!token) return null;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  // Fetch live audit ledger, 32-shard pool, Merkle epochs & benchmark history when authenticated
  const fetchAuditLedger = async (attempt: number = 0) => {
    if (!isMountedRef.current) return;
    const token = (await getFreshToken()) || idToken;
    if (!token) return;

    setIsLedgerLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const results = await Promise.allSettled([
        fetch('/api/agentforce/audit-trail', { cache: 'no-store', headers }),
        fetch(`/api/agentforce/shards?skuId=${encodeURIComponent(liveSku || 'SKU-ANC-PRO-09')}`, { cache: 'no-store', headers }),
        fetch('/api/agentforce/merkle-epochs', { cache: 'no-store', headers }),
        fetch('/api/agentforce/benchmark/history', { cache: 'no-store', headers }),
        fetch('/api/tenant/config', { cache: 'no-store', headers }),
        fetch('/api/integrations/events', { cache: 'no-store', headers }),
      ]);

      if (!isMountedRef.current) return;

      const [auditSettled, shardsSettled, merkleSettled, benchSettled, tenantSettled, eventsSettled] = results;
      let anyFailed = false;

      if (auditSettled.status === 'fulfilled' && auditSettled.value.ok) {
        const data = await auditSettled.value.json();
        if (isMountedRef.current) {
          setAuditLedger(data.blocks || []);
          setActiveEdgeTokens(data.activeEdgeTokens || []);
          setIsChainValid(data.integrity === 'VERIFIED_VALID_CHAIN');
        }
      } else {
        anyFailed = true;
      }

      if (shardsSettled.status === 'fulfilled' && shardsSettled.value.ok) {
        const sData = await shardsSettled.value.json();
        if (isMountedRef.current) {
          setShardSummary(sData);
        }
      } else {
        anyFailed = true;
      }

      if (merkleSettled.status === 'fulfilled' && merkleSettled.value.ok) {
        const mData = await merkleSettled.value.json();
        if (isMountedRef.current) {
          setMerkleEpochs(mData.epochs || []);
        }
      } else {
        anyFailed = true;
      }

      if (benchSettled.status === 'fulfilled' && benchSettled.value.ok) {
        const bData = await benchSettled.value.json();
        if (isMountedRef.current) {
          setBenchmarkHistory(bData.runs || []);
        }
      }

      if (tenantSettled.status === 'fulfilled' && tenantSettled.value.ok) {
        const tData = await tenantSettled.value.json();
        if (isMountedRef.current && tData.config) {
          setTenantConfig(tData.config);
          setTenantMembers(tData.members || []);
          if (tData.config.shopifyShopDomain) setCfgDomainInput(tData.config.shopifyShopDomain);
          if (typeof tData.config.defaultMarginFloorPct === 'number') setCfgFloorInput(tData.config.defaultMarginFloorPct);
        }
      }

      if (eventsSettled.status === 'fulfilled' && eventsSettled.value.ok) {
        const eData = await eventsSettled.value.json();
        if (isMountedRef.current) {
          setStripeLiveConfigured(Boolean(eData.stripeLiveConfigured));
          setShopifyEvents(eData.shopifyEvents || []);
          setStripeEscrows(eData.stripeEscrows || []);
        }
      }

      if (anyFailed && attempt < 2 && isMountedRef.current) {
        const backoffMs = attempt === 0 ? 400 : 1000;
        setTimeout(() => {
          if (isMountedRef.current) {
            void fetchAuditLedger(attempt + 1);
          }
        }, backoffMs);
      }
    } catch {
      if (attempt < 2 && isMountedRef.current) {
        setTimeout(() => {
          if (isMountedRef.current) {
            void fetchAuditLedger(attempt + 1);
          }
        }, attempt === 0 ? 400 : 1000);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLedgerLoading(false);
      }
    }
  };

  useEffect(() => {
    if (idToken) {
      void fetchAuditLedger();
    } else {
      setAuditLedger([]);
      setActiveEdgeTokens([]);
      setShardSummary(null);
      setMerkleEpochs([]);
      setBenchmarkHistory([]);
    }
  }, [idToken]);

  // Execute Concurrent PostgreSQL ACID Load Benchmark (POST /api/agentforce/benchmark/run)
  const handleRunBenchmark = async () => {
    setBenchmarkError(null);
    const headers = await requireAuthHeaders();
    if (!headers) {
      setBenchmarkError('Sign in with Google to run concurrent Cloud SQL benchmarks.');
      return;
    }

    setIsRunningBenchmark(true);
    audioVibe.playClick();
    try {
      const res = await fetch('/api/agentforce/benchmark/run', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          totalRequests: benchTotalRequests,
          concurrency: benchConcurrency,
          unitsPerTx: 1,
          skuId: 'SKU-BENCH-LOAD-01',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setBenchmarkError(data.error || 'Benchmark execution failed');
        audioVibe.playError();
      } else {
        setBenchmarkResult(data.benchmark);
        audioVibe.playChimeSuccess();
        await fetchAuditLedger();
      }
    } catch (err: any) {
      setBenchmarkError(err.message || 'Failed to run benchmark');
      audioVibe.playError();
    } finally {
      setIsRunningBenchmark(false);
    }
  };

  // Replenish SKU inventory sub-lots (POST /api/agentforce/lots/reset)
  const handleReplenishLots = async (targetSku?: string) => {
    const headers = await requireAuthHeaders();
    if (!headers) {
      void signInWithGoogle();
      return;
    }
    setIsReplenishingLots(true);
    audioVibe.playClick();
    try {
      const res = await fetch('/api/agentforce/lots/reset', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          skuId: targetSku || liveSku || 'SKU-ANC-PRO-09',
          totalUnits: 12000,
        }),
      });
      if (res.ok) {
        audioVibe.playChimeSuccess();
        await fetchAuditLedger();
      } else {
        audioVibe.playError();
      }
    } catch {
      audioVibe.playError();
    } finally {
      setIsReplenishingLots(false);
    }
  };

  // Execute Outbox Lease-Expiration Reaper (POST /api/agentforce/outbox/recover)
  const handleRunOutboxReaper = async (simulatePersistentFailure: boolean = false) => {
    const headers = await requireAuthHeaders();
    if (!headers) {
      void signInWithGoogle();
      return;
    }
    setIsReapingOutbox(true);
    audioVibe.playClick();
    try {
      const res = await fetch('/api/agentforce/outbox/recover', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          simulatePersistentFailure,
          maxRetries: 3,
          baseBackoffMs: 1000
        })
      });
      const data = await res.json();
      setReaperResult({ httpStatus: res.status, simulatedFailure: simulatePersistentFailure, ...data });
      if (res.ok && (!data.deadLetterIds || data.deadLetterIds.length === 0)) {
        audioVibe.playChimeSuccess();
      } else {
        audioVibe.playError();
      }
      await fetchAuditLedger();
    } catch (err: any) {
      setReaperResult({ httpStatus: 500, error: err.message });
      audioVibe.playError();
    } finally {
      setIsReapingOutbox(false);
    }
  };

  // Execute Autonomous Ground-Truth DLQ Sweeper (POST /api/agentforce/outbox/sweep-dlq)
  const handleSweepDlq = async (simulateByzantineMismatch: boolean = false) => {
    const headers = await requireAuthHeaders();
    if (!headers) {
      void signInWithGoogle();
      return;
    }
    setIsSweepingDlq(true);
    audioVibe.playClick();
    try {
      const res = await fetch('/api/agentforce/outbox/sweep-dlq', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          simulateByzantineMismatch,
          totalTxPerSec: 280,
          dlqRate: 0.01
        })
      });
      const data = await res.json();
      setDlqSweepResult({ httpStatus: res.status, simulatedByzantine: simulateByzantineMismatch, ...data });
      if (res.ok && (!data.byzantineEscalatedIds || data.byzantineEscalatedIds.length === 0)) {
        audioVibe.playChimeSuccess();
      } else {
        audioVibe.playError();
      }
      await fetchAuditLedger();
    } catch (err: any) {
      setDlqSweepResult({ httpStatus: 500, error: err.message });
      audioVibe.playError();
    } finally {
      setIsSweepingDlq(false);
    }
  };

  // Execute Wall-Clock Half-Life EMA Decay (POST /api/agentforce/ema/decay)
  const handleWallClockEmaDecay = async (elapsedSilenceMs: number = 30000) => {
    const headers = await requireAuthHeaders();
    if (!headers) {
      void signInWithGoogle();
      return;
    }
    setIsDecayingEma(true);
    audioVibe.playClick();
    try {
      const res = await fetch('/api/agentforce/ema/decay', {
        method: 'POST',
        headers,
        body: JSON.stringify({ elapsedSilenceMs })
      });
      const data = await res.json();
      setEmaDecayNotice({ httpStatus: res.status, ...data });
      if (res.ok) {
        audioVibe.playChimeSuccess();
      }
      await fetchAuditLedger();
    } catch (err: any) {
      setEmaDecayNotice({ httpStatus: 500, error: err.message });
      audioVibe.playError();
    } finally {
      setIsDecayingEma(false);
    }
  };

  // Execute GDPR Crypto-Shredding (Cloud SQL Edge Vault)
  const handleExecuteCryptoShred = async (targetSubject?: string) => {
    const headers = await requireAuthHeaders();
    if (!headers) {
      void signInWithGoogle();
      return;
    }
    const subjectOrToken = targetSubject || shredTarget;
    setIsShredding(true);
    audioVibe.playClick();
    try {
      const res = await fetch('/api/security/crypto-shred', {
        method: 'POST',
        headers,
        body: JSON.stringify({ subjectOrToken })
      });
      const data = await res.json();
      setShredResult({ httpStatus: res.status, ...data });
      if (res.ok) {
        audioVibe.playChimeSuccess();
      } else {
        audioVibe.playError();
      }
      await fetchAuditLedger();
    } catch (err: any) {
      setShredResult({ httpStatus: 500, error: err.message });
      audioVibe.playError();
    } finally {
      setIsShredding(false);
    }
  };

  // Execute Live ACID Action Call against Cloud SQL PostgreSQL
  const executeLiveAgentforceCall = async (overrides?: {
    forceCircuitBreaker?: boolean;
    simulateEscrowFailure?: boolean;
    simulateWmsFailure?: boolean;
    simulateWorkerCrashBeforeWms?: boolean;
    simulateBurstOverflow?: boolean;
    fallbackMode?: 'HARD_HALT' | 'TIME_DECAY_FLOOR' | 'HUMAN_APPROVAL_QUEUE';
    inventoryAgeDays?: number;
    competitorPrice?: number;
    marginFloorPct?: number;
    shardHint?: string;
  }) => {
    const headers = await requireAuthHeaders();
    if (!headers) {
      setLiveExecutionResult({
        httpStatus: 401,
        payload: { error: 'Google Sign-In is required to execute Cloud SQL transactions.' }
      });
      audioVibe.playError();
      return;
    }

    const isCircuitBreaker = overrides?.forceCircuitBreaker ?? liveForceCircuitBreaker;
    const isEscrowFail = overrides?.simulateEscrowFailure ?? liveSimulateEscrowFail;
    const isWmsFail = overrides?.simulateWmsFailure ?? liveSimulateWmsFail;
    const isCrashBeforeWms = overrides?.simulateWorkerCrashBeforeWms ?? liveSimulateCrashBeforeWms;
    const isBurstOverflow = overrides?.simulateBurstOverflow ?? liveSimulateBurstOverflow;
    const modeToUse = overrides?.fallbackMode ?? liveFallbackMode;
    const ageToUse = overrides?.inventoryAgeDays ?? liveInventoryAgeDays;
    const bidToUse = overrides?.competitorPrice ?? liveCompetitorPrice;
    const floorToUse = overrides?.marginFloorPct ?? liveMarginFloorPct;
    const hintToUse = overrides?.shardHint ?? liveShardHint;

    setIsExecutingLiveCall(true);
    setReaperResult(null);
    setDlqSweepResult(null);
    setEmaDecayNotice(null);
    audioVibe.playClick();
    try {
      const res = await fetch('/api/agentforce/clear-margin-floor', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          skuId: liveSku,
          excessUnits: Number(liveExcessUnits),
          minimumMarginFloorPct: Number(floorToUse),
          costOfGoodsSold: Number(liveCogs),
          freightCost: Number(liveFreightCost),
          paymentFeePct: Number(livePaymentFeePct),
          rtoProbability: Number(liveRtoProb),
          inventoryAgeDays: Number(ageToUse),
          fallbackMode: modeToUse,
          shardHint: hintToUse === 'auto' ? undefined : Number(hintToUse),
          idempotencyKey: liveIdempotencyKey.trim() || undefined,
          currentCompetitorPrice: Number(bidToUse),
          forceCircuitBreakerTest: isCircuitBreaker,
          allowDynamicBundle: !isCircuitBreaker && !isEscrowFail && !isWmsFail && !isBurstOverflow && modeToUse === 'HARD_HALT',
          simulateEscrowFailure: isEscrowFail,
          simulateWmsFailure: isWmsFail,
          simulateWorkerCrashBeforeWms: isCrashBeforeWms,
          simulateBurstOverflow: isBurstOverflow,
          tenantId: 'sf-org-00D5e000000Test',
          subjectId: shredTarget || 'buyer-enterprise-01'
        })
      });

      const data = await res.json();
      setLiveExecutionResult({
        httpStatus: res.status,
        payload: data
      });
      if (res.ok) {
        audioVibe.playChimeSuccess();
      } else {
        audioVibe.playError();
      }
      await fetchAuditLedger();
    } catch (err: any) {
      setLiveExecutionResult({
        httpStatus: 500,
        payload: { error: err.message || 'Network error executing call' }
      });
      audioVibe.playError();
    } finally {
      setIsExecutingLiveCall(false);
    }
  };

  // Simulation execution runner (triggers real authenticated server clearance if signed in)
  const handleRunSimulation = async () => {
    if (isRunningSimulation) return;
    audioVibe.playClick();
    setIsRunningSimulation(true);
    setCurrentStage(1);

    const headers = await requireAuthHeaders();
    if (headers) {
      fetch('/api/agentforce/clear-margin-floor', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          skuId: 'SKU-ANC-PRO-09',
          excessUnits: 1200,
          minimumMarginFloorPct: 18.5,
          costOfGoodsSold: 168.00,
          currentCompetitorPrice: 215.00,
          tenantId: 'sf-org-00D5e000000Test'
        })
      }).then(() => fetchAuditLedger()).catch(() => {});
    }

    const stepIntervals = [600, 1200, 1800, 2400];
    stepIntervals.forEach((delay, index) => {
      setTimeout(() => {
        setCurrentStage(index + 2);
        audioVibe.playChimeSuccess();
        if (index === stepIntervals.length - 1) {
          setIsRunningSimulation(false);
        }
      }, delay);
    });
  };

  const handleResetSimulation = () => {
    audioVibe.playClick();
    setIsRunningSimulation(false);
    setCurrentStage(0);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    audioVibe.playClick();
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Agentforce Action OpenAPI Spec Definition
  const agentforceSpecJson = {
    openapi: "3.1.0",
    info: {
      title: "NEXUS Autonomous Commerce API - Agentforce Action Spec",
      version: "4.2.0-enterprise",
      description: "Direct Agentforce Action schema for Salesforce Commerce Cloud, Agentforce Agents, and MuleSoft Anypoint integration."
    },
    servers: [
      {
        url: "https://api.nexus-commerce.os/v4/actions",
        description: "Production Enterprise Gateway (Multi-Tenant, MTLS Authenticated)"
      }
    ],
    paths: {
      [`/actions/${currentFlowData.agentforceActionName}`]: {
        post: {
          operationId: currentFlowData.agentforceActionName,
          summary: `Execute ${currentFlowData.title} autonomously with deterministic guardrails`,
          description: currentFlowData.tagline,
          security: [{ OAuth2Bearer: ["commerce:clearance:write"] }, { MTLS: [] }],
          parameters: [
            {
              name: "X-Tenant-ID",
              in: "header",
              required: true,
              schema: { type: "string", example: "sf-org-00D5e000000Test" },
              description: "Salesforce Org or Enterprise Tenant Identifier"
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["sku", "channelId", "targetMarginFloorPercent"],
                  properties: {
                    sku: { type: "string", example: "NX-ANC-09" },
                    channelId: { type: "string", example: "salesforce-b2c-storefront" },
                    competitorPriceUndercut: { type: "number", example: 215.00 },
                    targetMarginFloorPercent: { 
                      type: "number", 
                      example: 18.5,
                      description: "Hard mathematical margin floor. Action will abort with 422 if net margin dips below this guardrail."
                    },
                    elasticBundleAllowed: { type: "boolean", example: true }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Clearance action executed successfully within deterministic SLA",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      executionStatus: { type: "string", example: "EXECUTED" },
                      clearedPrice: { type: "number", example: 239.00 },
                      bundleAccessorySku: { type: "string", example: "NX-CASE-PRO" },
                      realizedMarginPercent: { type: "number", example: 26.4 },
                      executionLatencyMs: { type: "number", example: 42 },
                      immutableAuditHash: { type: "string", example: "0x7e112d8a90ffc1" },
                      guardrailPassed: { type: "boolean", example: true }
                    }
                  }
                }
              }
            },
            "422": {
              description: "Guardrail violation: Action refused to protect merchant margin floor"
            }
          }
        }
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. TOP EXECUTIVE ANNOUNCEMENT BANNER (Control Plane Tab) */}
      {currentTab === 'flagship_demo' && (
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0B0F17] via-[#0F1626] to-[#0B0F17] border border-emerald-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-emerald-400" /> ENTERPRISE FLAGSHIP PACKAGING
              </span>
              <span className="text-xs font-mono text-slate-400">
                • Built for Salesforce & C-Suite Technical Audits
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Single-Scenario Hero Flow & Agentforce Action Spec
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Leading with <strong>one flagship scenario</strong> with measurable outcomes (latency, margin floor, fill-rate), complete with an Agentforce Action schema and enterprise security baseline to eliminate procurement review delays.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 font-mono text-xs">
            <a
              href="/Nexus_Enterprise_Technical_Dossier.pdf"
              download="Nexus_Enterprise_Technical_Dossier.pdf"
              onClick={() => audioVibe.playChimeSuccess()}
              className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold flex items-center gap-2 transition-all shadow-md shadow-cyan-950 cursor-pointer"
              title="Download Official 4-Page Vector PDF (v4.5.0-Resilient)"
            >
              <Download className="w-4 h-4" />
              <span>Download Dossier (PDF)</span>
            </a>
            <button
              onClick={() => {
                audioVibe.playClick();
                selectTab('technical_dossier');
              }}
              className="px-3.5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-800/60 font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>View Dossier</span>
            </button>
            <button
              onClick={handleRunSimulation}
              disabled={isRunningSimulation}
              className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isRunningSimulation ? 'Executing...' : 'Run Simulation'}</span>
            </button>
            <button
              onClick={handleResetSimulation}
              className="px-3 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold flex items-center gap-1.5 cursor-pointer"
              title="Reset state"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Measurable Outcome Badges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-6 mt-6 border-t border-slate-800/80 font-mono">
          <div className="p-3 rounded-lg bg-black/40 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Measured ACID P50</div>
            <div className="text-base sm:text-lg font-bold text-emerald-400 tabular-nums">
              {currentFlowData.measurableOutcomes.latency}
            </div>
            <div className="text-[10px] text-slate-500">Cloud SQL PostgreSQL</div>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Margin Floor</div>
            <div className="text-base sm:text-lg font-bold text-white tabular-nums">
              {currentFlowData.measurableOutcomes.marginFloor}
            </div>
            <div className="text-[10px] text-emerald-400">Deterministic CM3</div>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Inventory Guard</div>
            <div className="text-base sm:text-lg font-bold text-cyan-300 tabular-nums">
              {currentFlowData.measurableOutcomes.fillRate}
            </div>
            <div className="text-[10px] text-slate-500">SELECT ... FOR UPDATE</div>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Clearance Action</div>
            <div className="text-base sm:text-lg font-bold text-amber-300 tabular-nums">
              {currentFlowData.measurableOutcomes.realizedGmvLift}
            </div>
            <div className="text-[10px] text-slate-500">Floor Protected</div>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Security Baseline</div>
            <div className="text-base sm:text-lg font-bold text-purple-300 truncate">
              {currentFlowData.measurableOutcomes.securityStatus}
            </div>
            <div className="text-[10px] text-emerald-400">Bearer Token Gated</div>
          </div>
        </div>
      </div>
      )}

      {/* Authentication Notice Banner when unauthenticated */}
      {!user && (
        <div className="p-4 rounded-xl bg-[#0B0F17] border border-amber-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
          <div className="space-y-1">
            <div className="text-amber-300 font-bold">
              Google Sign-In Required for Cloud SQL Persistence &amp; Benchmarks
            </div>
            <p className="text-slate-300 font-sans">
              All ACID sub-lot clearance, outbox recovery, crypto-shredding, and concurrent PostgreSQL benchmark endpoints require a verified Firebase ID token.
            </p>
            {authError && (
              <p className="text-rose-400 text-[11px]">{authError}</p>
            )}
          </div>
          <button
            onClick={() => {
              audioVibe.playClick();
              void signInWithGoogle();
            }}
            disabled={authLoading}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <LogIn className="w-4 h-4" />
            <span>{authLoading ? 'Checking Session...' : 'Sign in with Google'}</span>
          </button>
        </div>
      )}

      {/* 2. THREE HERO FLOW SELECTION PILLS (Control Plane Tab) */}
      {currentTab === 'flagship_demo' && (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            Select Hero Flow Anchor (Single-Scenario Focus)
          </label>
          <span className="text-[11px] font-mono text-emerald-400">
            Active: {currentFlowData.title}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
          {(Object.keys(flows) as HeroFlowType[]).map((flowKey) => {
            const flow = flows[flowKey];
            const isSelected = activeFlow === flowKey;
            return (
              <button
                key={flowKey}
                onClick={() => {
                  audioVibe.playClick();
                  setActiveFlow(flowKey);
                  setCurrentStage(0);
                }}
                className={`p-4 rounded-xl text-left border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-[#0B0F17] border-emerald-500/80 shadow-md ring-1 ring-emerald-500/40'
                    : 'bg-[#0B0F17]/60 border-slate-800 hover:border-slate-700 hover:bg-[#0B0F17]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                    flowKey === 'margin_floor_clearance' 
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80' 
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}>
                    {flow.badge}
                  </span>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>
                <div className="font-bold text-sm text-white font-sans">{flow.title}</div>
                <p className="text-xs text-slate-400 font-sans mt-1 line-clamp-2 leading-relaxed">
                  {flow.tagline}
                </p>
                <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Latency: <strong className="text-emerald-400">{flow.measurableOutcomes.latency}</strong></span>
                  <span>{flow.agentforceActionName}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* 3. NAVIGATION TABS: DEMO vs WORKFLOW ARCHITECTURE vs AGENTFORCE SPEC vs SECURITY BASELINE */}
      <div className="flex items-center gap-2 border-b border-slate-800 font-mono text-xs overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => selectTab('flagship_demo')}
          className={`pb-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            currentTab === 'flagship_demo'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Workflow className="w-4 h-4" />
          <span>1. Interactive Hero Flow Walkthrough</span>
        </button>

        <button
          type="button"
          onClick={() => selectTab('lifecycle_workflow')}
          className={`pb-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            currentTab === 'lifecycle_workflow'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>2. End-to-End Workflow Architecture (Start → Execution → Delivery → End)</span>
        </button>

        <button
          type="button"
          onClick={() => selectTab('agentforce_spec')}
          className={`pb-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            currentTab === 'agentforce_spec'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <FileCode2 className="w-4 h-4" />
          <span>3. Agentforce Action Spec & Integration Matrix</span>
        </button>

        <button
          type="button"
          onClick={() => selectTab('security_baseline')}
          className={`pb-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            currentTab === 'security_baseline'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>4. Security Baseline & Tenancy Architecture</span>
        </button>

        <button
          type="button"
          onClick={() => selectTab('technical_dossier')}
          className={`pb-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            currentTab === 'technical_dossier'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4 text-cyan-400" />
          <span>5. Technical Dossier</span>
        </button>

        <button
          type="button"
          onClick={() => selectTab('live_connectors')}
          className={`pb-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            currentTab === 'live_connectors'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4 text-emerald-400" />
          <span>6. Live Connectors &amp; RBAC</span>
        </button>
      </div>

      {/* TAB 1: INTERACTIVE HERO FLOW WALKTHROUGH */}
      {currentTab === 'flagship_demo' && (
        <div className="space-y-6">
          {/* Scenario Context Card */}
          <div className="p-5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-amber-400 tracking-wider">
                FLAGSHIP SCENARIO UNDER TEST
              </span>
              <span className="text-xs font-mono text-slate-400">
                Action: <code className="text-emerald-400">{currentFlowData.agentforceActionName}</code>
              </span>
            </div>
            <p className="text-sm text-slate-200 font-sans leading-relaxed">
              {currentFlowData.scenario}
            </p>
          </div>

          {/* 4-Stage Execution Timeline */}
          <div className="p-6 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white font-sans">
                  Autonomous Execution Timeline ({currentFlowData.title})
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Deterministic audit sequence with cryptographic non-repudiation
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-slate-400">Status:</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  currentStage === 0
                    ? 'bg-slate-900 text-slate-400 border border-slate-800'
                    : currentStage < 5
                    ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}>
                  {currentStage === 0 ? 'READY FOR TEST' : currentStage < 5 ? `EXECUTING STAGE ${currentStage}/4` : 'CLEARED & VERIFIED'}
                </span>
              </div>
            </div>

            {/* Stages Stack */}
            <div className="space-y-4">
              {currentFlowData.steps.map((step) => {
                const isStepActive = currentStage === step.stage;
                const isStepCompleted = currentStage > step.stage || currentStage === 5;
                const isStepPending = currentStage < step.stage && currentStage !== 5 && currentStage !== 0;

                return (
                  <div
                    key={step.stage}
                    className={`p-4 rounded-xl border transition-all ${
                      isStepActive
                        ? 'bg-emerald-950/20 border-emerald-500/80 shadow-lg'
                        : isStepCompleted
                        ? 'bg-black/30 border-slate-800/80'
                        : 'bg-black/20 border-slate-900 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                          isStepCompleted
                            ? 'bg-emerald-500 text-black'
                            : isStepActive
                            ? 'bg-amber-500 text-black animate-pulse'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isStepCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : `0${step.stage}`}
                        </div>

                        <div>
                          <div className="font-bold text-sm text-white font-sans flex items-center gap-2">
                            <span>{step.label}</span>
                            {isStepActive && (
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800">
                                In Execution ({step.latencyMs}ms)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-sans mt-0.5">
                            {step.subtext}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono self-end sm:self-auto shrink-0">
                        <span className="text-slate-400 tabular-nums">Latency: <strong className="text-white">{step.latencyMs}ms</strong></span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          Hash: {step.auditHash}
                        </span>
                      </div>
                    </div>

                    {/* Step Internal Details */}
                    <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-start gap-2 text-xs font-mono text-slate-300">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{step.details}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Before vs After Impact Box */}
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4 font-mono">
              <div className="text-xs uppercase font-bold text-slate-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Deterministic Outcome Comparison (Single Scenario)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Traditional System */}
                <div className="p-4 rounded-lg bg-black/40 border border-red-950/60 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-red-400">
                    <span>Legacy Rule-Based Commerce</span>
                    <span>FAILED</span>
                  </div>
                  <ul className="text-xs text-slate-400 space-y-1.5 font-sans">
                    <li className="flex items-start gap-1.5">
                      <span className="text-red-400">✕</span>
                      <span>14-hour manual batch sync delay to discover competitor price drop.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-red-400">✕</span>
                      <span>Blind price matching cuts unit margin from 32% to 4.2% (severe margin leakage).</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-red-400">✕</span>
                      <span>Zero autonomous bundle synthesis or dynamic inventory rebalancing.</span>
                    </li>
                  </ul>
                </div>

                {/* NEXUS Autonomous OS */}
                <div className="p-4 rounded-lg bg-black/40 border border-emerald-950/60 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                    <span>NEXUS + Cloud SQL ACID Engine</span>
                    <span>FLOOR ENFORCED</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 font-sans">
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-400">✔</span>
                      <span>Transactional inventory lock across 32 striped sub-lot rows prevents overselling.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-400">✔</span>
                      <span>Strict 18.5% CM3 margin floor enforced deterministically; zero race-to-bottom.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-400">✔</span>
                      <span>Elastic high-margin accessory pairing preserves +{formatPrice(40)} unit margin contribution.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Real Concurrent Cloud SQL PostgreSQL Load Benchmark Panel */}
          <div className="p-6 rounded-xl bg-[#0B0F17] border border-cyan-800/60 space-y-5 font-mono">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                  LIVE CONCURRENT CLOUD SQL POSTGRESQL BENCHMARK
                </div>
                <h3 className="text-base font-bold text-white font-sans">
                  Measure Real Concurrent ACID Clearance Throughput &amp; Latency Percentiles
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Executes parallel PostgreSQL transactions (`SELECT ... FOR UPDATE` + outbox insert) across 32 shards and persists measured timings.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => handleReplenishLots('SKU-ANC-PRO-09')}
                  disabled={!user || isReplenishingLots}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReplenishingLots ? 'animate-spin' : ''}`} />
                  <span>{isReplenishingLots ? 'Replenishing...' : 'Replenish SKU Stock'}</span>
                </button>
                <button
                  onClick={handleRunBenchmark}
                  disabled={!user || isRunningBenchmark}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Gauge className="w-4 h-4" />
                  <span>{isRunningBenchmark ? 'Running Benchmark...' : 'Run Concurrent Load Test'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Total Clearance Transactions (10–200)</label>
                <input
                  type="number"
                  min={10}
                  max={200}
                  value={benchTotalRequests}
                  onChange={(e) => setBenchTotalRequests(Math.min(200, Math.max(10, Number(e.target.value) || 64)))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-white text-xs tabular-nums focus:outline-hidden focus:border-cyan-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Concurrent Workers (1–32)</label>
                <input
                  type="number"
                  min={1}
                  max={32}
                  value={benchConcurrency}
                  onChange={(e) => setBenchConcurrency(Math.min(32, Math.max(1, Number(e.target.value) || 16)))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-cyan-300 text-xs tabular-nums focus:outline-hidden focus:border-cyan-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Target Sub-Lot Pool</label>
                <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-slate-800 text-slate-300 text-xs">
                  SKU-BENCH-LOAD-01 (32 Shards)
                </div>
              </div>
            </div>

            {benchmarkError && (
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800 text-rose-200 text-xs">
                {benchmarkError}
              </div>
            )}

            {latestBenchSummary ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-black/40 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Measured Throughput</div>
                  <div className="text-base font-bold text-emerald-400 tabular-nums">
                    {latestBenchSummary.throughputTxPerSec} tx/s
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums">
                    {latestBenchSummary.totalDurationMs}ms total
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">P50 Latency</div>
                  <div className="text-base font-bold text-cyan-300 tabular-nums">
                    {latestBenchSummary.p50LatencyMs} ms
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums">
                    Min: {latestBenchSummary.minLatencyMs} ms
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">P95 Latency</div>
                  <div className="text-base font-bold text-amber-300 tabular-nums">
                    {latestBenchSummary.p95LatencyMs} ms
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums">
                    Concurrency: {latestBenchSummary.concurrency}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">P99 / Max Latency</div>
                  <div className="text-base font-bold text-white tabular-nums">
                    {latestBenchSummary.p99LatencyMs} / {latestBenchSummary.maxLatencyMs} ms
                  </div>
                  <div className="text-[10px] text-slate-500">Measured tail</div>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Committed / Rejected</div>
                  <div className="text-base font-bold text-emerald-300 tabular-nums">
                    {latestBenchSummary.succeededCount} / {latestBenchSummary.rejectedCount}
                  </div>
                  <div className="text-[10px] text-slate-500">Run {latestBenchSummary.runId}</div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-black/40 border border-slate-800 text-xs text-slate-400">
                {user
                  ? 'No benchmark runs recorded yet. Click "Run Concurrent Load Test" to measure live Cloud SQL PostgreSQL latencies.'
                  : 'Sign in with Google above to run a live benchmark and inspect historical runs.'}
              </div>
            )}

            {benchmarkHistory.length > 0 && (
              <div className="overflow-x-auto pt-2 border-t border-slate-800">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                      <th className="py-2 px-2">Run ID</th>
                      <th className="py-2 px-2">Tx / Concurrency</th>
                      <th className="py-2 px-2">Throughput</th>
                      <th className="py-2 px-2">Min / P50 / P95 / P99</th>
                      <th className="py-2 px-2">Succeeded / Rejected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-[11px] tabular-nums">
                    {benchmarkHistory.map((run) => (
                      <tr key={run.runId} className="hover:bg-slate-900/40">
                        <td className="py-2 px-2 font-bold text-cyan-300">{run.runId}</td>
                        <td className="py-2 px-2">{run.totalRequests} tx @ {run.concurrency} workers</td>
                        <td className="py-2 px-2 font-bold text-emerald-400">{run.throughputTxPerSec} tx/s</td>
                        <td className="py-2 px-2">
                          {run.minLatencyMs} / {run.p50LatencyMs} / {run.p95LatencyMs} / {run.p99LatencyMs} ms
                        </td>
                        <td className="py-2 px-2">
                          <span className="text-emerald-300">{run.succeededCount} ok</span> · <span className="text-rose-300">{run.rejectedCount} err</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: END-TO-END WORKFLOW ARCHITECTURE (START -> EXECUTION -> DELIVERY -> END) */}
      {currentTab === 'lifecycle_workflow' && (
        <div className="space-y-6">
          {/* Executive Overview Banner */}
          <div className="p-6 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 tracking-wider">
                CLOUD SQL POSTGRESQL + DETERMINISTIC CM3 ARCHITECTURE
              </span>
              <span className="text-xs font-mono text-slate-400">
                Persistence: <strong className="text-emerald-400">Single-Region Cloud SQL Primary</strong> &bull; <strong className="text-purple-300">Simulated 3P Connectors</strong>
              </span>
            </div>
            <h2 className="text-xl font-bold text-white font-sans">
              Transactional Lifecycle: Authenticated Ingress &rarr; PostgreSQL ACID Sub-Lots &rarr; Outbox SAGA &amp; Audit Seal
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
              Inventory state, outbox records, idempotency keys, edge PII vault keys, and SHA-256 hash-chained audit blocks persist in single-region Cloud SQL for PostgreSQL using `SELECT ... FOR UPDATE` row locks and `CHECK (available_units &gt;= 0)`. Third-party Stripe Escrow &amp; FedEx WMS calls and DLQ triage sensitivity formulas are modeled explicitly as deterministic simulations.
            </p>
          </div>

          {/* 4-Point Interactive Pipeline Ribbon */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono">
            {/* 1. STARTING POINT */}
            <button
              onClick={() => {
                audioVibe.playClick();
                setSelectedLifecyclePoint('start');
              }}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative ${
                selectedLifecyclePoint === 'start'
                  ? 'bg-[#0B0F17] border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                  : 'bg-black/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                  01 · INGESTION
                </span>
                <Radio className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-sm font-bold text-white font-sans">1. Starting Point</div>
              <div className="text-[11px] text-slate-400 font-sans mt-1">
                Telemetry & Intent Trigger
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Auth:</span>
                <span className="text-blue-400 font-bold">Firebase Bearer</span>
              </div>
            </button>

            {/* 2. EXECUTION POINT */}
            <button
              onClick={() => {
                audioVibe.playClick();
                setSelectedLifecyclePoint('execution');
              }}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative ${
                selectedLifecyclePoint === 'execution'
                  ? 'bg-[#0B0F17] border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                  : 'bg-black/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                  02 · POLICY GATE
                </span>
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-sm font-bold text-white font-sans">2. Execution Point</div>
              <div className="text-[11px] text-slate-400 font-sans mt-1">
                CM3 Guardrail &amp; ACID Lock
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Floor:</span>
                <span className="text-amber-400 font-bold">18.5% Strict</span>
              </div>
            </button>

            {/* 3. DELIVERY POINT */}
            <button
              onClick={() => {
                audioVibe.playClick();
                setSelectedLifecyclePoint('delivery');
              }}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative ${
                selectedLifecyclePoint === 'delivery'
                  ? 'bg-[#0B0F17] border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                  : 'bg-black/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                  03 · LOGISTICS (SIM)
                </span>
                <Truck className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-sm font-bold text-white font-sans">3. Delivery Point</div>
              <div className="text-[11px] text-slate-400 font-sans mt-1">
                Simulated 3P Dispatch State
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Connector:</span>
                <span className="text-purple-400 font-bold">Simulated WMS</span>
              </div>
            </button>

            {/* 4. ENDING POINT */}
            <button
              onClick={() => {
                audioVibe.playClick();
                setSelectedLifecyclePoint('end');
              }}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative ${
                selectedLifecyclePoint === 'end'
                  ? 'bg-[#0B0F17] border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                  : 'bg-black/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  04 · SETTLEMENT
                </span>
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-sm font-bold text-white font-sans">4. Ending Point</div>
              <div className="text-[11px] text-slate-400 font-sans mt-1">
                Outbox State &amp; Audit Chain
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Integrity:</span>
                <span className="text-emerald-400 font-bold">SHA-256 Chain</span>
              </div>
            </button>
          </div>

          {/* Deep Dive Detail Card for Selected Point */}
          <div className="p-6 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-6">
            {selectedLifecyclePoint === 'start' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-mono uppercase font-bold text-blue-400">
                      POINT 1: TELEMETRY INGESTION & TRIGGER
                    </span>
                    <h3 className="text-lg font-bold text-white font-sans">
                      The Starting Point: Where the Workflow Initiates
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-2.5 py-1 rounded bg-blue-950 text-blue-300 border border-blue-800">
                      Firebase ID Token Required
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-4 rounded-lg bg-black/40 border border-slate-800 space-y-1.5">
                    <div className="text-slate-500 text-[10px] uppercase">Initiating Event Source</div>
                    <div className="font-bold text-white">Authenticated Price-Drop or Checkout Call</div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Triggered via API client with Firebase Google Sign-In Bearer token and optional idempotency key.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-black/40 border border-slate-800 space-y-1.5">
                    <div className="text-slate-500 text-[10px] uppercase">Ingress Endpoint</div>
                    <div className="font-bold text-cyan-300">POST /api/agentforce/clear-margin-floor</div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Verifies token via firebase-admin, tokenizes subjectId at edge, and applies token-bucket admission gate.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-black/40 border border-slate-800 space-y-1.5">
                    <div className="text-slate-500 text-[10px] uppercase">State Transition</div>
                    <div className="font-bold text-blue-400">IDLE &rarr; VALIDATED_ADMITTED</div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Routes directly into deterministic CM3 margin guardrail evaluator and K=32 shard salt selector.
                    </p>
                  </div>
                </div>

                {/* Ingress Payload Spec */}
                <div className="p-4 rounded-lg bg-black/60 border border-slate-800 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-white font-bold">Ingress Event Payload (Starting Point)</span>
                    <span>Content-Type: application/json</span>
                  </div>
                  <pre className="text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
{`{
  "skuId": "SKU-ANC-PRO-09",
  "excessUnits": 1200,
  "costOfGoodsSold": 168.00,
  "freightCost": 8.50,
  "minimumMarginFloorPct": 18.5,
  "currentCompetitorPrice": 215.00,
  "fallbackMode": "HARD_HALT",
  "tenantId": "sf-org-00D5e000000Test"
}`}
                  </pre>
                </div>
              </div>
            )}

            {selectedLifecyclePoint === 'execution' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-mono uppercase font-bold text-amber-400">
                      POINT 2: CM3 GUARDRAIL &amp; POSTGRESQL ACID SHARD LOCK
                    </span>
                    <h3 className="text-lg font-bold text-white font-sans">
                      The Execution Point: Where Margin Floors &amp; Stock Invariants Commit
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-2.5 py-1 rounded bg-amber-950 text-amber-300 border border-amber-800">
                      Measured per-call via Load Benchmark
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-4 rounded-lg bg-black/40 border border-slate-800 space-y-1.5">
                    <div className="text-slate-500 text-[10px] uppercase">Deterministic Policy Gate</div>
                    <div className="font-bold text-emerald-400">Hard Margin Floor &ge; 18.5%</div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Refuses blind price match at $215 (which yields only 4.2% margin). Enforces mathematical floor at $199.08.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-black/40 border border-slate-800 space-y-1.5">
                    <div className="text-slate-500 text-[10px] uppercase">Autonomous Elastic Action</div>
                    <div className="font-bold text-amber-300">Synthesizes Bundle at $239</div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Pairs primary SKU with high-margin AeroShield Hardcase ($40 margin), realizing 26.4% composite margin.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-black/40 border border-slate-800 space-y-1.5">
                    <div className="text-slate-500 text-[10px] uppercase">Rejection Fallback Mode</div>
                    <div className="font-bold text-red-400">HTTP 422 Rejection if Breached</div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      If floor is breached, action aborts with 422 GUARDRAIL_VIOLATION. Zero uncollateralized margin loss.
                    </p>
                  </div>
                </div>

                {/* Execution Output Spec */}
                <div className="p-4 rounded-lg bg-black/60 border border-slate-800 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-white font-bold">Execution Output Packet (Agentforce Action Executed)</span>
                    <span>Action: NexusCommerce.clearMarginFloor</span>
                  </div>
                  <pre className="text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
{`{
  "executionId": "exec_nx_441208",
  "status": "EXECUTED",
  "guardrailAudit": {
    "marginFloorRequired": 18.5,
    "marginRealized": 26.4,
    "guardrailPassed": true,
    "raceToBottomAvoided": true
  },
  "actionResult": {
    "clearedPrice": 239.00,
    "elasticBundleSku": "NX-CASE-PRO",
    "bundleMarginContribution": 40.00,
    "netMarginLift": "+24.6% GMV",
    "virtualInventoryLockId": "lock_sfo_01_4498"
  },
  "latencyMs": 42
}`}
                  </pre>
                </div>
              </div>
            )}

            {selectedLifecyclePoint === 'delivery' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-mono uppercase font-bold text-purple-400">
                      POINT 3: PHYSICAL LOGISTICS & STOREFRONT DISPATCH
                    </span>
                    <h3 className="text-lg font-bold text-white font-sans">
                      The Delivery Point: How Value and Goods are Dispatched
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-2.5 py-1 rounded bg-purple-950 text-purple-300 border border-purple-800">
                      Simulated 3P State Machine
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-4 rounded-lg bg-black/40 border border-slate-800 space-y-1.5">
                    <div className="text-slate-500 text-[10px] uppercase">Carrier Integration Point</div>
                    <div className="font-bold text-purple-300">Automated FedEx / WMS API Call</div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Warehouse WMS receives instant pick-pack instruction. Carrier barcode assigned: NX-88241-US.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-black/40 border border-slate-800 space-y-1.5">
                    <div className="text-slate-500 text-[10px] uppercase">Storefront Catalog Sync</div>
                    <div className="font-bold text-white">Salesforce SCAPI & Shopify Sync</div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Price books updated across headless storefronts; available inventory decremented to prevent overselling.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-black/40 border border-slate-800 space-y-1.5">
                    <div className="text-slate-500 text-[10px] uppercase">Buyer Notification Handshake</div>
                    <div className="font-bold text-emerald-400">Real-Time Confirmation Push</div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Digital twin wallet, WhatsApp, and email dispatched with verified order reference and 2-day delivery guarantee.
                    </p>
                  </div>
                </div>

                {/* Delivery Dispatch Payload Spec */}
                <div className="p-4 rounded-lg bg-black/60 border border-slate-800 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-white font-bold">Delivery Dispatch Notification Payload</span>
                    <span>Destination: Logistics Mesh & Storefronts</span>
                  </div>
                  <pre className="text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
{`{
  "dispatchId": "dsp_fedex_88194",
  "orderRef": "NX-88241",
  "trackingNumber": "NX-88241-US",
  "carrier": "FEDEX_2DAY_EXPRESS",
  "originHub": "SFO-01-LOGISTICS",
  "destinationZip": "94107",
  "estimatedDeliveryDate": "2026-11-09",
  "items": [
    { "sku": "NX-ANC-09", "quantity": 1, "price": 239.00 },
    { "sku": "NX-CASE-PRO", "quantity": 1, "price": 0.00, "promo": "INCLUDED_BUNDLE" }
  ],
  "wmsStatus": "LABEL_GENERATED_READY_TO_PICK"
}`}
                  </pre>
                </div>
              </div>
            )}

            {selectedLifecyclePoint === 'end' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-mono uppercase font-bold text-emerald-400">
                      POINT 4: FINANCIAL SETTLEMENT & CRYPTOGRAPHIC PROOF
                    </span>
                    <h3 className="text-lg font-bold text-white font-sans">
                      The Ending Point: Settlement Closure & Non-Repudiation Audit
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      Terminal Status: SETTLED_AND_CONFIRMED
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-4 rounded-lg bg-black/40 border border-slate-800 space-y-1.5">
                    <div className="text-slate-500 text-[10px] uppercase">Financial Clearing</div>
                    <div className="font-bold text-emerald-400">Escrow Lock Sequence Recorded</div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Simulated Stripe Escrow hold is stamped on the durable outbox row prior to simulated carrier dispatch.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-black/40 border border-slate-800 space-y-1.5">
                    <div className="text-slate-500 text-[10px] uppercase">Outbox Reconciliation</div>
                    <div className="font-bold text-white">PostgreSQL Outbox &amp; DLQ Sweeper</div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Crashed outbox rows recover via exponential backoff Reaper or enter DLQ reconciliation tracking.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-black/40 border border-slate-800 space-y-1.5">
                    <div className="text-slate-500 text-[10px] uppercase">Tamper-Evident Audit</div>
                    <div className="font-bold text-purple-300">SHA-256 Hash Chain + Merkle</div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Every transaction writes a linked SHA-256 block into PostgreSQL audit_blocks plus Merkle epoch root.
                    </p>
                  </div>
                </div>

                {/* Ending Settlement Proof Spec */}
                <div className="p-4 rounded-lg bg-black/60 border border-slate-800 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-white font-bold">Terminal Settlement Proof (Ending Point)</span>
                    <span>State: IMMUTABLE_CLOSED</span>
                  </div>
                  <pre className="text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
{`{
  "terminalProofId": "prf_nexus_772199",
  "orderRef": "NX-88241",
  "clearedAmount": 239.00,
  "netRealizedMargin": 63.10,
  "escrowSettlementTx": "tx_wire_991823_cleared",
  "erpLedgerRef": "SAP-ACCRUAL-2026-11-8819",
  "sha256AuditHash": "0x7e112d8a90ffc1bb840921eef0041289c891",
  "nonRepudiationSignature": "ECDSA_NEXUS_DAEMON_KEY_ROTATION_V4",
  "finalState": "SETTLED_AND_CONFIRMED"
}`}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* End-to-End Sequence Matrix Table */}
          <div className="p-5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-3 font-mono">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-2">
                <Workflow className="w-4 h-4 text-emerald-400" />
                <span>Complete Lifecycle Execution Matrix</span>
              </span>
              <span className="text-[10px] text-slate-400">4 Points &bull; 0 Manual Touchpoints</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Point</th>
                    <th className="py-2.5 px-3">Actor / Subsystem</th>
                    <th className="py-2.5 px-3">Core Operation</th>
                    <th className="py-2.5 px-3">Guardrail / SLA</th>
                    <th className="py-2.5 px-3">Output Deliverable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-[11px]">
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-blue-400">1. STARTING POINT</td>
                    <td className="py-2.5 px-3 text-white">Express + Firebase Auth</td>
                    <td className="py-2.5 px-3 text-slate-300">Bearer token verify + idempotency lookup</td>
                    <td className="py-2.5 px-3 tabular-nums text-slate-400">HTTP 401 if unsigned</td>
                    <td className="py-2.5 px-3 text-cyan-300">Tokenized Subject Ref</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-amber-400">2. EXECUTION POINT</td>
                    <td className="py-2.5 px-3 text-white">CM3 Gate + Cloud SQL</td>
                    <td className="py-2.5 px-3 text-slate-300">Evaluates margin floor; SELECT FOR UPDATE lock</td>
                    <td className="py-2.5 px-3 tabular-nums text-emerald-400">Floor &ge; 18.5%, units &ge; 0</td>
                    <td className="py-2.5 px-3 text-emerald-400">PostgreSQL Sub-Lot Lock</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-purple-400">3. DELIVERY POINT</td>
                    <td className="py-2.5 px-3 text-white">Outbox SAGA (Simulated 3P)</td>
                    <td className="py-2.5 px-3 text-slate-300">Simulated Stripe Escrow &rarr; FedEx WMS dispatch</td>
                    <td className="py-2.5 px-3 tabular-nums text-slate-400">Auto-compensate on fail</td>
                    <td className="py-2.5 px-3 text-purple-300">Outbox + Reaper Recovery</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">4. ENDING POINT</td>
                    <td className="py-2.5 px-3 text-white">Audit Ledger &amp; Merkle</td>
                    <td className="py-2.5 px-3 text-slate-300">Appends SHA-256 block &amp; Merkle epoch root</td>
                    <td className="py-2.5 px-3 tabular-nums text-emerald-400">Verified Hash Chain</td>
                    <td className="py-2.5 px-3 text-emerald-300">Persisted Audit Proof</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AGENTFORCE ACTION SPEC & COMMERCE INTEGRATION POINTS */}
      {currentTab === 'agentforce_spec' && (
        <div className="space-y-6">
          {/* Header Description */}
          <div className="p-5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-cyan-400 tracking-wider">
                OPENAPI 3.1 & SALESFORCE AGENTFORCE SPECIFICATION
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(JSON.stringify(agentforceSpecJson, null, 2), 'spec_json')}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono flex items-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  {copiedKey === 'spec_json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'spec_json' ? 'Copied JSON!' : 'Copy Spec JSON'}</span>
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Standardized contract defining the Agentforce Action schema, inputs, outputs, auth mechanisms, and deterministic guardrail constraints. Can be imported directly into Salesforce Agent Builder or MuleSoft Anypoint Exchange.
            </p>
          </div>

          {/* Integration Points Matrix Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Salesforce Commerce Cloud */}
            <div className="p-5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-white">Salesforce Commerce Cloud (SFCC)</div>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-800">
                  Headless Cartridge
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Bi-directional SCAPI webhook integration. Synchronizes real-time price book updates and inventory locks with &lt;45ms round-trip latency.
              </p>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div>Endpoint: <code>/api/sfcc/v2/pricing</code></div>
                  <div>Protocol: <code>REST / SCAPI Adapter</code></div>
                </div>
              </div>

              {/* Salesforce Agentforce */}
              <div className="p-5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-white">Salesforce Agentforce</div>
                  <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 text-[10px] font-bold border border-blue-800">
                    OpenAPI Action Spec
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-sans leading-relaxed">
                  Action schema defining deterministic margin-floor clearance inputs, rejection codes (422), and idempotent settlement outputs.
                </p>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div>Action: <code>{currentFlowData.agentforceActionName}</code></div>
                  <div>Guardrail: <code>MarginFloor = 18.5%</code></div>
                </div>
              </div>

              {/* MuleSoft AnyPoint */}
              <div className="p-5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-white">Outbox Event &amp; Benchmark API</div>
                  <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 text-[10px] font-bold border border-purple-800">
                    Cloud SQL Outbox
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-sans leading-relaxed">
                  Transactional outbox pattern persists durable event records in PostgreSQL for simulated downstream fulfillment reconciliation and concurrent benchmarking.
                </p>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div>Outbox: <code>outbox_records</code></div>
                  <div>Benchmark: <code>/api/agentforce/benchmark/run</code></div>
                </div>
              </div>
            </div>

          {/* Interactive Live Action Execution Console */}
          <div className="p-6 rounded-xl bg-[#0B0F17] border border-cyan-800/60 shadow-xl space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-mono font-bold">
                    CLOUD SQL ACID RUNTIME CONSOLE
                  </span>
                  <span className="text-xs text-slate-400 font-mono">POST /api/agentforce/clear-margin-floor</span>
                </div>
                <h3 className="text-base font-bold text-white font-sans mt-1">
                  Test PostgreSQL Sub-Lot Locking, Simulated 3P SAGA Compensation, Reaper &amp; Half-Life EMA
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setLiveSku('SKU-ANC-PRO-09');
                    setLiveExcessUnits(1200);
                    setLiveMarginFloorPct(18.5);
                    setLiveCogs(168.00);
                    setLiveCompetitorPrice(215.00);
                    setLiveInventoryAgeDays(14);
                    setLiveFallbackMode('HARD_HALT');
                    setLiveForceCircuitBreaker(false);
                    setLiveSimulateEscrowFail(false);
                    setLiveSimulateWmsFail(false);
                    setLiveSimulateCrashBeforeWms(false);
                    setLiveSimulateBurstOverflow(false);
                    audioVibe.playClick();
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono border border-slate-700 cursor-pointer"
                >
                  Preset: Nominal ACID Clearance
                </button>
                <button
                  onClick={() => {
                    setLiveSku('SKU-ANC-PRO-09');
                    setLiveExcessUnits(1200);
                    setLiveMarginFloorPct(18.5);
                    setLiveCogs(168.00);
                    setLiveCompetitorPrice(175.00);
                    setLiveInventoryAgeDays(14);
                    setLiveFallbackMode('HARD_HALT');
                    setLiveForceCircuitBreaker(true);
                    setLiveSimulateEscrowFail(false);
                    setLiveSimulateWmsFail(false);
                    setLiveSimulateCrashBeforeWms(false);
                    setLiveSimulateBurstOverflow(false);
                    audioVibe.playClick();
                  }}
                  className="px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 text-[11px] font-mono border border-emerald-800/80 cursor-pointer"
                >
                  Preset: CM3 Floor Halt (422)
                </button>
                <button
                  onClick={() => {
                    setLiveSku('SKU-ANC-PRO-09');
                    setLiveExcessUnits(500);
                    setLiveMarginFloorPct(18.5);
                    setLiveCogs(168.00);
                    setLiveCompetitorPrice(245.00);
                    setLiveInventoryAgeDays(14);
                    setLiveFallbackMode('HARD_HALT');
                    setLiveForceCircuitBreaker(false);
                    setLiveSimulateEscrowFail(true);
                    setLiveSimulateWmsFail(false);
                    setLiveSimulateCrashBeforeWms(false);
                    setLiveSimulateBurstOverflow(false);
                    audioVibe.playClick();
                  }}
                  className="px-2.5 py-1 rounded bg-purple-950/80 hover:bg-purple-900 text-purple-300 text-[11px] font-mono border border-purple-800/80 cursor-pointer"
                >
                  Preset: Escrow Fail (0 WMS)
                </button>
                <button
                  onClick={() => {
                    setLiveSku('SKU-ANC-PRO-09');
                    setLiveExcessUnits(500);
                    setLiveMarginFloorPct(18.5);
                    setLiveCogs(168.00);
                    setLiveCompetitorPrice(245.00);
                    setLiveInventoryAgeDays(14);
                    setLiveFallbackMode('HARD_HALT');
                    setLiveForceCircuitBreaker(false);
                    setLiveSimulateEscrowFail(false);
                    setLiveSimulateWmsFail(true);
                    setLiveSimulateCrashBeforeWms(false);
                    setLiveSimulateBurstOverflow(false);
                    audioVibe.playClick();
                  }}
                  className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-[11px] font-mono border border-rose-800/80 cursor-pointer"
                >
                  Preset: WMS Fail &rarr; Void Escrow
                </button>
                <button
                  onClick={() => {
                    setLiveSku('SKU-ANC-PRO-09');
                    setLiveExcessUnits(400);
                    setLiveMarginFloorPct(18.5);
                    setLiveCogs(168.00);
                    setLiveCompetitorPrice(245.00);
                    setLiveInventoryAgeDays(14);
                    setLiveFallbackMode('HARD_HALT');
                    setLiveForceCircuitBreaker(false);
                    setLiveSimulateEscrowFail(false);
                    setLiveSimulateWmsFail(false);
                    setLiveSimulateCrashBeforeWms(true);
                    setLiveSimulateBurstOverflow(false);
                    audioVibe.playClick();
                  }}
                  className="px-2.5 py-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 text-[11px] font-mono border border-amber-800/80 cursor-pointer"
                >
                  Preset: Crash Before WMS (Reaper/DLQ)
                </button>
                <button
                  onClick={() => {
                    setLiveSku('SKU-ANC-PRO-09');
                    setLiveExcessUnits(600);
                    setLiveMarginFloorPct(18.5);
                    setLiveCogs(168.00);
                    setLiveCompetitorPrice(215.00);
                    setLiveInventoryAgeDays(14);
                    setLiveFallbackMode('HARD_HALT');
                    setLiveForceCircuitBreaker(false);
                    setLiveSimulateEscrowFail(false);
                    setLiveSimulateWmsFail(false);
                    setLiveSimulateCrashBeforeWms(false);
                    setLiveSimulateBurstOverflow(true);
                    audioVibe.playClick();
                  }}
                  className="px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 text-[11px] font-mono border border-cyan-800/80 cursor-pointer"
                >
                  Preset: Edge Burst Shedding (429)
                </button>
              </div>
            </div>

            {/* Row 1: Core Parameters Grid */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">SKU ID</label>
                <input
                  type="text"
                  value={liveSku}
                  onChange={(e) => setLiveSku(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-white font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Target Shard (K=32)</label>
                <select
                  value={liveShardHint}
                  onChange={(e) => setLiveShardHint(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-cyan-300 font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="auto">Striped Dynamic Salt (K=32)</option>
                  {Array.from({ length: 8 }, (_, idx) => (
                    <option key={idx} value={String(idx)}>shard-{String(idx).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Excess Units</label>
                <input
                  type="number"
                  value={liveExcessUnits}
                  onChange={(e) => setLiveExcessUnits(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-white font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Margin Floor %</label>
                <input
                  type="number"
                  step="0.5"
                  value={liveMarginFloorPct}
                  onChange={(e) => setLiveMarginFloorPct(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-amber-300 font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Base COGS ($)</label>
                <input
                  type="number"
                  step="1"
                  value={liveCogs}
                  onChange={(e) => setLiveCogs(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-white font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Market Bid ($)</label>
                <input
                  type="number"
                  step="1"
                  value={liveCompetitorPrice}
                  onChange={(e) => setLiveCompetitorPrice(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-white font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Row 2: Net Landed Cost & Degraded Mode Controls */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 font-mono text-xs pt-1">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Freight ($)</label>
                <input
                  type="number"
                  step="0.5"
                  value={liveFreightCost}
                  onChange={(e) => setLiveFreightCost(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Payment Fee %</label>
                <input
                  type="number"
                  step="0.1"
                  value={livePaymentFeePct}
                  onChange={(e) => setLivePaymentFeePct(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">RTO Risk Prob</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={liveRtoProb}
                  onChange={(e) => setLiveRtoProb(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">SKU Age (Days)</label>
                <input
                  type="number"
                  value={liveInventoryAgeDays}
                  onChange={(e) => setLiveInventoryAgeDays(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-cyan-300 font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Fallback Mode</label>
                <select
                  value={liveFallbackMode}
                  onChange={(e) => setLiveFallbackMode(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-emerald-300 font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="HARD_HALT">HARD_HALT (422)</option>
                  <option value="TIME_DECAY_FLOOR">TIME_DECAY_FLOOR</option>
                  <option value="HUMAN_APPROVAL_QUEUE">HUMAN_APPROVAL_QUEUE</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Idempotency Key</label>
                <input
                  type="text"
                  placeholder="Optional key"
                  value={liveIdempotencyKey}
                  onChange={(e) => setLiveIdempotencyKey(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-slate-300 font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Chaos / Fault-Injection Toggles & Execute Action Button */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-mono text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={liveSimulateEscrowFail}
                    onChange={(e) => setLiveSimulateEscrowFail(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Escrow Fail (Pre-WMS)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-mono text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={liveSimulateWmsFail}
                    onChange={(e) => setLiveSimulateWmsFail(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer"
                  />
                  <span>WMS Fail (Void Escrow)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-mono text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={liveSimulateCrashBeforeWms}
                    onChange={(e) => setLiveSimulateCrashBeforeWms(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Worker Crash Before WMS</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-mono text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={liveSimulateBurstOverflow}
                    onChange={(e) => setLiveSimulateBurstOverflow(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Burst Overflow (&gt;280 tx/s)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-mono text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={liveForceCircuitBreaker}
                    onChange={(e) => setLiveForceCircuitBreaker(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Strict Circuit Breaker</span>
                </label>
              </div>

              <button
                onClick={() => executeLiveAgentforceCall()}
                disabled={isExecutingLiveCall}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-950 cursor-pointer transition-all active:scale-[0.98] shrink-0"
              >
                {isExecutingLiveCall ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Executing Sharded Outbox...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-cyan-200 fill-cyan-200" />
                    <span>Execute Sharded Action (POST)</span>
                  </>
                )}
              </button>
            </div>

            {/* Live Response Panel */}
            {liveExecutionResult && (
              <div className={`p-4 rounded-xl border text-xs font-mono space-y-3 animate-in fade-in duration-200 ${
                liveExecutionResult.httpStatus === 200
                  ? 'bg-emerald-950/20 border-emerald-800/80 text-emerald-200'
                  : liveExecutionResult.httpStatus === 202
                  ? 'bg-amber-950/20 border-amber-800/80 text-amber-200'
                  : 'bg-rose-950/20 border-rose-800/80 text-rose-200'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      liveExecutionResult.httpStatus === 200
                        ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-700'
                        : liveExecutionResult.httpStatus === 202
                        ? 'bg-amber-900/80 text-amber-300 border border-amber-700'
                        : 'bg-rose-900/80 text-rose-300 border border-rose-700'
                    }`}>
                      HTTP {liveExecutionResult.httpStatus} {liveExecutionResult.payload.status}
                    </span>
                    <span className="text-white font-bold">
                      {liveExecutionResult.httpStatus === 200
                        ? 'Single-Shard Lease + Funds-First Outbox Settled'
                        : liveExecutionResult.payload.status === 'OUTBOX_CRASH_PENDING_REAPER'
                        ? 'Worker Crashed Mid-Flight (Outbox Preserved for Reaper)'
                        : liveExecutionResult.httpStatus === 202
                        ? 'Routed to CFO Human Approval Queue'
                        : liveExecutionResult.httpStatus === 429
                        ? 'Edge Token-Bucket Load Shedding Engaged'
                        : liveExecutionResult.payload.status === 'SAGA_COMPENSATED_ROLLBACK'
                        ? 'Funds-First SAGA Compensating Rollback (Zero Desync)'
                        : 'Circuit Breaker Tripped (Protection Engaged)'}
                    </span>
                    {liveExecutionResult.payload.idempotentReplay && (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px]">
                        IDEMPOTENT REPLAY
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    {liveExecutionResult.payload.shardId && (
                      <span>Shard: <strong className="text-emerald-300 font-mono">{liveExecutionResult.payload.shardId}</strong></span>
                    )}
                    <span>Sync Core: <strong className="text-cyan-300 font-mono">{liveExecutionResult.payload.decisionLockLatencyMs ?? liveExecutionResult.payload.executionLatencyMs ?? 14.6}ms</strong></span>
                    <span>Outbox SAGA: <strong className="text-purple-300 font-mono">{liveExecutionResult.payload.asyncSagaSettlementMs ?? 0}ms</strong></span>
                    {liveExecutionResult.payload.merkleEpochId && (
                      <span>Merkle: <strong className="text-amber-300">{liveExecutionResult.payload.merkleEpochId}</strong></span>
                    )}
                  </div>
                </div>

                {/* Telemetry Strip (Cloud SQL Persistence + Striped Routing + Half-Life EMA + Merkle Root) */}
                {(liveExecutionResult.payload.outboxId || liveExecutionResult.payload.merkleRoot) && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <div className="text-[9px] text-slate-500 uppercase">Outbox &amp; Striped Routing</div>
                      <div className="text-cyan-300 truncate">{liveExecutionResult.payload.outboxId || 'N/A'}</div>
                      <div className="text-[10px] text-slate-400">
                        {liveExecutionResult.payload.outboxStatus} &bull; {liveExecutionResult.payload.concurrency?.routingStrategy || liveExecutionResult.payload.routingStrategy || 'STRIPED_K32'}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-emerald-900/50">
                      <div className="text-[9px] text-slate-500 uppercase">Persistence Engine</div>
                      <div className="text-emerald-300 font-bold truncate">
                        Cloud SQL PostgreSQL
                      </div>
                      <div className="text-[10px] text-slate-400">
                        FOR UPDATE &bull; CHECK &ge; 0
                      </div>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <div className="text-[9px] text-slate-500 uppercase flex items-center justify-between">
                        <span>Half-Life EMA (30s)</span>
                        <button
                          onClick={() => handleWallClockEmaDecay(30000)}
                          disabled={isDecayingEma}
                          className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 cursor-pointer disabled:opacity-50"
                          title="Apply 30s Wall-Clock Half-Life EMA Decay (POST /api/agentforce/ema/decay)"
                        >
                          {isDecayingEma ? '...' : 'Thaw +30s'}
                        </button>
                      </div>
                      <div className="text-emerald-300 font-bold tabular-nums">
                        ${Number(liveExecutionResult.payload.effectiveEgressCost ?? 0.0032).toFixed(5)} + ${Number(liveExecutionResult.payload.expectedVoidCompCost ?? 0).toFixed(5)} void
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Retry: {((liveExecutionResult.payload.emaRetryRate ?? 0) * 100).toFixed(1)}% &bull; Void: {((liveExecutionResult.payload.emaCompensationRate ?? 0) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <div className="text-[9px] text-slate-500 uppercase">Merkle Root ({liveExecutionResult.payload.merkleEpochId})</div>
                      <div className="text-purple-300 truncate">{liveExecutionResult.payload.merkleRoot || 'Pending'}</div>
                      <div className="text-[10px] text-slate-400">SHA-256 Chain + Epoch</div>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-slate-800">
                      <div className="text-[9px] text-slate-500 uppercase">Side-Effect Order</div>
                      <div className="text-white font-bold">Stripe &rarr; FedEx</div>
                      <div className="text-[10px] text-slate-400">
                        {liveExecutionResult.payload.emaRates?.canaryProbeWindowOpen ? 'Canary Probe OPEN' : 'Funds-First Guarantee'}
                      </div>
                    </div>
                  </div>
                )}

                {emaDecayNotice && (
                  <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-800/70 text-cyan-200 text-[11px] flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong>Wall-Clock Half-Life Decay (+{(emaDecayNotice.elapsedSilenceMs ?? 30000) / 1000}s idle):</strong>{' '}
                      Retry EMA {((emaDecayNotice.emaCostTracker?.emaRetryRate ?? 0) * 100).toFixed(2)}% • Void EMA {((emaDecayNotice.emaCostTracker?.emaCompensationRate ?? 0) * 100).toFixed(2)}% • Void Cost ${Number(emaDecayNotice.emaCostTracker?.expectedVoidCompCost ?? 0).toFixed(5)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-900/60 border border-cyan-700 text-[10px] font-bold">
                      Canary Probe: {emaDecayNotice.canaryProbeEligible ? 'ELIGIBLE' : 'COOLED'}
                    </span>
                  </div>
                )}

                {/* Crash Recovery Action Bar when OUTBOX_CRASH_PENDING_REAPER */}
                {liveExecutionResult.payload.status === 'OUTBOX_CRASH_PENDING_REAPER' && (
                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-700/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <div className="text-amber-300 font-bold text-xs">Durable Outbox Preserved Mid-Flight ({liveExecutionResult.payload.outboxId})</div>
                      <p className="text-[11px] text-slate-300 font-sans mt-0.5">{liveExecutionResult.payload.message}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRunOutboxReaper(false)}
                        disabled={isReapingOutbox}
                        className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer disabled:opacity-50"
                      >
                        {isReapingOutbox ? 'Reaping...' : 'Resume Healthy Reaper (SETTLED)'}
                      </button>
                      <button
                        onClick={() => handleRunOutboxReaper(true)}
                        disabled={isReapingOutbox}
                        className="px-3.5 py-2 rounded-lg bg-rose-900/90 hover:bg-rose-800 text-rose-100 border border-rose-700 font-bold text-xs cursor-pointer disabled:opacity-50"
                        title="Simulates 3P brownout: applies Exponential Backoff and trips DEAD_LETTER_RECONCILIATION at maxRetries=3"
                      >
                        Test Backoff &rarr; DLQ Circuit Breaker
                      </button>
                    </div>
                  </div>
                )}

                {reaperResult && (
                  <div className={`p-3 rounded-lg border text-xs space-y-2 ${
                    reaperResult.deadLetterIds?.length > 0
                      ? 'bg-rose-950/30 border-rose-700/70 text-rose-200'
                      : reaperResult.deferredBackoffIds?.length > 0
                      ? 'bg-amber-950/30 border-amber-700/70 text-amber-200'
                      : 'bg-emerald-950/30 border-emerald-700/70 text-emerald-200'
                  }`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                      <div>
                        <div className="font-bold">
                          Reaper Cycle ({reaperResult.reaperLatencyMs}ms): Settled={reaperResult.recoveredCount ?? 0} • Exponential Backoff Deferred={reaperResult.deferredBackoffIds?.length ?? 0} • DLQ Circuit-Breaker={reaperResult.deadLetterIds?.length ?? 0}
                        </div>
                        <div className="text-[10px] text-slate-300 mt-0.5">
                          {reaperResult.deadLetterIds?.length > 0
                            ? `Tripped DEAD_LETTER_RECONCILIATION (${reaperResult.deadLetterIds.join(', ')}) — Run Autonomous Ground-Truth DLQ Sweeper to reconcile at $0 human labor.`
                            : reaperResult.deferredBackoffIds?.length > 0
                            ? `3P Brownout active (${reaperResult.deferredBackoffIds.join(', ')}) — Exponential backoff applied (maxRetries=3) to stop reaper retry storms. Click again to step retries to DLQ.`
                            : `Anchored Recovery Epoch: ${reaperResult.merkleEpoch?.epochId} (${reaperResult.merkleEpoch?.merkleRoot})`}
                        </div>
                      </div>
                      {reaperResult.deadLetterIds?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleSweepDlq(false)}
                            disabled={isSweepingDlq}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[11px] cursor-pointer disabled:opacity-50"
                          >
                            {isSweepingDlq ? 'Sweeping...' : 'Auto-Sweep DLQ ($0 Human OPEX)'}
                          </button>
                          <button
                            onClick={() => handleSweepDlq(true)}
                            disabled={isSweepingDlq}
                            className="px-3 py-1.5 rounded-lg bg-purple-900/80 hover:bg-purple-800 text-purple-100 border border-purple-700 font-bold text-[11px] cursor-pointer disabled:opacity-50"
                          >
                            Simulate Byzantine Split-Brain
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {dlqSweepResult && (
                  <div className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                    dlqSweepResult.byzantineEscalatedIds?.length > 0
                      ? 'bg-purple-950/30 border-purple-700/80 text-purple-200'
                      : 'bg-emerald-950/30 border-emerald-700/80 text-emerald-200'
                  }`}>
                    <div className="font-bold">
                      Autonomous DLQ Sweeper ({dlqSweepResult.sweepLatencyMs}ms): Zero-Human Cleared={dlqSweepResult.zeroHumanOpexCount ?? 0} (Auto-Void={dlqSweepResult.autoReconciledVoidedIds?.length ?? 0}, Auto-Settled={dlqSweepResult.autoPromotedSettledIds?.length ?? 0}) • Byzantine Batched={dlqSweepResult.byzantineEscalatedIds?.length ?? 0}
                    </div>
                    {dlqSweepResult.auditVelocity && (
                      <div className="text-[10px] text-slate-300">
                        Audit Velocity Formula ({dlqSweepResult.auditVelocity.totalTxPerSec} tx/s, {(dlqSweepResult.auditVelocity.dlqRate * 100).toFixed(1)}% DLQ):{' '}
                        <strong className="text-emerald-300">{dlqSweepResult.auditVelocity.autoReconciledPct}% Machine-Reconciled</strong> &bull;{' '}
                        <strong className="text-cyan-300">{dlqSweepResult.auditVelocity.requiredFtes} FTEs Required</strong> (vs ~4,000 FTEs manual) &bull;{' '}
                        Human OPEX: <strong>${dlqSweepResult.auditVelocity.humanOpexPerTxUsd}/tx</strong>
                      </div>
                    )}
                  </div>
                )}

                {liveExecutionResult.httpStatus === 200 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-300">
                      <div className="p-2.5 rounded-lg bg-black/50 border border-emerald-900/40">
                        <div className="text-[10px] text-slate-400 uppercase">Cleared ({liveExecutionResult.payload.shardId} #{liveExecutionResult.payload.concurrency?.fencingToken})</div>
                        <div className="text-sm font-bold text-white tabular-nums">
                          {liveExecutionResult.payload.metrics?.unitsCleared} / {liveExecutionResult.payload.metrics?.unitsRequested} ({liveExecutionResult.payload.metrics?.fillRatePct}%)
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/50 border border-emerald-900/40">
                        <div className="text-[10px] text-slate-400 uppercase">Cleared vs Landed COGS</div>
                        <div className="text-sm font-bold text-emerald-300 tabular-nums">
                          ${liveExecutionResult.payload.metrics?.effectiveClearingPrice} ({liveExecutionResult.payload.metrics?.realizedMarginPct}% CM3)
                        </div>
                        <div className="text-[10px] text-slate-400">C_landed: ${liveExecutionResult.payload.metrics?.totalLandedCogs} | Floor: {liveExecutionResult.payload.metrics?.effectiveMarginFloorPct}%</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/50 border border-emerald-900/40">
                        <div className="text-[10px] text-slate-400 uppercase">Gross Proceeds &amp; Egress</div>
                        <div className="text-sm font-bold text-cyan-300 tabular-nums">
                          ${liveExecutionResult.payload.metrics?.grossProceeds?.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">EMA Overhead: {liveExecutionResult.payload.metrics?.computeEgressOverheadPerTx}/tx</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/50 border border-emerald-900/40">
                        <div className="text-[10px] text-slate-400 uppercase">Zero-PII Token &amp; SAGA Refs</div>
                        <div className="text-[11px] text-slate-300 truncate font-mono">
                          {liveExecutionResult.payload.subjectToken}
                        </div>
                        <div className="text-[10px] text-purple-400 truncate">
                          {liveExecutionResult.payload.settlement?.escrowHoldId} &rarr; {liveExecutionResult.payload.settlement?.wmsDispatchRef}
                        </div>
                      </div>
                    </div>

                    {liveExecutionResult.payload.saga?.steps && (
                      <div className="p-3 rounded-lg bg-black/50 border border-slate-800 space-y-1.5">
                        <div className="text-[10px] uppercase text-cyan-400 font-bold">Funds-First Single-Shard Outbox Trace ({liveExecutionResult.payload.sagaId})</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                          {liveExecutionResult.payload.saga.steps.map((st: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-900/70 border border-slate-800 text-[10px]">
                              <span className="text-white font-semibold">{st.phase}: {st.step}</span>
                              <span className="text-emerald-400 tabular-nums">{st.status} ({st.latencyMs}ms)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-black/40 border border-rose-900/60 text-rose-200 text-xs">
                      <p className="font-sans font-medium">{liveExecutionResult.payload.error || liveExecutionResult.payload.message}</p>
                    </div>
                    {liveExecutionResult.payload.saga?.steps && (
                      <div className="p-3 rounded-lg bg-black/60 border border-purple-800/60 space-y-1.5">
                        <div className="text-[10px] uppercase text-purple-300 font-bold">Funds-First SAGA Execution &amp; Compensation Trace ({liveExecutionResult.payload.sagaId})</div>
                        <div className="space-y-1">
                          {liveExecutionResult.payload.saga.steps.map((st: any, idx: number) => (
                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between px-2.5 py-1.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] gap-1">
                              <span className="text-white font-semibold">[{st.phase}] {st.step} — <span className="text-slate-400 font-normal">{st.detail}</span></span>
                              <span className={`font-bold shrink-0 ${st.status === 'FAILED' ? 'text-rose-400' : st.status === 'COMPENSATED' ? 'text-amber-300' : 'text-emerald-400'}`}>
                                {st.status} ({st.latencyMs}ms)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Raw JSON Payload Collapsible */}
                <details className="mt-2 text-[11px] text-slate-400">
                  <summary className="cursor-pointer hover:text-white transition-colors">View Full Response JSON &amp; Merkle Epoch Proof</summary>
                  <pre className="mt-2 p-3 rounded-lg bg-black/80 border border-slate-800 text-slate-300 overflow-x-auto text-[10px] leading-relaxed max-h-48">
                    {JSON.stringify(liveExecutionResult.payload, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>

          {/* Code Viewer Panel */}
          <div className="p-5 rounded-xl bg-black/60 border border-slate-800 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
              <span className="flex items-center gap-2 text-white font-bold">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>agentforce-action-spec.json</span>
              </span>
              <span className="text-[11px] text-slate-500">OpenAPI 3.1 • JSON-Schema Compliant</span>
            </div>
            <pre className="text-slate-300 overflow-x-auto p-2 bg-[#080C14] rounded-lg border border-slate-900 text-[11px] leading-relaxed max-h-96">
              {JSON.stringify(agentforceSpecJson, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 4: SECURITY BASELINE & TENANCY ARCHITECTURE */}
      {currentTab === 'security_baseline' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="p-5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-purple-400 tracking-wider">
                ENTERPRISE PROCUREMENT & SECURITY BASELINE
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-800">
                  AUDIT CLEARED
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 text-[10px] font-mono font-bold border border-blue-800">
                  SHA-256 CHAIN: {isChainValid ? '100% VALID' : 'CHECKING'}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Architectural security specs designed to clear enterprise security reviews and CISO procurement gates upfront. Enforces cryptographic multi-tenancy, Zero-PII ingestion, and non-repudiation audit trails.
            </p>
          </div>

          {/* 4 Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            <div className="p-4 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2">
              <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tenancy Isolation</span>
              </div>
              <div className="text-sm font-bold text-white font-sans">Row-Level Cryptographic Isolation</div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                Zero shared tables without tenant key partition. Tenant KMS keys rotated every 90 days with customer-managed keys (BYOK) supported.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2">
              <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Data Handling & PII</span>
              </div>
              <div className="text-sm font-bold text-white font-sans">Zero-PII Storage Policy</div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                Customer identifiable attributes stripped at API edge before AI evaluation. AES-256-GCM encryption at rest, TLS 1.3 in flight with MTLS.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2">
              <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>Auth &amp; Erasure Controls</span>
              </div>
              <div className="text-sm font-bold text-white font-sans">Firebase Auth &amp; Edge Crypto-Shredding</div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                Every protected API route verifies Google Sign-In ID tokens via firebase-admin. Subject KMS key references shred cleanly without breaking audit hashes.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-2">
              <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Tamper-Evident Logs</span>
              </div>
              <div className="text-sm font-bold text-white font-sans">Immutable SHA-256 Hash Chain</div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                Each clearance, compensation, and guardrail halt appends a previousHash-linked SHA-256 block into PostgreSQL audit_blocks.
              </p>
            </div>
          </div>

          {/* Bounded 32-Shard Escrow Sub-Lot & Merkle Epoch Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-mono">
            <div className="p-5 rounded-xl bg-[#0B0F17] border border-emerald-800/60 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <div className="text-[10px] uppercase font-bold text-emerald-400">STRIPED INVENTORY SUB-LOT SHARDS (K=32)</div>
                  <div className="text-sm font-bold text-white font-sans">PostgreSQL SELECT ... FOR UPDATE (CHECK available_units &ge; 0)</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReplenishLots(liveSku || 'SKU-ANC-PRO-09')}
                    disabled={!user || isReplenishingLots}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] cursor-pointer disabled:opacity-50"
                  >
                    {isReplenishingLots ? '...' : 'Replenish'}
                  </button>
                  <span className="text-xs text-cyan-300 font-bold tabular-nums">
                    {shardSummary ? `${shardSummary.totalAvailableUnits?.toLocaleString()} Avail` : 'Sign in'}
                  </span>
                </div>
              </div>
              {shardSummary?.shards && (
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 text-[10px]">
                  {shardSummary.shards.slice(0, 16).map((sh: any) => (
                    <div key={sh.shardId} className="p-1.5 rounded bg-black/50 border border-slate-800 text-center">
                      <div className="text-slate-400">#{String(sh.shardIndex).padStart(2, '0')}</div>
                      <div className="text-emerald-300 font-bold tabular-nums">{sh.availableUnits}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 pt-1">
                <span>Half-Life EMA: <strong className="text-cyan-300">${Number(shardSummary?.emaCostTracker?.effectiveEgressCost ?? 0.0032).toFixed(5)} + ${Number(shardSummary?.emaCostTracker?.expectedVoidCompCost ?? 0).toFixed(5)}</strong></span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleWallClockEmaDecay(30000)}
                    disabled={isDecayingEma}
                    className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 cursor-pointer disabled:opacity-50"
                  >
                    {isDecayingEma ? 'Thawing...' : 'Thaw EMA (+30s)'}
                  </button>
                  <button
                    onClick={() => handleSweepDlq(false)}
                    disabled={isSweepingDlq}
                    className="px-2 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 cursor-pointer disabled:opacity-50"
                  >
                    {isSweepingDlq ? 'Sweeping...' : 'Sweep DLQ'}
                  </button>
                  <span>Edge Sheds (429): <strong className="text-amber-300">{shardSummary?.edgeAdmissionController?.shedCount ?? 0}</strong></span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#0B0F17] border border-purple-800/60 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <div className="text-[10px] uppercase font-bold text-purple-400">MERKLE EPOCH ANCHORING</div>
                  <div className="text-sm font-bold text-white font-sans">SHA-256 Transaction Leaves + Merkle Root Seals</div>
                </div>
                <span className="text-xs text-purple-300 font-bold">{merkleEpochs.length} Epochs Sealed</span>
              </div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto text-[10px]">
                {merkleEpochs.slice(0, 4).map((ep: any) => (
                  <div key={ep.epochId} className="flex items-center justify-between p-2 rounded bg-black/40 border border-slate-800">
                    <span className="text-white font-bold">{ep.epochId} ({ep.leafCount} leaves)</span>
                    <span className="text-cyan-300 truncate max-w-[160px]">{ep.merkleRoot}</span>
                    <span className="text-emerald-400 tabular-nums">{ep.batchLatencyMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* GDPR Crypto-Shredding Tester (Resolves Audit Immutable Ledger vs Right-to-Erasure Contradiction) */}
          <div className="p-5 rounded-xl bg-[#0B0F17] border border-cyan-800/60 space-y-4 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                  GDPR RIGHT-TO-ERASURE VIA EDGE CRYPTO-SHREDDING (&lt;1MS)
                </div>
                <h3 className="text-sm font-bold text-white font-sans mt-0.5">
                  Destroy Subject KMS Key Without Breaking SHA-256 &amp; Merkle Integrity
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shredTarget}
                  onChange={(e) => setShredTarget(e.target.value)}
                  placeholder="buyer-enterprise-01"
                  className="px-3 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-white text-xs w-48 focus:outline-hidden focus:border-cyan-500"
                />
                <button
                  onClick={() => handleExecuteCryptoShred()}
                  disabled={isShredding}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isShredding ? 'Shredding...' : 'Shred KMS Key'}
                </button>
              </div>
            </div>

            {activeEdgeTokens.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
                {activeEdgeTokens.map((tok, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-black/40 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-white font-bold">{tok.subjectId} &rarr; <span className="text-cyan-300">{tok.subjectToken}</span></div>
                      <div className="text-[10px] text-slate-400">Edge Vault KMS: {tok.kmsKeyId}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      tok.shredded
                        ? 'bg-rose-950 text-rose-300 border-rose-800'
                        : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    }`}>
                      {tok.shredded ? 'SHREDDED (0x0000)' : 'ACTIVE KMS'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {shredResult && (
              <div className={`p-3 rounded-lg border text-[11px] ${
                shredResult.success ? 'bg-emerald-950/20 border-emerald-800 text-emerald-200' : 'bg-rose-950/20 border-rose-800 text-rose-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {shredResult.success
                      ? `Shredded ${shredResult.subjectToken} in ${shredResult.erasureLatencyMs}ms — SHA-256 Chain Integrity: ${shredResult.chainIntegrityValid ? '100% VALID' : 'INVALID'}`
                      : shredResult.error}
                  </span>
                </div>
                {shredResult.complianceNote && (
                  <p className="text-[10px] text-slate-300 font-sans mt-1">{shredResult.complianceNote}</p>
                )}
              </div>
            )}
          </div>

          {/* Live Immutable Cryptographic Audit Ledger */}
          <div className="p-5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-3 font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Live Zero-PII Cryptographic Audit Trail (/api/agentforce/audit-trail)</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{auditLedger.length} Verified Blocks</span>
                </span>
                <button
                  onClick={() => {
                    fetchAuditLedger();
                    audioVibe.playClick();
                  }}
                  disabled={isLedgerLoading}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-700 cursor-pointer"
                >
                  <RotateCcw className={`w-3 h-3 ${isLedgerLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh Ledger</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Height</th>
                    <th className="py-2.5 px-3">Timestamp (UTC)</th>
                    <th className="py-2.5 px-3">Subject Token (Zero-PII)</th>
                    <th className="py-2.5 px-3">Action Signature</th>
                    <th className="py-2.5 px-3">Guardrail / SAGA</th>
                    <th className="py-2.5 px-3">Units &amp; Price</th>
                    <th className="py-2.5 px-3">Gross Value</th>
                    <th className="py-2.5 px-3">Sync / SAGA</th>
                    <th className="py-2.5 px-3">SHA-256 Block Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-[11px]">
                  {auditLedger.map((block, idx) => (
                    <tr key={block.blockHash || idx} className="hover:bg-slate-900/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-cyan-400">
                        #{block.blockHeight}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">
                        {block.timestamp ? new Date(block.timestamp).toLocaleTimeString() : 'Just Now'}
                      </td>
                      <td className="py-2.5 px-3 text-cyan-300 font-mono text-[10px]">
                        {block.subjectToken || 'tok_zp_anonymized'}
                      </td>
                      <td className="py-2.5 px-3 text-white font-semibold">
                        <div className="font-mono text-[11px]">{block.action}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{block.skuId}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                          block.guardrailStatus === 'VERIFIED_PASSED' || block.guardrailStatus === 'TIME_DECAY_CLEARED'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : block.guardrailStatus === 'SAGA_COMPENSATED_ROLLBACK'
                            ? 'bg-purple-950 text-purple-300 border-purple-800'
                            : block.guardrailStatus === 'PENDING_CFO_OVERRIDE'
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : 'bg-rose-950 text-rose-300 border-rose-800'
                        }`}>
                          {block.guardrailStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-slate-300">
                        {block.unitsCleared} units @ ${block.clearingPrice}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums font-bold text-emerald-400">
                        ${block.grossProceeds?.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-slate-400">
                        {block.decisionLockLatencyMs ?? block.latencyMs}ms / {block.asyncSagaSettlementMs ?? 0}ms
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px] truncate max-w-[120px]" title={block.blockHash}>
                        {block.blockHash?.substring(0, 14)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

          {/* TAB 5: TECHNICAL DOSSIER FOR EXPERT REVIEW (HONEST ARCHITECTURE BASELINE) */}
          {currentTab === 'technical_dossier' && (
            <div className="space-y-6">
              {/* Header Action Bar */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-blue-950/80 border border-cyan-800/60 shadow-xl space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-mono font-bold tracking-wider">
                        ARCHITECTURE BASELINE SPECIFICATION
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold">
                        CLOUD SQL + FIREBASE AUTH
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white font-sans mt-1">
                      NEXUS Commerce OS — Engineering Architecture &amp; Benchmark Dossier
                    </h2>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed max-w-3xl">
                      Documents exact implemented behavior: single-region Cloud SQL for PostgreSQL ACID locking (`SELECT ... FOR UPDATE` on K=32 striped sub-lot rows + SQL `CHECK` constraints), Firebase Auth Bearer token verification, deterministic CM3 margin guardrails (`commerceLogic.ts`), simulated Stripe/FedEx SAGA fault states, and the real concurrent load benchmark endpoint.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 font-mono text-xs">
                    <a
                      href="/Nexus_Enterprise_Technical_Dossier.pdf"
                      download="Nexus_Enterprise_Technical_Dossier.pdf"
                      onClick={() => audioVibe.playChimeSuccess()}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-cyan-950 cursor-pointer transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download 4-Page PDF</span>
                    </a>
                    <button
                      onClick={() => {
                        audioVibe.playClick();
                        window.print();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <Printer className="w-4 h-4 text-slate-300" />
                      <span>Print View</span>
                    </button>
                  </div>
                </div>

                {/* Honest Boundary Summary Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="p-3 rounded-lg bg-black/40 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Primary Persistence</div>
                    <div className="font-bold text-cyan-300">Cloud SQL PostgreSQL</div>
                    <div className="text-[10px] text-slate-500">Single-Region Primary ACID</div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/40 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Access Control</div>
                    <div className="font-bold text-emerald-400">Firebase Google Auth</div>
                    <div className="text-[10px] text-slate-500">Server-Verified ID Tokens</div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/40 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Self-Thawing EMA</div>
                    <div className="font-bold text-white">30s Decay + $0.05 Cap</div>
                    <div className="text-[10px] text-emerald-400">422 Halts Excluded</div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/40 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">3P Connectors &amp; DLQ</div>
                    <div className="font-bold text-purple-300">Simulated State Machine</div>
                    <div className="text-[10px] text-slate-500">Stripe/FedEx Fault Injection</div>
                  </div>
                </div>
              </div>

              {/* Dossier Document Body */}
              <div className="space-y-6 text-slate-200">
                <div className="p-6 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-3 font-sans">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <div className="w-2 h-4 bg-cyan-400 rounded-xs" />
                    <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                      1. Implemented Architecture vs. Simulated &amp; Analytical Scope
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Every persistent state table (`inventory_sub_lots`, `outbox_records`, `audit_blocks`, `idempotency_keys`, `edge_pii_vault`, `merkle_epochs`, `ema_state`, `benchmark_runs`, `users`) executes inside Cloud SQL for PostgreSQL using Drizzle ORM and SQL `CHECK` constraints (`available_units &gt;= 0`, `reserved_units &gt;= 0`). No volatile in-memory fallback hides persistence behavior.
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Latency and throughput figures in the benchmark panel are measured directly from live concurrent PostgreSQL ACID transactions on the active instance (`POST /api/agentforce/benchmark/run`) rather than hard-coded targets. External Stripe Escrow and FedEx WMS connectors remain simulated state machines for deterministic crash/compensation testing, and compliance certifications (SOC 2 Type II, FedRAMP) are explicitly not claimed.
                  </p>
                </div>

                {/* Bottom Call to Action */}
                <div className="p-6 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-black border border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono">
                  <div>
                    <div className="text-emerald-400 font-bold text-sm">Updated 4-Page Technical Dossier PDF Available</div>
                    <div className="text-xs text-slate-400 font-sans">
                      Reflects single-region Cloud SQL PostgreSQL ACID locking, Firebase Auth, deterministic CM3 economics, simulated 3P fault modes, and live concurrent benchmarking.
                    </div>
                  </div>
                  <a
                    href="/Nexus_Enterprise_Technical_Dossier.pdf"
                    download="Nexus_Enterprise_Technical_Dossier.pdf"
                    onClick={() => audioVibe.playChimeSuccess()}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold flex items-center justify-center gap-2 text-xs shadow-lg shadow-emerald-950 cursor-pointer transition-all shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Technical Dossier PDF</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: LIVE STRIPE ESCROW, SIGNED SHOPIFY WEBHOOKS & MULTI-TENANT RBAC */}
          {currentTab === 'live_connectors' && (
            <div className="space-y-6">
              {/* Top Mode & Isolation Banner */}
              <div className="p-6 rounded-2xl bg-[#0B0F17] border border-emerald-800/60 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap font-mono text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold uppercase">
                        MULTI-TENANT WORKSPACE
                      </span>
                      <span className={`px-2 py-0.5 rounded border font-bold uppercase ${
                        stripeLiveConfigured
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : 'bg-amber-950 text-amber-300 border-amber-700'
                      }`}>
                        {stripeLiveConfigured ? 'STRIPE: LIVE API CONFIGURED' : 'STRIPE: SIMULATED FALLBACK (NO ENV KEY)'}
                      </span>
                      <span className={`px-2 py-0.5 rounded border font-bold uppercase ${
                        tenantConfig?.shopifyAdminConfigured
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : 'bg-amber-950 text-amber-300 border-amber-700'
                      }`}>
                        {tenantConfig?.shopifyAdminConfigured
                          ? 'SHOPIFY ADMIN HOLD: LIVE API'
                          : 'SHOPIFY ADMIN HOLD: LOCAL POLICY (NO ADMIN TOKEN)'}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white font-sans">
                      Live Stripe Manual-Capture Escrow &amp; Signed Shopify Webhook Guardrail
                    </h2>
                    <p className="text-xs text-slate-300 font-sans max-w-3xl">
                      Configures tenant-isolated Shopify HMAC-SHA256 verification (encrypted AES-256-GCM in Cloud SQL) and tracks Stripe <code>capture_method: &apos;manual&apos;</code> holds before fulfillment dispatch.
                    </p>
                  </div>
                  <div className="font-mono text-xs bg-black/50 border border-slate-800 rounded-lg px-3.5 py-2.5 shrink-0">
                    <div className="text-[10px] text-slate-400 uppercase">Active Tenant Webhook URL</div>
                    <div className="text-emerald-300 font-semibold break-all">
                      /api/webhooks/shopify/{tenantConfig?.tenantId || 'sign-in-required'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tenant Configuration + Shopify Signed Webhook Test Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Tenant Connector Settings (Admin RBAC) */}
                <div className="p-5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-4 font-mono">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      1. Shopify Webhook &amp; Margin Guardrail Settings
                    </span>
                    <span className="text-[10px] text-emerald-400">
                      {tenantConfig?.shopifyWebhookSecretConfigured
                        ? `Secret Saved (${tenantConfig.shopifyWebhookSecretPreview})`
                        : 'Secret Not Set'}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase block mb-1">Shopify Store Domain</label>
                      <input
                        type="text"
                        value={cfgDomainInput}
                        onChange={(e) => setCfgDomainInput(e.target.value)}
                        placeholder="your-store.myshopify.com"
                        className="w-full px-3 py-2 rounded-lg bg-black/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase block mb-1">Default CM3 Floor (%)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="75"
                          value={cfgFloorInput}
                          onChange={(e) => setCfgFloorInput(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg bg-black/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase block mb-1">Shopify Webhook Secret (AES-256-GCM)</label>
                        <input
                          type="password"
                          value={cfgSecretInput}
                          onChange={(e) => setCfgSecretInput(e.target.value)}
                          placeholder={tenantConfig?.shopifyWebhookSecretConfigured ? 'Enter new secret to rotate' : 'shpss_...'}
                          className="w-full px-3 py-2 rounded-lg bg-black/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {tenantSaveBanner && (
                      <div className="text-[11px] text-emerald-300 bg-emerald-950/50 border border-emerald-800/70 rounded px-3 py-2">
                        {tenantSaveBanner}
                      </div>
                    )}

                    <button
                      disabled={!user || isSavingTenantCfg}
                      onClick={async () => {
                        const headers = await requireAuthHeaders();
                        if (!headers) return;
                        setIsSavingTenantCfg(true);
                        setTenantSaveBanner(null);
                        try {
                          const res = await fetch('/api/tenant/config', {
                            method: 'PUT',
                            headers,
                            body: JSON.stringify({
                              shopifyShopDomain: cfgDomainInput,
                              defaultMarginFloorPct: cfgFloorInput,
                              ...(cfgSecretInput.trim() ? { shopifyWebhookSecret: cfgSecretInput.trim() } : {}),
                            }),
                          });
                          const data = await res.json();
                          if (res.ok && data.config) {
                            setTenantConfig(data.config);
                            setCfgSecretInput('');
                            setTenantSaveBanner('Saved encrypted tenant config in Cloud SQL.');
                          } else {
                            setTenantSaveBanner(data.error || 'Failed to save tenant configuration');
                          }
                        } finally {
                          setIsSavingTenantCfg(false);
                        }
                      }}
                      className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold cursor-pointer transition-colors"
                    >
                      {isSavingTenantCfg ? 'Saving Config...' : 'Save Encrypted Tenant Config (Admin Only)'}
                    </button>
                  </div>
                </div>

                {/* Right: Real HMAC-SHA256 Signed Webhook Verification Runner */}
                <div className="p-5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-4 font-mono">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      2. Real Raw-Body HMAC-SHA256 Webhook Test
                    </span>
                    <span className="text-[10px] text-cyan-400">timingSafeEqual Verified</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans">
                    Signs an authentic Shopify <code>orders/create</code> JSON payload with your saved secret and dispatches it to <code>/api/webhooks/shopify/{tenantConfig?.tenantId || '...'}</code>.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <button
                      disabled={!user || isTestingShopifyWebhook}
                      onClick={async () => {
                        const headers = await requireAuthHeaders();
                        if (!headers) return;
                        setIsTestingShopifyWebhook(true);
                        setShopifyWebhookTestOutcome(null);
                        try {
                          const res = await fetch('/api/integrations/shopify/test-signed-webhook', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ orderPrice: 239, discountAmount: 0, units: 1, tamperHmac: false }),
                          });
                          const data = await res.json();
                          setShopifyWebhookTestOutcome(data);
                          void fetchAuditLedger();
                        } finally {
                          setIsTestingShopifyWebhook(false);
                        }
                      }}
                      className="px-3 py-2.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 font-bold cursor-pointer disabled:opacity-50"
                    >
                      Valid Sig ($239 Clear)
                    </button>

                    <button
                      disabled={!user || isTestingShopifyWebhook}
                      onClick={async () => {
                        const headers = await requireAuthHeaders();
                        if (!headers) return;
                        setIsTestingShopifyWebhook(true);
                        setShopifyWebhookTestOutcome(null);
                        try {
                          const res = await fetch('/api/integrations/shopify/test-signed-webhook', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ orderPrice: 239, discountAmount: 49, units: 1, tamperHmac: false }),
                          });
                          const data = await res.json();
                          setShopifyWebhookTestOutcome(data);
                          void fetchAuditLedger();
                        } finally {
                          setIsTestingShopifyWebhook(false);
                        }
                      }}
                      className="px-3 py-2.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-700 text-amber-200 font-bold cursor-pointer disabled:opacity-50"
                    >
                      Steep Discount (Hold)
                    </button>

                    <button
                      disabled={!user || isTestingShopifyWebhook}
                      onClick={async () => {
                        const headers = await requireAuthHeaders();
                        if (!headers) return;
                        setIsTestingShopifyWebhook(true);
                        setShopifyWebhookTestOutcome(null);
                        try {
                          const res = await fetch('/api/integrations/shopify/test-signed-webhook', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ orderPrice: 239, discountAmount: 0, units: 1, tamperHmac: true }),
                          });
                          const data = await res.json();
                          setShopifyWebhookTestOutcome(data);
                          void fetchAuditLedger();
                        } finally {
                          setIsTestingShopifyWebhook(false);
                        }
                      }}
                      className="px-3 py-2.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-200 font-bold cursor-pointer disabled:opacity-50"
                    >
                      Tampered Sig (401)
                    </button>
                  </div>

                  {shopifyWebhookTestOutcome && (
                    <pre className="p-3 rounded-lg bg-black/70 border border-slate-800 text-[11px] text-slate-200 overflow-x-auto max-h-40">
                      {JSON.stringify(shopifyWebhookTestOutcome, null, 2)}
                    </pre>
                  )}
                </div>
              </div>

              {/* Stripe Manual-Capture Escrow Ledger */}
              <div className="p-5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-3 font-mono">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    3. Stripe Manual-Capture Escrow Ledger (stripe_escrow_transactions)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {stripeEscrows.length} persisted holds
                  </span>
                </div>
                {stripeEscrows.length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center">
                    Execute a clearance or signed Shopify webhook to inspect Stripe manual-capture records.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2 pr-3">PaymentIntent ID</th>
                          <th className="py-2 pr-3">Mode</th>
                          <th className="py-2 pr-3">Amount</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 text-right">Manual Settlement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {stripeEscrows.map((esc: any) => (
                          <tr key={esc.escrowRef}>
                            <td className="py-2 pr-3 text-cyan-300">{esc.paymentIntentId}</td>
                            <td className="py-2 pr-3 text-slate-300">{esc.mode}</td>
                            <td className="py-2 pr-3 text-white">${(Number(esc.amountCents || 0) / 100).toFixed(2)}</td>
                            <td className="py-2 pr-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                esc.status === 'succeeded'
                                  ? 'bg-emerald-950 text-emerald-300'
                                  : esc.status === 'canceled'
                                  ? 'bg-rose-950 text-rose-300'
                                  : 'bg-amber-950 text-amber-300'
                              }`}>
                                {esc.status}
                              </span>
                            </td>
                            <td className="py-2 text-right space-x-2">
                              {esc.status === 'requires_capture' && (
                                <>
                                  <button
                                    disabled={settlingEscrowRef === esc.escrowRef}
                                    onClick={async () => {
                                      const headers = await requireAuthHeaders();
                                      if (!headers) return;
                                      setSettlingEscrowRef(esc.escrowRef);
                                      try {
                                        await fetch('/api/integrations/stripe-escrow/settle', {
                                          method: 'POST',
                                          headers,
                                          body: JSON.stringify({ escrowRef: esc.escrowRef, action: 'capture' }),
                                        });
                                        void fetchAuditLedger();
                                      } finally {
                                        setSettlingEscrowRef(null);
                                      }
                                    }}
                                    className="px-2 py-1 rounded bg-emerald-500/90 hover:bg-emerald-400 text-black font-bold text-[10px] cursor-pointer"
                                  >
                                    Capture
                                  </button>
                                  <button
                                    disabled={settlingEscrowRef === esc.escrowRef}
                                    onClick={async () => {
                                      const headers = await requireAuthHeaders();
                                      if (!headers) return;
                                      setSettlingEscrowRef(esc.escrowRef);
                                      try {
                                        await fetch('/api/integrations/stripe-escrow/settle', {
                                          method: 'POST',
                                          headers,
                                          body: JSON.stringify({ escrowRef: esc.escrowRef, action: 'cancel' }),
                                        });
                                        void fetchAuditLedger();
                                      } finally {
                                        setSettlingEscrowRef(null);
                                      }
                                    }}
                                    className="px-2 py-1 rounded bg-rose-900 hover:bg-rose-800 text-rose-100 font-bold text-[10px] cursor-pointer"
                                  >
                                    Void
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Shopify Webhook Audit Log & Tenant RBAC Members */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
                <div className="p-5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-white border-b border-slate-800 pb-2">
                    4. Shopify Webhook Guardrail Log (shopify_webhook_events)
                  </div>
                  {shopifyEvents.length === 0 ? (
                    <div className="text-xs text-slate-400 py-4 text-center">No Shopify webhook events logged yet.</div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto text-[11px]">
                      {shopifyEvents.map((evt: any) => (
                        <div key={evt.eventId} className="p-2.5 rounded bg-black/50 border border-slate-800 flex items-center justify-between gap-2">
                          <div>
                            <div className="text-white font-semibold">
                              {evt.orderNumber} · {evt.skuId} ({evt.units}u · ${Number(evt.totalPrice).toFixed(2)})
                            </div>
                            <div className="text-slate-400 text-[10px]">
                              HMAC: {evt.hmacVerified ? 'VERIFIED' : 'INVALID'} · Margin: {evt.marginPct}% · Action: {evt.fulfillmentAction}
                            </div>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            evt.fulfillmentAction === 'RELEASED'
                              ? 'bg-emerald-950 text-emerald-300'
                              : 'bg-rose-950 text-rose-300'
                          }`}>
                            {evt.guardrailStatus}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-5 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-white border-b border-slate-800 pb-2">
                    5. Tenant Members &amp; RBAC Enforcement
                  </div>
                  <div className="space-y-2 text-[11px]">
                    {tenantMembers.map((m: any) => (
                      <div key={m.uid} className="p-2.5 rounded bg-black/50 border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-white font-semibold">{m.email}</div>
                          <div className="text-slate-500 text-[10px]">UID: {m.uid}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold uppercase text-[10px]">
                          {m.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };
