import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getCommandCenterState, runCommand } from '@/lib/command-center-store';

const DEV_FALLBACK_TOKEN = 'ghostai-dev-token';
const AUTH_TOKEN = process.env.DASHBOARD_SECRET
    || (process.env.NODE_ENV === 'production' ? '' : DEV_FALLBACK_TOKEN);

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

function isAuthorized(request) {
    const headerToken = getBearerToken(request);
    return timingSafeTokenCheck(headerToken, AUTH_TOKEN);
}

function ensureAuthConfigured() {
    if (AUTH_TOKEN) return null;
    return jsonResponse(
        { error: 'Server misconfigured: DASHBOARD_SECRET must be set' },
        { status: 500 }
    );
}

export async function GET(request) {
    const configError = ensureAuthConfigured();
    if (configError) return configError;

    if (!isAuthorized(request)) {
        return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        return jsonResponse(getCommandCenterState());
    } catch (error) {
        return jsonResponse({ error: error.message || 'Failed to load command state' }, { status: 500 });
    }
}

export async function POST(request) {
    const configError = ensureAuthConfigured();
    if (configError) return configError;

    if (!isAuthorized(request)) {
        return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

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

