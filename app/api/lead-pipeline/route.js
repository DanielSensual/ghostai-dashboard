import { NextResponse } from 'next/server';
import { getLeadPipelineData, setLeadPipelineData } from '@/lib/lead-store';

const GATEWAY_URL = (process.env.GATEWAY_URL || 'http://127.0.0.1:19000').trim().replace(/\/+$/, '');
const MAX_BODY_BYTES = Math.max(1024, Number.parseInt(process.env.DASHBOARD_MAX_BODY_BYTES || '1048576', 10) || 1048576);
const LEAD_PIPELINE_TOKEN = (process.env.DASHBOARD_LEAD_PIPELINE_TOKEN || process.env.DASHBOARD_SYNC_TOKEN || '').trim();

function authenticatePipelinePush(request) {
    if (!LEAD_PIPELINE_TOKEN) return { ok: true };
    const authHeader = request.headers.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const apiKey = (request.headers.get('x-api-key') || '').trim();
    return bearerToken === LEAD_PIPELINE_TOKEN || apiKey === LEAD_PIPELINE_TOKEN
        ? { ok: true }
        : { ok: false };
}

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
    const pushedData = getLeadPipelineData();
    if (pushedData?.lastSync) {
        return jsonResponse({
            ...pushedData,
            gateway: { status: 'push-sync' },
        });
    }

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

// POST /api/lead-pipeline — receive Lead Hunter pipeline snapshots.
export async function POST(request) {
    if (!authenticatePipelinePush(request).ok) {
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
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return jsonResponse({ error: 'Invalid payload' }, { status: 400 });
        }

        setLeadPipelineData({
            pipeline: body.pipeline || {},
            campaigns: Array.isArray(body.campaigns) ? body.campaigns.slice(0, 100) : [],
            topLeads: Array.isArray(body.topLeads) ? body.topLeads.slice(0, 100) : [],
            segmentBreakdown: Array.isArray(body.segmentBreakdown) ? body.segmentBreakdown.slice(0, 100) : [],
            dailySendSeries: Array.isArray(body.dailySendSeries) ? body.dailySendSeries.slice(0, 100) : [],
        });

        return jsonResponse({ success: true, synced: new Date().toISOString() });
    } catch {
        return jsonResponse({ error: 'Invalid JSON' }, { status: 400 });
    }
}
