import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Resolve lead-hunter DB path
const DB_PATH = process.env.GHOSTAI_LEAD_DB_PATH
    || path.resolve('/Users/danielcastillo/Projects/Websites/Bots/ghostai-lead-hunter/leads.db');

function withSecurityHeaders(response) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    return response;
}

function jsonResponse(payload, init = {}) {
    return withSecurityHeaders(NextResponse.json(payload, init));
}

function safeGet(db, sql, params = []) {
    try { return db.prepare(sql).get(...params); } catch { return null; }
}

function safeAll(db, sql, params = []) {
    try { return db.prepare(sql).all(...params); } catch { return []; }
}

// GET /api/sales-closer — pull sales closer metrics from leads.db
export async function GET() {
    if (!fs.existsSync(DB_PATH)) {
        return jsonResponse({
            error: 'Lead database not found',
            signalTiers: { closeNow: 0, warmPursuit: 0, dormant: 0 },
            funnel: {},
            closerLog: [],
            topSignals: [],
        }, { status: 200 });
    }

    let db;
    try {
        db = new Database(DB_PATH, { readonly: true });
        db.pragma('journal_mode = WAL');

        // ─── Signal Tier Counts ───────────────────────────────
        const hasSnapshots = safeGet(db,
            "SELECT name FROM sqlite_master WHERE type='table' AND name='signal_snapshots'"
        );

        let signalTiers = { closeNow: 0, warmPursuit: 0, dormant: 0 };
        let topSignals = [];

        if (hasSnapshots) {
            // Latest signal per lead (most recent snapshot)
            const latestSignals = safeAll(db, `
                SELECT s.lead_id, s.signal_score, s.signal_tier, s.signals_json, s.computed_at,
                       l.business_name, l.email, l.segment, l.closer_status, l.closer_touch_count
                FROM signal_snapshots s
                JOIN leads l ON l.id = s.lead_id
                WHERE s.id = (SELECT MAX(s2.id) FROM signal_snapshots s2 WHERE s2.lead_id = s.lead_id)
                ORDER BY s.signal_score DESC
            `);

            for (const row of latestSignals) {
                if (row.signal_tier === 'close_now') signalTiers.closeNow++;
                else if (row.signal_tier === 'warm_pursuit') signalTiers.warmPursuit++;
                else signalTiers.dormant++;
            }

            topSignals = latestSignals.slice(0, 20).map(row => ({
                name: row.business_name,
                email: row.email || '',
                segment: row.segment || '',
                score: row.signal_score,
                tier: row.signal_tier,
                closerStatus: row.closer_status || '',
                touches: row.closer_touch_count || 0,
                signals: (() => {
                    try { return JSON.parse(row.signals_json || '{}'); } catch { return {}; }
                })(),
                computedAt: row.computed_at,
            }));
        }

        // ─── Conversion Funnel ────────────────────────────────
        const totalLeads = safeGet(db, 'SELECT COUNT(*) as c FROM leads')?.c || 0;
        const contacted = safeGet(db, "SELECT COUNT(*) as c FROM leads WHERE status = 'contacted'")?.c || 0;
        const engaged = safeGet(db, `
            SELECT COUNT(DISTINCT l.id) as c FROM leads l
            JOIN outreach_log o ON o.lead_id = l.id
            WHERE o.open_count > 0 OR o.click_count > 0
        `)?.c || 0;
        const replied = safeGet(db, "SELECT COUNT(*) as c FROM leads WHERE reply_detected_at IS NOT NULL")?.c || 0;
        const closing = safeGet(db, "SELECT COUNT(*) as c FROM leads WHERE closer_status = 'closing'")?.c || 0;
        const proposalSent = safeGet(db, "SELECT COUNT(*) as c FROM leads WHERE closer_status = 'proposal_sent'")?.c || 0;
        const meetingScheduled = safeGet(db, "SELECT COUNT(*) as c FROM leads WHERE closer_status = 'meeting_scheduled'")?.c || 0;
        const closedWon = safeGet(db, "SELECT COUNT(*) as c FROM leads WHERE closer_status = 'closed_won'")?.c || 0;
        const closedLost = safeGet(db, "SELECT COUNT(*) as c FROM leads WHERE closer_status = 'closed_lost'")?.c || 0;

        const funnel = {
            totalLeads,
            contacted,
            engaged,
            replied,
            closing,
            proposalSent,
            meetingScheduled,
            closedWon,
            closedLost,
        };

        // ─── Closer Outreach Log (recent) ─────────────────────
        const hasCloserLog = safeGet(db,
            "SELECT name FROM sqlite_master WHERE type='table' AND name='closer_log'"
        );

        let closerLog = [];
        let closerStats = { totalSent: 0, emailsSent: 0, smsSent: 0, todaySent: 0 };

        if (hasCloserLog) {
            closerLog = safeAll(db, `
                SELECT cl.*, l.business_name, l.email
                FROM closer_log cl
                JOIN leads l ON l.id = cl.lead_id
                ORDER BY cl.sent_at DESC
                LIMIT 30
            `).map(row => ({
                id: row.id,
                leadName: row.business_name,
                email: row.email || '',
                channel: row.channel,
                type: row.type,
                subject: row.subject || '',
                signalScore: row.signal_score,
                signalTier: row.signal_tier,
                replyClass: row.reply_classification || '',
                sentAt: row.sent_at,
            }));

            const totalSent = safeGet(db, 'SELECT COUNT(*) as c FROM closer_log')?.c || 0;
            const emailsSent = safeGet(db, "SELECT COUNT(*) as c FROM closer_log WHERE channel = 'email'")?.c || 0;
            const smsSent = safeGet(db, "SELECT COUNT(*) as c FROM closer_log WHERE channel = 'sms'")?.c || 0;
            const todaySent = safeGet(db, "SELECT COUNT(*) as c FROM closer_log WHERE date(sent_at) = date('now')")?.c || 0;

            closerStats = { totalSent, emailsSent, smsSent, todaySent };
        }

        db.close();

        return jsonResponse({
            lastSync: new Date().toISOString(),
            signalTiers,
            funnel,
            closerLog,
            closerStats,
            topSignals,
        });

    } catch (err) {
        if (db) try { db.close(); } catch {}
        return jsonResponse({
            error: err.message,
            signalTiers: { closeNow: 0, warmPursuit: 0, dormant: 0 },
            funnel: {},
            closerLog: [],
            closerStats: { totalSent: 0, emailsSent: 0, smsSent: 0, todaySent: 0 },
            topSignals: [],
        }, { status: 200 });
    }
}
