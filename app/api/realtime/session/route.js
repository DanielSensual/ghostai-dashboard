import { NextResponse } from 'next/server';

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const REALTIME_MODEL = (process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-1.5').trim();
const REALTIME_VOICE = (process.env.OPENAI_REALTIME_VOICE || 'ash').trim();
const GOD_MODE_SECRET = (process.env.GOD_MODE_SECRET || process.env.COMMAND_AGENT_TOKEN || '').trim();

const GHOST_SYSTEM_INSTRUCTIONS = [
    'You are GHOST, the AI command interface for Ghost AI Systems.',
    'You are the voice-control parser for the GHOST Command Terminal.',
    'Listen to the operator and rewrite their spoken request as one clean execution goal.',
    'Return only the cleaned command text — no commentary, markdown, bullets, labels, or quotes.',
    'Preserve important constraints like city names, limits, dry-run mode, and platform names.',
    'If the request is unclear or incomplete, respond exactly as: CLARIFY: <short question>',
    'Do not answer the request yourself — you are a parser, not an assistant.',
    'Keep your tone sharp, confident, and military-precise.',
    'You serve Daniel Castillo, founder of Ghost AI Systems.',
].join(' ');

function withSecurityHeaders(response) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    return response;
}

function jsonResponse(payload, init = {}) {
    return withSecurityHeaders(NextResponse.json(payload, init));
}

function authenticate(request) {
    if (!GOD_MODE_SECRET) {
        return { ok: false, error: 'Voice control is not configured. Set GOD_MODE_SECRET.', status: 503 };
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

/**
 * POST /api/realtime/session
 *
 * Returns an ephemeral client_secret for client-side WebRTC SDP exchange.
 * The client uses this token to authenticate directly with OpenAI's
 * /v1/realtime/calls endpoint, avoiding server-side SDP proxying.
 */
export async function POST(request) {
    const auth = authenticate(request);
    if (!auth.ok) {
        return jsonResponse({ error: auth.error }, { status: auth.status });
    }

    if (!OPENAI_API_KEY) {
        return jsonResponse({ error: 'OPENAI_API_KEY is not configured.' }, { status: 503 });
    }

    try {
        const payload = {
            session: {
                type: 'realtime',
                model: REALTIME_MODEL,
                voice: REALTIME_VOICE,
                instructions: GHOST_SYSTEM_INSTRUCTIONS,
                audio: {
                    output: { voice: REALTIME_VOICE },
                    input: { transcription: { model: 'whisper-1' } },
                },
            },
        };

        const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            cache: 'no-store',
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI client_secrets error:', { status: response.status, error: errorText });
            return jsonResponse(
                { error: errorText || 'Failed to create Realtime session.' },
                { status: response.status || 502 }
            );
        }

        const data = await response.json();

        // Support varying response structures across API versions
        const clientSecret =
            data?.value ||
            data?.client_secret?.value ||
            data?.session?.client_secret?.value;

        if (!clientSecret) {
            console.error('OpenAI client_secrets: missing secret in response', data);
            return jsonResponse({ error: 'Missing client secret in OpenAI response.' }, { status: 502 });
        }

        return jsonResponse({
            client_secret: clientSecret,
            model: REALTIME_MODEL,
            voice: REALTIME_VOICE,
            expires_at: data?.expires_at ?? data?.session?.expires_at ?? data?.client_secret?.expires_at,
        });
    } catch (error) {
        console.error('Realtime session error:', error);
        return jsonResponse(
            { error: error.message || 'Failed to establish Realtime session.' },
            { status: 500 }
        );
    }
}
