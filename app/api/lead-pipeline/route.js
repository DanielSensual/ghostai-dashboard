import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getLeadPipelineData, setLeadPipelineData } from '@/lib/lead-store';

const DEV_FALLBACK_TOKEN = 'ghostai-dev-token';
const AUTH_TOKEN = process.env.DASHBOARD_SECRET
    || (process.env.NODE_ENV === 'production' ? '' : DEV_FALLBACK_TOKEN);

const ALLOW_QUERY_TOKEN_AUTH = process.env.ALLOW_QUERY_TOKEN_AUTH !== 'false';
const MAX_BODY_BYTES = Math.max(1024, Number.parseInt(process.env.DASHBOARD_MAX_BODY_BYTES || '1048576', 10) || 1048576);
const RATE_LIMIT_WINDOW_MS = Math.max(1000, Number.parseInt(process.env.DASHBOARD_RATE_LIMIT_WINDOW_MS || '60000', 10) || 60000);
const RATE_LIMIT_MAX_GET = Math.max(10, Number.parseInt(process.env.DASHBOARD_RATE_LIMIT_MAX_GET || '180', 10) || 180);
const RATE_LIMIT_MAX_POST = Math.max(5, Number.parseInt(process.env.DASHBOARD_RATE_LIMIT_MAX_POST || '60', 10) || 60);

const rateLimitStore = globalThis.__ghostaiLeadRateLimit || new Map();
if (!globalThis.__ghostaiLeadRateLimit) {
    globalThis.__ghostaiLeadRateLimit = rateLimitStore;
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

    const key = `${getClientIp(request)}:${request.method}:lead-pipeline`;
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

    if (!allowQuery) return false;
    const queryToken = new URL(request.url).searchParams.get('token') || '';
    return timingSafeTokenCheck(queryToken, AUTH_TOKEN);
}

function ensureAuthConfigured() {
    if (AUTH_TOKEN) return null;
    return jsonResponse(
        { error: 'Server misconfigured: DASHBOARD_SECRET must be set' },
        { status: 500 }
    );
}

function toNumber(value, fallback = 0) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
    return fallback;
}

function sanitizeCampaigns(campaigns) {
    if (!Array.isArray(campaigns)) return [];
    return campaigns.slice(0, 150).map((row) => ({
        niche: String(row?.niche || 'unknown'),
        city: String(row?.city || 'unknown'),
        count: toNumber(row?.count, 0),
    }));
}

function sanitizeTopLeads(topLeads) {
    if (!Array.isArray(topLeads)) return [];
    return topLeads.slice(0, 150).map((row) => ({
        name: String(row?.name || 'Unknown lead'),
        score: toNumber(row?.score, 0),
        city: String(row?.city || ''),
        email: String(row?.email || ''),
        status: String(row?.status || 'new'),
        segment: String(row?.segment || ''),
        offer: String(row?.offer || ''),
    }));
}

function sanitizeSegmentBreakdown(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, 100).map((row) => ({
        segment: String(row?.segment || 'unassigned'),
        leads: toNumber(row?.leads, 0),
        replied: toNumber(row?.replied, 0),
        booked: toNumber(row?.booked, 0),
        contacted: toNumber(row?.contacted, 0),
    }));
}

function sanitizeDailySendSeries(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.slice(-60).map((row) => ({
        date: String(row?.date || ''),
        count: toNumber(row?.count, 0),
    }));
}

function sanitizeIncomingPayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Invalid payload');
    }

    const incomingPipeline = payload.pipeline && typeof payload.pipeline === 'object'
        ? payload.pipeline
        : {};

    const safe = {
        pipeline: {
            totalLeads: toNumber(incomingPipeline.totalLeads, 0),
            hotLeads: toNumber(incomingPipeline.hotLeads, 0),
            warmLeads: toNumber(incomingPipeline.warmLeads, 0),
            withEmail: toNumber(incomingPipeline.withEmail, 0),
            contacted: toNumber(incomingPipeline.contacted, 0),
            replied: toNumber(incomingPipeline.replied, 0),
            booked: toNumber(incomingPipeline.booked, 0),
            totalOutreach: toNumber(incomingPipeline.totalOutreach, 0),
            todayOutreach: toNumber(incomingPipeline.todayOutreach, 0),
            replyRate: toNumber(incomingPipeline.replyRate, 0),
            bookRate: toNumber(incomingPipeline.bookRate, 0),
            suppressionCount: toNumber(incomingPipeline.suppressionCount, 0),
            segmentBreakdown: sanitizeSegmentBreakdown(incomingPipeline.segmentBreakdown),
            dailySendSeries: sanitizeDailySendSeries(incomingPipeline.dailySendSeries),
        },
        campaigns: sanitizeCampaigns(payload.campaigns),
        segmentBreakdown: sanitizeSegmentBreakdown(payload.segmentBreakdown || incomingPipeline.segmentBreakdown),
        dailySendSeries: sanitizeDailySendSeries(payload.dailySendSeries || incomingPipeline.dailySendSeries),
        topLeads: sanitizeTopLeads(payload.topLeads),
    };

    return safe;
}

export async function GET(request) {
    const configError = ensureAuthConfigured();
    if (configError) return configError;

    const rateLimited = checkRateLimit(request, RATE_LIMIT_MAX_GET);
    if (rateLimited) return rateLimited;

    if (!isAuthorized(request, { allowQuery: ALLOW_QUERY_TOKEN_AUTH })) {
        return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    return jsonResponse(getLeadPipelineData());
}

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
        setLeadPipelineData(safeBody);
        return jsonResponse({ success: true, synced: new Date().toISOString() });
    } catch {
        return jsonResponse({ error: 'Invalid JSON' }, { status: 400 });
    }
}
