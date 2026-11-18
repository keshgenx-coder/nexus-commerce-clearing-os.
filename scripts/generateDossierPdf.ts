import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

export function generateTechnicalDossierPdf(outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 45, bottom: 45, left: 45, right: 45 },
      bufferPages: true,
      info: {
        Title: 'NEXUS Autonomous Commerce OS - Architecture & Benchmark Dossier',
        Author: 'NEXUS Engineering Team',
        Subject: 'Cloud SQL PostgreSQL ACID Sub-Lots, Firebase Auth, Deterministic CM3 Guardrails, & Concurrent Benchmark',
        Keywords: 'Cloud SQL PostgreSQL, SELECT FOR UPDATE, Firebase Auth, CM3 Guardrail, Half-Life EMA, Outbox SAGA',
        CreationDate: new Date()
      }
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Palette
    const NAVY = '#0B1120';
    const PRIMARY_BLUE = '#1E3A8A';
    const ACCENT_CYAN = '#0284C7';
    const ACCENT_EMERALD = '#047857';
    const ACCENT_AMBER = '#B45309';
    const ACCENT_PURPLE = '#6D28D9';
    const ACCENT_ROSE = '#BE123C';
    const TEXT_DARK = '#0F172A';
    const TEXT_MUTED = '#475569';
    const BG_LIGHT = '#F8FAFC';
    const BORDER_COLOR = '#CBD5E1';

    const sectionHeader = (num: string, title: string, accent: string = ACCENT_CYAN) => {
      doc.moveDown(0.7);
      const startY = doc.y;
      doc.rect(doc.page.margins.left, startY, 4, 18).fill(accent);
      doc.fontSize(12.0).fillColor(NAVY).font('Helvetica-Bold')
         .text(`${num}. ${title.toUpperCase()}`, doc.page.margins.left + 12, startY + 2);
      doc.moveDown(0.5);
    };

    const calloutBox = (
      title: string,
      content: string,
      borderColor: string = ACCENT_CYAN,
      bgColor: string = BG_LIGHT,
      height: number = 58
    ) => {
      const startY = doc.y;
      const boxW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.rect(doc.page.margins.left, startY, boxW, height).fillAndStroke(bgColor, borderColor);
      doc.fontSize(8.4).font('Helvetica-Bold').fillColor(NAVY)
         .text(title, doc.page.margins.left + 10, startY + 7);
      doc.fontSize(7.8).font('Helvetica').fillColor(TEXT_MUTED)
         .text(content, doc.page.margins.left + 10, startY + 20, {
           width: boxW - 20,
           lineGap: 1.7
         });
      doc.y = startY + height + 8;
    };

    const metricGrid = (metrics: Array<{ label: string; value: string; note: string }>) => {
      const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 20) / 3;
      const startY = doc.y;

      metrics.forEach((m, idx) => {
        const x = doc.page.margins.left + idx * (colWidth + 10);
        doc.rect(x, startY, colWidth, 50).fillAndStroke('#F1F5F9', '#E2E8F0');
        doc.fontSize(7).font('Helvetica-Bold').fillColor(TEXT_MUTED)
           .text(m.label.toUpperCase(), x + 8, startY + 6, { width: colWidth - 16 });
        doc.fontSize(11.2).font('Helvetica-Bold').fillColor(PRIMARY_BLUE)
           .text(m.value, x + 8, startY + 17, { width: colWidth - 16 });
        doc.fontSize(6.9).font('Helvetica').fillColor(ACCENT_EMERALD)
           .text(m.note, x + 8, startY + 34, { width: colWidth - 16 });
      });
      doc.y = startY + 56;
    };

    // ==========================================
    // PAGE 1: HONEST ARCHITECTURE OVERVIEW & PERSISTENCE BOUNDARY
    // ==========================================
    doc.rect(doc.page.margins.left, 45, doc.page.width - 90, 70).fill(NAVY);

    doc.fillColor('#FFFFFF').fontSize(15.0).font('Helvetica-Bold')
       .text('PROJECT NEXUS: ARCHITECTURE & BENCHMARK DOSSIER', doc.page.margins.left + 16, 55);
    doc.fillColor(ACCENT_CYAN).fontSize(8.0).font('Helvetica-Bold')
       .text('CLOUD SQL POSTGRESQL ACID • FIREBASE AUTH • DETERMINISTIC CM3 GUARDRAILS', doc.page.margins.left + 16, 74);
    doc.fillColor('#94A3B8').fontSize(7.3).font('Helvetica')
       .text('Scope Boundary: Real Hosted PostgreSQL Persistence & Benchmarks vs. Simulated 3P Connector Fault Modes', doc.page.margins.left + 16, 88);

    doc.y = 124;

    const metaY = doc.y;
    doc.rect(doc.page.margins.left, metaY, doc.page.width - 90, 42).fillAndStroke('#F8FAFC', BORDER_COLOR);
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(TEXT_DARK)
       .text('DATABASE ENGINE:', doc.page.margins.left + 10, metaY + 8)
       .text('AUTH & ACCESS:', doc.page.margins.left + 175, metaY + 8)
       .text('3P INTEGRATIONS:', doc.page.margins.left + 350, metaY + 8);

    doc.fontSize(7.4).font('Helvetica').fillColor(TEXT_MUTED)
       .text('Cloud SQL PostgreSQL (1-Region)', doc.page.margins.left + 10, metaY + 21)
       .text('Firebase Google Sign-In + Bearer', doc.page.margins.left + 175, metaY + 21)
       .text('Simulated Stripe & FedEx SAGA', doc.page.margins.left + 350, metaY + 21);

    doc.y = metaY + 50;

    // 1. Executive Summary
    sectionHeader('1', 'System Boundary: What Runs in Hosted Infra vs. Deterministic Simulation');
    doc.fontSize(8.2).font('Helvetica').fillColor(TEXT_DARK).text(
      'NEXUS separates verified PostgreSQL persistence and deterministic margin math from simulated external carrier/payment fault states:\n\n' +
      '  • Real Cloud SQL for PostgreSQL Persistence: All 9 tables (users, inventory_sub_lots, outbox_records, audit_blocks, idempotency_keys, edge_pii_vault, merkle_epochs, ema_state, benchmark_runs) persist in Cloud SQL PostgreSQL with SQL CHECK (available_units >= 0) constraints and SELECT ... FOR UPDATE row locks across K=32 striped SKU sub-lot shards.\n' +
      '  • Firebase Auth + Live Concurrent Benchmark: Protected endpoints verify Firebase Google Sign-In ID tokens via firebase-admin. Throughput and P50/P95/P99 latency figures come exclusively from running POST /api/agentforce/benchmark/run against Cloud SQL — zero hardcoded claims or unverified Raft/quorum hardware assertions.',
      { lineGap: 2.3 }
    );
    doc.moveDown(0.3);

    metricGrid([
      { label: 'Persistence Topology', value: 'Single-Region PG', note: 'SELECT FOR UPDATE + CHECK >= 0' },
      { label: 'Measured Performance', value: 'Live P50/P95/P99', note: 'Recorded per benchmark_runs row' },
      { label: 'Self-Thawing EMA', value: '30s Half-Life', note: '$0.05 Penalty Cap + 422 Isolation' }
    ]);

    // 2. 4-Point Lifecycle
    sectionHeader('2', 'Transactional 4-Point Clearance Lifecycle');

    const lifecyclePoints = [
      {
        num: 'Point 1: Firebase Bearer Gate & K=32 Striped Sub-Lot Routing',
        sla: 'HTTP 401 on Unsigned Requests',
        desc: 'Verifies Firebase Google Sign-In ID tokens server-side, checks idempotency_keys in PostgreSQL to prevent duplicate debits, tokenizes subjectId in edge_pii_vault, and assigns striped shard indices (0..31).'
      },
      {
        num: 'Point 2: Deterministic CM3 Margin Guardrail & Half-Life EMA',
        sla: 'Floor Enforced (422 Hard Halt)',
        desc: 'Applies 30s wall-clock half-life decay and capped E[Void <= $0.05] to net landed cost C_landed (COGS + freight + fee + RTO risk + egress). Rejections return HTTP 422 without incrementing failure EMAs.'
      },
      {
        num: 'Point 3: PostgreSQL ACID Row Lock & Durable Outbox SAGA',
        sla: 'SQL CHECK (available_units >= 0)',
        desc: 'Acquires pessimistic row lock on target sub-lot (with ascending-index multi-shard rebalance when needed), commits available/reserved delta + outbox_records row, and simulates Stripe Escrow -> FedEx WMS steps.'
      },
      {
        num: 'Point 4: SHA-256 Hash-Chained Audit Ledger & Merkle Epoch',
        sla: 'Tamper-Evident Chain + Shred',
        desc: 'Appends previousHash-linked SHA-256 entries into audit_blocks plus Merkle epoch roots inside PostgreSQL. Edge KMS shredding marks edge_pii_vault keys DESTROYED cleanly.'
      }
    ];

    lifecyclePoints.forEach((lp) => {
      const y = doc.y;
      doc.rect(doc.page.margins.left, y, doc.page.width - 90, 39).fillAndStroke('#FFFFFF', '#E2E8F0');
      doc.fontSize(8.2).font('Helvetica-Bold').fillColor(PRIMARY_BLUE).text(lp.num, doc.page.margins.left + 8, y + 6);
      doc.fontSize(7.2).font('Helvetica-Bold').fillColor(ACCENT_EMERALD).text(lp.sla, doc.page.width - doc.page.margins.right - 155, y + 6, { width: 148, align: 'right' });
      doc.fontSize(7.4).font('Helvetica').fillColor(TEXT_MUTED).text(lp.desc, doc.page.margins.left + 8, y + 18, { width: doc.page.width - 108, lineGap: 1.4 });
      doc.y = y + 44;
    });

    // ==========================================
    // PAGE 2: SELF-THAWING EMA, API CONTRACT & ANALYTICAL DLQ SENSITIVITY
    // ==========================================
    doc.addPage();

    sectionHeader('3', 'Deterministic Economics: Wall-Clock Half-Life EMA & CM3 Margin Floor', ACCENT_AMBER);
    doc.fontSize(8.2).font('Helvetica').fillColor(TEXT_DARK).text(
      'Guardrail evaluations isolate HTTP 422 margin rejections from error-rate EMA feedback, bound expected void penalties at $0.05/tx, and decay failure EMAs continuously over wall-clock idle intervals:',
      { lineGap: 2 }
    );
    doc.moveDown(0.35);

    calloutBox(
      'WALL-CLOCK HALF-LIFE EMA DECAY + $0.05 PENALTY CAP + CANARY RECOVERY',
      'rho(t+dt) = rho(t) * 0.5^(dt / 30s)  [Continuous idle decay]  |  E[Void] = min($0.05, $0.05 * rho_void)  |  422 Halts Excluded\n' +
      'C_landed = BaseCOGS + Freight + (Price * PaymentFee%) + (RTO_Prob * ReverseCost) + C_egress_eff + E[Void]\n' +
      'Canary Window: Every 5s post-spike, a healthy transaction pulls rho_void down via alpha_dec=0.20.',
      ACCENT_AMBER,
      '#FFFBEB',
      68
    );

    sectionHeader('4', 'Authenticated API Contract (Firebase Bearer + Cloud SQL PostgreSQL)');
    const codeBoxY = doc.y;
    doc.rect(doc.page.margins.left, codeBoxY, doc.page.width - 90, 272).fill('#0F172A');

    const actionSpecText = `POST /api/agentforce/clear-margin-floor | POST /api/agentforce/benchmark/run
POST /api/agentforce/outbox/recover   | POST /api/agentforce/outbox/sweep-dlq
Headers: Authorization: Bearer <Firebase_ID_Token>

// Request (clear-margin-floor):
{
  "skuId": "SKU-ANC-PRO-09", "excessUnits": 1200, "costOfGoodsSold": 168.00,
  "freightCost": 8.50, "minimumMarginFloorPct": 18.5, "fallbackMode": "HARD_HALT"
}

// Response (HTTP 200 CLEARED - Cloud SQL PostgreSQL Committed):
{
  "success": true, "sagaId": "SAGA-104821-9A2F", "shardId": "SKU-ANC-PRO-09#shard-07",
  "persistenceTopology": {
    "engine": "Cloud SQL for PostgreSQL (Single-Region Primary)",
    "isolation": "READ COMMITTED + SELECT ... FOR UPDATE + CHECK (available_units >= 0)",
    "externalConnectors": "Simulated Stripe Escrow & FedEx WMS State Machine"
  }
}`;

    doc.font('Courier').fontSize(7.1).fillColor('#38BDF8')
       .text(actionSpecText, doc.page.margins.left + 12, codeBoxY + 10, {
         width: doc.page.width - 114,
         lineGap: 2.1
       });

    doc.y = codeBoxY + 282;

    sectionHeader('4B', 'Analytical DLQ Reconciliation Sensitivity Model', ACCENT_EMERALD);
    calloutBox(
      'ANALYTICAL THROUGHPUT & ESCALATION SENSITIVITY FORMULA (COMMERCE_LOGIC.TS)',
      'Outbox rows hitting DEAD_LETTER_RECONCILIATION after Reaper exponential backoff (maxRetries=3) are classified into machine-reconcilable void/settled states vs. split-brain escalations requiring manual review. computeAuditVelocityMetrics() lets operators vary tx/s, DLQ rate, and mismatch ratio dynamically without claiming fixed production OPEX.',
      ACCENT_EMERALD,
      '#ECFDF5',
      66
    );

    // ==========================================
    // PAGE 3: SECURITY CONTROLS & IMPLEMENTATION MATRIX
    // ==========================================
    doc.addPage();

    sectionHeader('5', 'Implemented Persistence, Security & Fault-Simulation Controls', ACCENT_PURPLE);
    doc.fontSize(8.2).font('Helvetica').fillColor(TEXT_DARK).text(
      'Summary of controls enforced in Drizzle PostgreSQL schemas, Express middleware, and unit-tested domain logic:',
      { lineGap: 2 }
    );
    doc.moveDown(0.35);

    const pillars = [
      {
        title: '1. PostgreSQL ACID Locking & Physical Stock Check Constraints',
        desc: 'inventory_sub_lots enforces SQL CHECK (available_units >= 0) and CHECK (reserved_units >= 0). All mutations lock shard rows via SELECT ... FOR UPDATE, preventing negative stock or concurrent lost updates inside Cloud SQL PostgreSQL.'
      },
      {
        title: '2. Firebase Google Sign-In & Server-Side Token Verification',
        desc: 'Client acquires ID tokens in memory via Google Sign-In popup. Every API endpoint under /api/agentforce/*, /api/security/*, and /api/auth/me runs requireAuth using firebase-admin and upserts authenticated operators into users.'
      },
      {
        title: '3. Durable Outbox SAGA & Crash Recovery State Machine',
        desc: 'Fault toggles persist IN_FLIGHT_CRASHED or COMPENSATED_ROLLED_BACK states in outbox_records. recoverOutboxPg applies exponential backoff (1s..32s), transitions exhausted rows to DEAD_LETTER_RECONCILIATION, and restores reserved PostgreSQL stock.'
      },
      {
        title: '4. Tamper-Evident SHA-256 Chain & Edge PII Crypto-Shredding',
        desc: 'audit_blocks stores previousHash-linked SHA-256 hashes per clearance and halt event. shredEdgeSubjectPg marks KMS key references DESTROYED in edge_pii_vault without mutating or invalidating persisted audit hashes.'
      }
    ];

    pillars.forEach((p) => {
      const y = doc.y;
      doc.rect(doc.page.margins.left, y, doc.page.width - 90, 52).fillAndStroke('#F8FAFC', BORDER_COLOR);
      doc.fontSize(8.1).font('Helvetica-Bold').fillColor(PRIMARY_BLUE).text(p.title, doc.page.margins.left + 10, y + 7);
      doc.fontSize(7.3).font('Helvetica').fillColor(TEXT_MUTED).text(p.desc, doc.page.margins.left + 10, y + 19, {
        width: doc.page.width - 110,
        lineGap: 1.35
      });
      doc.y = y + 58;
    });

    sectionHeader('6', 'Verification & Scope Matrix (Measured vs. Simulated vs. Excluded)', ACCENT_EMERALD);
    const tableY = doc.y;
    const colW = [125, 115, 150, 115];

    doc.rect(doc.page.margins.left, tableY, doc.page.width - 90, 18).fill('#0F172A');
    doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#FFFFFF')
       .text('SUBSYSTEM', doc.page.margins.left + 6, tableY + 5)
       .text('EXECUTION ENGINE', doc.page.margins.left + colW[0] + 6, tableY + 5)
       .text('MECHANISM', doc.page.margins.left + colW[0] + colW[1] + 6, tableY + 5)
       .text('VERIFICATION STATUS', doc.page.margins.left + colW[0] + colW[1] + colW[2] + 6, tableY + 5);

    const rows = [
      { name: 'Sub-Lot Stock Lock', plane: 'Cloud SQL PostgreSQL', proto: 'SELECT FOR UPDATE + CHECK >= 0', sla: 'Live Hosted DB' },
      { name: 'Operator Auth', plane: 'Firebase + Express', proto: 'Google Sign-In + ID Token Verify', sla: 'HTTP 401 Gated' },
      { name: 'Load Benchmark', plane: 'Cloud SQL PostgreSQL', proto: 'Concurrent Tx Pool (P50/P95/P99)', sla: 'Live Measured' },
      { name: 'CM3 Margin & EMA', plane: 'commerceLogic.ts', proto: 'Net Landed Cost + 30s Decay', sla: 'Vitest Verified' },
      { name: 'Stripe / FedEx SAGA', plane: 'Outbox State Machine', proto: 'Simulated 3P Fault Injection', sla: 'Simulated Connector' },
      { name: 'Multi-AZ / SOC 2', plane: 'Out of Scope Here', proto: 'Single-Region Dev DB / Uncertified', sla: 'Not Claimed' }
    ];

    let currentY = tableY + 18;
    rows.forEach((r, idx) => {
      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      doc.rect(doc.page.margins.left, currentY, doc.page.width - 90, 18).fillAndStroke(bg, '#E2E8F0');
      doc.fontSize(7.2).font('Helvetica-Bold').fillColor(TEXT_DARK).text(r.name, doc.page.margins.left + 6, currentY + 5);
      doc.font('Helvetica').fillColor(PRIMARY_BLUE).text(r.plane, doc.page.margins.left + colW[0] + 6, currentY + 5);
      doc.font('Helvetica').fillColor(TEXT_MUTED).text(r.proto, doc.page.margins.left + colW[0] + colW[1] + 6, currentY + 5);
      doc.font('Helvetica-Bold').fillColor(idx === 5 ? ACCENT_ROSE : ACCENT_EMERALD).text(r.sla, doc.page.margins.left + colW[0] + colW[1] + colW[2] + 6, currentY + 5);
      currentY += 18;
    });

    doc.y = currentY + 12;
    calloutBox(
      'ARCHITECTURAL TRANSPARENCY STATEMENT',
      'This environment runs real single-region Cloud SQL PostgreSQL ACID transactions authenticated by Firebase Auth and measures actual query concurrency via POST /api/agentforce/benchmark/run. Simulated 3P Stripe/FedEx states and single-region defaults are documented explicitly.',
      ACCENT_EMERALD,
      '#ECFDF5',
      50
    );

    // ==========================================
    // PAGE 4: APPENDIX A — REQUEST, CLOUD SQL ACID & SAGA SEQUENCE
    // ==========================================
    doc.addPage();

    sectionHeader('A', 'Appendix A: End-to-End Request, Cloud SQL ACID & Outbox Sequence', ACCENT_CYAN);
    doc.fontSize(7.9).font('Helvetica').fillColor(TEXT_MUTED).text(
      'Execution sequence across Authenticated API Gate, Cloud SQL PostgreSQL ACID locking, Simulated 3P SAGA Outbox, and SHA-256 Audit Chain.',
      { lineGap: 2 }
    );
    doc.moveDown(0.45);

    const diagLeft = doc.page.margins.left;
    const diagW = doc.page.width - 90;
    const topY = doc.y + 6;

    const lanes = [
      { title: 'FIREBASE AUTH GATE\n(& CM3 Guardrail)', x: diagLeft, w: 112, color: ACCENT_CYAN },
      { title: 'CLOUD SQL POSTGRES\n(FOR UPDATE + CHECK)', x: diagLeft + 130, w: 120, color: PRIMARY_BLUE },
      { title: 'OUTBOX SAGA (SIM)\n(Stripe -> FedEx)', x: diagLeft + 268, w: 115, color: ACCENT_PURPLE },
      { title: 'AUDIT & EDGE VAULT\n(SHA-256 + Shred)', x: diagLeft + 398, w: 107, color: ACCENT_EMERALD }
    ];

    lanes.forEach((ln) => {
      doc.rect(ln.x, topY, ln.w, 34).fillAndStroke(NAVY, ln.color);
      doc.fontSize(7.1).font('Helvetica-Bold').fillColor('#FFFFFF')
         .text(ln.title, ln.x + 4, topY + 7, { width: ln.w - 8, align: 'center' });

      const cx = ln.x + ln.w / 2;
      doc.save()
         .strokeColor('#CBD5E1')
         .lineWidth(0.8)
         .dash(4, { space: 3 })
         .moveTo(cx, topY + 34)
         .lineTo(cx, topY + 515)
         .stroke()
         .restore();
    });

    const drawArrow = (y: number, fromIdx: number, toIdx: number, label: string, sub: string, color: string) => {
      const x1 = lanes[fromIdx].x + lanes[fromIdx].w / 2;
      const x2 = lanes[toIdx].x + lanes[toIdx].w / 2;
      const dir = x2 >= x1 ? 1 : -1;

      doc.strokeColor(color).lineWidth(1.4).moveTo(x1, y).lineTo(x2, y).stroke();
      doc.polygon(
        [x2, y],
        [x2 - 6 * dir, y - 3.5],
        [x2 - 6 * dir, y + 3.5]
      ).fill(color);

      const minX = Math.min(x1, x2) + 6;
      const spanW = Math.max(135, Math.abs(x2 - x1) - 12);
      const labelH = doc.fontSize(7.0).font('Helvetica-Bold').heightOfString(label, { width: spanW });
      doc.fontSize(7.0).font('Helvetica-Bold').fillColor(NAVY)
         .text(label, minX, y - labelH - 4, { width: spanW, align: 'center' });
      doc.fontSize(6.4).font('Helvetica').fillColor(color)
         .text(sub, minX, y + 4, { width: spanW, align: 'center' });
    };

    // Plane A Banner
    doc.rect(diagLeft - 4, topY + 50, diagW + 8, 128).fillOpacity(0.06).fill(ACCENT_CYAN).fillOpacity(1);
    doc.rect(diagLeft - 4, topY + 50, diagW + 8, 128).strokeColor(ACCENT_CYAN).lineWidth(0.8).stroke();
    doc.fontSize(7.2).font('Helvetica-Bold').fillColor(ACCENT_CYAN)
       .text('PHASE 1: AUTH VERIFICATION, CM3 GUARDRAIL & POSTGRESQL ACID SHARD LOCK', diagLeft + 4, topY + 56, { lineBreak: false });

    drawArrow(topY + 88, 0, 1, '1. Verify Bearer + CM3 Guardrail', 'Idempotency check + Half-Life EMA C_landed', ACCENT_CYAN);
    drawArrow(topY + 124, 1, 3, '2. SELECT FOR UPDATE + Outbox', 'CHECK available_units >= 0 + Merkle Epoch', PRIMARY_BLUE);
    drawArrow(topY + 160, 1, 0, '3. HTTP 200 / 202 / 409 / 422 Result', 'Measured lock timing & sub-lot state', ACCENT_EMERALD);

    // Plane B Banner
    doc.rect(diagLeft - 4, topY + 194, diagW + 8, 132).fillOpacity(0.06).fill(ACCENT_PURPLE).fillOpacity(1);
    doc.rect(diagLeft - 4, topY + 194, diagW + 8, 132).strokeColor(ACCENT_PURPLE).lineWidth(0.8).stroke();
    doc.fontSize(7.2).font('Helvetica-Bold').fillColor(ACCENT_PURPLE)
       .text('PHASE 2: SIMULATED 3P SAGA ORDERING & EDGE PII CRYPTO-SHREDDING', diagLeft + 4, topY + 200, { lineBreak: false });

    drawArrow(topY + 234, 1, 2, '4. Simulated Stripe -> FedEx SAGA', 'Compensates PostgreSQL stock if WMS fails', ACCENT_PURPLE);
    drawArrow(topY + 272, 2, 3, '5. SHA-256 Chain Block Append', 'Linked previousHash + HMAC digest', ACCENT_EMERALD);
    drawArrow(topY + 308, 0, 3, '6. Edge Vault KMS Crypto-Shred', 'Marks KMS ref DESTROYED; chain stays valid', ACCENT_CYAN);

    // Phase 3 Banner
    doc.rect(diagLeft - 4, topY + 342, diagW + 8, 152).fillOpacity(0.07).fill(ACCENT_ROSE).fillOpacity(1);
    doc.rect(diagLeft - 4, topY + 342, diagW + 8, 152).strokeColor(ACCENT_ROSE).lineWidth(0.8).stroke();
    doc.fontSize(7.2).font('Helvetica-Bold').fillColor(ACCENT_ROSE)
       .text('PHASE 3: CRASH RECOVERY REAPER, DLQ SWEEPER & CONCURRENT BENCHMARK', diagLeft + 4, topY + 348, { lineBreak: false });

    drawArrow(topY + 382, 2, 1, '7a. Reaper Backoff (maxRetries=3)', 'Resumes IN_FLIGHT_CRASHED or trips DLQ', ACCENT_ROSE);
    drawArrow(topY + 422, 1, 2, '7b. DLQ Sweeper & Sensitivity Model', 'Reconciles DLQ rows & escalates split-brain', ACCENT_AMBER);
    drawArrow(topY + 462, 0, 1, '7c. Concurrent PG Benchmark Pool', 'Persists measured P50/P95/P99 in benchmark_runs', ACCENT_ROSE);

    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      doc.strokeColor(BORDER_COLOR).lineWidth(0.5)
         .moveTo(doc.page.margins.left, doc.page.height - 35)
         .lineTo(doc.page.width - doc.page.margins.right, doc.page.height - 35)
         .stroke();

      doc.fontSize(7.4).font('Helvetica').fillColor(TEXT_MUTED)
         .text('NEXUS Commerce OS — Cloud SQL PostgreSQL Architecture & Concurrent Benchmark Dossier', doc.page.margins.left, doc.page.height - 26, { lineBreak: false });
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PRIMARY_BLUE)
         .text(`Page ${i + 1} of ${totalPages}`, doc.page.width - doc.page.margins.right - 65, doc.page.height - 26, { width: 65, align: 'right', lineBreak: false });

      doc.page.margins.bottom = savedBottom;
    }

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', (err) => reject(err));
  });
}

if (process.argv[1]?.endsWith('generateDossierPdf.ts') || process.argv[1]?.endsWith('generateDossierPdf.js')) {
  const target = path.join(process.cwd(), 'public', 'Nexus_Enterprise_Technical_Dossier.pdf');
  console.log(`Generating Cloud SQL Technical Dossier PDF to: ${target}`);
  generateTechnicalDossierPdf(target)
    .then((out) => console.log(`Successfully generated 4-page PDF at: ${out}`))
    .catch((err) => {
      console.error('Failed to generate PDF:', err);
      process.exit(1);
    });
}
