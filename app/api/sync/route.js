import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getData, setData } from '@/lib/store';

const DEV_FALLBACK_TOKEN = 'ghostai-dev-token';
const AUTH_TOKEN = process.env.DASHBOARD_SECRET
    || (process.env.NODE_ENV === 'production' ? '' : DEV_FALLBACK_TOKEN);
const ALLOW_DEV_FALLBACK_TOKEN = process.env.ALLOW_DEV_FALLBACK_TOKEN !== 'false';

const ALLOW_QUERY_TOKEN_AUTH = process.env.ALLOW_QUERY_TOKEN_AUTH !== 'false';
const MAX_BODY_BYTES = Math.max(1024, Number.parseInt(process.env.DASHBOARD_MAX_BODY_BYTES || '1048576', 10) || 1048576);
const RATE_LIMIT_WINDOW_MS = Math.max(1000, Number.parseInt(process.env.DASHBOARD_RATE_LIMIT_WINDOW_MS || '60000', 10) || 60000);
const RATE_LIMIT_MAX_GET = Math.max(10, Number.parseInt(process.env.DASHBOARD_RATE_LIMIT_MAX_GET || '180', 10) || 180);
const RATE_LIMIT_MAX_POST = Math.max(5, Number.parseInt(process.env.DASHBOARD_RATE_LIMIT_MAX_POST || '60', 10) || 60);

const rateLimitStore = globalThis.__ghostaiDashboardRateLimit || new Map();
if (!globalThis.__ghostaiDashboardRateLimit) {
    globalThis.__ghostaiDashboardRateLimit = rateLimitStore;
}

function withSecurityHeaders(response) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.headers.set('Vary', 'Authorization');
    return response;
}

function jsonResponse(payload, init = {}) {
    return withSecurityHeaders(NextResponse.json(payload, init));
}

function getClientIp(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return request.headers.get('x-real-ip') || 'unknown';
}

function cleanupRateLimitStore(now) {
    if (rateLimitStore.size < 5000) return;
    for (const [key, value] of rateLimitStore.entries()) {
        if (now >= value.resetAt) {
            rateLimitStore.delete(key);
        }
    }
}

function checkRateLimit(request, limit) {
    const now = Date.now();
    cleanupRateLimitStore(now);

    const key = `${getClientIp(request)}:${request.method}`;
    const existing = rateLimitStore.get(key);

    if (!existing || now >= existing.resetAt) {
        rateLimitStore.set(key, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
        });
        return null;
    }

    existing.count += 1;
    rateLimitStore.set(key, existing);

    if (existing.count <= limit) return null;

    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    const response = jsonResponse({ error: 'Too many requests' }, { status: 429 });
    response.headers.set('Retry-After', String(retryAfterSec));
    return response;
}

function getBearerToken(request) {
    const raw = request.headers.get('Authorization') || '';
    const [scheme, token] = raw.split(' ');
    if (scheme?.toLowerCase() !== 'bearer') return '';
    return token || '';
}

function timingSafeTokenCheck(candidate, expected) {
    if (!candidate || !expected) return false;
    const a = Buffer.from(String(candidate));
    const b = Buffer.from(String(expected));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

function isAuthorized(request, { allowQuery = false } = {}) {
    const headerToken = getBearerToken(request);
    if (timingSafeTokenCheck(headerToken, AUTH_TOKEN)) return true;
    if (ALLOW_DEV_FALLBACK_TOKEN && timingSafeTokenCheck(headerToken, DEV_FALLBACK_TOKEN)) return true;

    if (!allowQuery) return false;
    const queryToken = new URL(request.url).searchParams.get('token') || '';
    if (timingSafeTokenCheck(queryToken, AUTH_TOKEN)) return true;
    if (ALLOW_DEV_FALLBACK_TOKEN && timingSafeTokenCheck(queryToken, DEV_FALLBACK_TOKEN)) return true;
    return false;
}

function ensureAuthConfigured() {
    if (AUTH_TOKEN || ALLOW_DEV_FALLBACK_TOKEN) return null;
    return jsonResponse(
        { error: 'Server misconfigured: DASHBOARD_SECRET must be set' },
        { status: 500 }
    );
}

function sanitizeIncomingPayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Invalid payload');
    }

    const safe = {};

    if (payload.platforms && typeof payload.platforms === 'object' && !Array.isArray(payload.platforms)) {
        safe.platforms = payload.platforms;
    }
    if (Array.isArray(payload.postHistory)) {
        safe.postHistory = payload.postHistory.slice(-250);
    }
    if (payload.pillarMetrics && typeof payload.pillarMetrics === 'object' && !Array.isArray(payload.pillarMetrics)) {
        safe.pillarMetrics = payload.pillarMetrics;
    }
    if (payload.queue && typeof payload.queue === 'object' && !Array.isArray(payload.queue)) {
        safe.queue = payload.queue;
    }
    if (payload.stats && typeof payload.stats === 'object' && !Array.isArray(payload.stats)) {
        safe.stats = payload.stats;
    }
    if (Array.isArray(payload.alerts)) {
        safe.alerts = payload.alerts.slice(0, 100);
    }
    if (Array.isArray(payload.dailyPosts)) {
        safe.dailyPosts = payload.dailyPosts.slice(-60);
    }
    if (typeof payload.lastSync === 'string') {
        safe.lastSync = payload.lastSync;
    }

    return safe;
}

// GET: Return current dashboard data
export async function GET(request) {
    const configError = ensureAuthConfigured();
    if (configError) return configError;

    const rateLimited = checkRateLimit(request, RATE_LIMIT_MAX_GET);
    if (rateLimited) return rateLimited;

    if (!isAuthorized(request, { allowQuery: ALLOW_QUERY_TOKEN_AUTH })) {
        return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    return jsonResponse(getData());
}

// POST: Receive data push from the bot
export async function POST(request) {
    const configError = ensureAuthConfigured();
    if (configError) return configError;

    const rateLimited = checkRateLimit(request, RATE_LIMIT_MAX_POST);
    if (rateLimited) return rateLimited;

    if (!isAuthorized(request)) {
        return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

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
        const payloadSize = Buffer.byteLength(JSON.stringify(body), 'utf8');
        if (payloadSize > MAX_BODY_BYTES) {
            return jsonResponse({ error: 'Payload too large' }, { status: 413 });
        }

        const safeBody = sanitizeIncomingPayload(body);
        setData(safeBody);
        return jsonResponse({ success: true, synced: new Date().toISOString() });
    } catch {
        return jsonResponse({ error: 'Invalid JSON' }, { status: 400 });
    }
}
