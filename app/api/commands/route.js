import { NextResponse } from 'next/server';
import { getCommandCenterState, runCommand } from '@/lib/command-center-store';

const COMMAND_AGENT_URL = (process.env.COMMAND_AGENT_URL || '').trim();
const COMMAND_AGENT_TOKEN = (process.env.COMMAND_AGENT_TOKEN || '').trim();

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

function getAgentBaseUrl() {
    if (!COMMAND_AGENT_URL) return '';
    return COMMAND_AGENT_URL.replace(/\/+$/, '');
}

async function callAgent(pathname, method = 'GET', body = null) {
    const baseUrl = getAgentBaseUrl();
    if (!baseUrl) return null;

    const response = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers: {
            ...(COMMAND_AGENT_TOKEN ? { Authorization: `Bearer ${COMMAND_AGENT_TOKEN}` } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
    });

    let payload = {};
    try {
        payload = await response.json();
    } catch {
        payload = {};
    }

    return {
        ok: response.ok,
        status: response.status,
        payload,
    };
}

export async function GET() {
    try {
        const agentResponse = await callAgent('/state', 'GET');
        if (agentResponse) {
            if (!agentResponse.ok) {
                return jsonResponse(
                    { error: agentResponse.payload?.error || 'Command agent unavailable' },
                    { status: agentResponse.status || 502 }
                );
            }
            return jsonResponse(agentResponse.payload);
        }
        return jsonResponse(getCommandCenterState());
    } catch (error) {
        return jsonResponse({ error: error.message || 'Failed to load command state' }, { status: 500 });
    }
}

export async function POST(request) {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
        return jsonResponse({ error: 'Unsupported content type' }, { status: 415 });
    }

    try {
        const body = await request.json();
        const commandId = typeof body?.commandId === 'string' ? body.commandId.trim() : '';
        const params = body?.params && typeof body.params === 'object' && !Array.isArray(body.params)
            ? body.params
            : {};

        if (!commandId) {
            return jsonResponse({ error: 'commandId is required' }, { status: 400 });
        }

        const agentResponse = await callAgent('/run', 'POST', { commandId, params });
        if (agentResponse) {
            if (!agentResponse.ok) {
                return jsonResponse(
                    { error: agentResponse.payload?.error || 'Command agent rejected run' },
                    { status: agentResponse.status || 502 }
                );
            }
            return jsonResponse(agentResponse.payload);
        }

        const run = runCommand(commandId, params);
        return jsonResponse({ success: true, run });
    } catch (error) {
        if (error?.code === 'E_BUSY') {
            return jsonResponse({ error: error.message }, { status: 409 });
        }
        if (error?.code === 'E_UNKNOWN_COMMAND') {
            return jsonResponse({ error: error.message }, { status: 400 });
        }
        return jsonResponse({ error: error.message || 'Command failed to start' }, { status: 500 });
    }
}
