import { NextResponse } from 'next/server';

const GATEWAY_URL = (process.env.GATEWAY_URL || 'https://ghostai-gateway-production.up.railway.app').trim().replace(/\/+$/, '');
const GOD_MODE_SECRET = (process.env.GOD_MODE_SECRET || process.env.COMMAND_AGENT_TOKEN || '').trim();

/**
 * God Mode API proxy — sends goals to Railway Gateway
 * 
 * ⚠️ SECURITY: Protected by GOD_MODE_SECRET (or COMMAND_AGENT_TOKEN fallback).
 * The frontend must include the secret via a session cookie or header.
 * If no secret is configured, the route is disabled entirely (returns 503).
 *
 * POST: Send a goal to Ghost
 * GET:  Check pipeline status (action=pipeline) or health (action=health)
 */

function withSecurityHeaders(response) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return response;
}

function jsonResponse(payload, init = {}) {
    return withSecurityHeaders(NextResponse.json(payload, init));
}

/**
 * Authenticate the request via:
 *   1. Authorization: Bearer <secret>
 *   2. x-god-mode-secret header
 *   3. ?secret= query param (for quick testing — avoid in production)
 *
 * If GOD_MODE_SECRET is not set in env, the route is hard-disabled.
 */
function authenticate(request) {
    if (!GOD_MODE_SECRET) {
        return { ok: false, error: 'God Mode is not configured. Set GOD_MODE_SECRET env var.', status: 503 };
    }

    const authHeader = request.headers.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const headerSecret = (request.headers.get('x-god-mode-secret') || '').trim();
    const url = new URL(request.url);
    const querySecret = (url.searchParams.get('secret') || '').trim();

    const provided = bearerToken || headerSecret || querySecret;

    if (!provided || provided !== GOD_MODE_SECRET) {
        return { ok: false, error: 'Unauthorized', status: 401 };
    }

    return { ok: true };
}

export async function POST(request) {
    const auth = authenticate(request);
    if (!auth.ok) {
        return jsonResponse({ error: auth.error }, { status: auth.status });
    }

    try {
        const { goal } = await request.json();

        if (!goal) {
            return jsonResponse({ error: 'Missing goal' }, { status: 400 });
        }

        const res = await fetch(`${GATEWAY_URL}/agent/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal, fresh: true }),
        });

        const data = await res.json();
        return jsonResponse(data);
    } catch (err) {
        return jsonResponse({ error: err.message }, { status: 500 });
    }
}

export async function GET(request) {
    const auth = authenticate(request);
    if (!auth.ok) {
        return jsonResponse({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    try {
        if (action === 'pipeline') {
            const url = `${GATEWAY_URL}/pipeline`;
            const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
            const data = await res.json();
            return jsonResponse(data);
        }

        if (action === 'health') {
            const url = `${GATEWAY_URL}/health`;
            const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
            const data = await res.json();
            return jsonResponse(data);
        }

        if (action === 'debug') {
            return jsonResponse({
                gateway_url: GATEWAY_URL,
                gateway_url_length: GATEWAY_URL.length,
                gateway_url_chars: [...GATEWAY_URL].map(c => c.charCodeAt(0)),
            });
        }

        return jsonResponse({ error: 'Invalid action. Use ?action=pipeline or ?action=health' }, { status: 400 });
    } catch (err) {
        return jsonResponse({
            error: err.message,
            gateway_url_used: GATEWAY_URL,
            cause: err.cause?.message || null,
        }, { status: 500 });
    }
}
