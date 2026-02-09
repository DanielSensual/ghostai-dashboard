import { NextResponse } from 'next/server';
import { getData, setData } from '@/lib/store';

const AUTH_TOKEN = process.env.DASHBOARD_SECRET || 'ghostai-dev-token';

function checkAuth(request) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    return token === AUTH_TOKEN;
}

// GET: Return current dashboard data
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (token !== AUTH_TOKEN && !checkAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(getData());
}

// POST: Receive data push from the bot
export async function POST(request) {
    if (!checkAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        setData(body);
        return NextResponse.json({ success: true, synced: new Date().toISOString() });
    } catch (err) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
}
