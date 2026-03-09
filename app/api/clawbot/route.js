import { NextResponse } from 'next/server';
import { getClawbotActivities, addClawbotActivities } from '@/lib/store';

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_POST = 30;
const MAX_BODY_BYTES = 524288;

const rateLimitStore = globalThis.__clawbotRateLimit || new Map();
if (!globalThis.__clawbotRateLimit) {
    globalThis.__clawbotRateLimit = rateLimitStore;
}

function jsonResponse(payload, init = {}) {
    const res = NextResponse.json(payload, init);
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    return res;
}

function getClientIp(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return request.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(request) {
    const now = Date.now();
    const key = `clawbot:${getClientIp(request)}:POST`;
    const existing = rateLimitStore.get(key);

    if (!existing || now >= existing.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return null;
    }

    existing.count += 1;
    if (existing.count <= RATE_LIMIT_MAX_POST) return null;

    return jsonResponse({ error: 'Too many requests' }, { status: 429 });
}

/**
 * GET /api/clawbot — return stored ClawBot activities
 */
export async function GET() {
    return jsonResponse({
        activities: getClawbotActivities(),
        count: getClawbotActivities().length,
        timestamp: new Date().toISOString(),
    });
}

/**
 * POST /api/clawbot — receive activity events from the log watcher
 * Body: { events: [{ type, channel, message, status, timestamp, detail }] }
 */
export async function POST(request) {
    const rateLimited = checkRateLimit(request);
    if (rateLimited) return rateLimited;

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
        return jsonResponse({ error: 'Unsupported content type' }, { status: 415 });
    }

    const declaredLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
    if (!Number.isNaN(declaredLength) && declaredLength > MAX_BODY_BYTES) {
        return jsonResponse({ error: 'Payload too large' }, { status: 413 });
    }

    try {
        const body = await request.json();
        const events = Array.isArray(body.events) ? body.events : [];

        if (events.length === 0) {
            return jsonResponse({ error: 'No events provided' }, { status: 400 });
        }

        const added = addClawbotActivities(events);
        return jsonResponse({ success: true, added, total: getClawbotActivities().length });
    } catch {
        return jsonResponse({ error: 'Invalid JSON' }, { status: 400 });
    }
}
