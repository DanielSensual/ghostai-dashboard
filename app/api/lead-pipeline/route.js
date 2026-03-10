import { NextResponse } from 'next/server';

const GATEWAY_URL = (process.env.GATEWAY_URL || 'http://127.0.0.1:19000').trim().replace(/\/+$/, '');

function withSecurityHeaders(response) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    return response;
}

function jsonResponse(payload, init = {}) {
    return withSecurityHeaders(NextResponse.json(payload, init));
}

// GET /api/lead-pipeline — proxy to gateway /pipeline
export async function GET() {
    try {
        const res = await fetch(`${GATEWAY_URL}/pipeline`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
            return jsonResponse(
                { error: 'Gateway unavailable', status: res.status },
                { status: 502 }
            );
        }

        const data = await res.json();

        // Also fetch health for gateway status
        let health = null;
        try {
            const healthRes = await fetch(`${GATEWAY_URL}/health`, {
                cache: 'no-store',
                signal: AbortSignal.timeout(3000),
            });
            if (healthRes.ok) health = await healthRes.json();
        } catch {
            // Gateway health check failed silently
        }

        return jsonResponse({
            ...data,
            gateway: health || { status: 'unknown' },
        });
    } catch (err) {
        // Gateway is not running
        return jsonResponse({
            pipeline: { weekly: [], today: {} },
            pendingGoals: 0,
            gateway: { status: 'offline', error: err.message },
        });
    }
}
