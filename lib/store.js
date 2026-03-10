/**
 * Persistent data store for dashboard
 * Uses /tmp JSON file to survive Vercel warm invocations.
 * Falls back to in-memory on read failure.
 * The bot pushes data via POST /api/sync.
 */

import fs from 'fs';
import path from 'path';

const STORE_PATH = path.join('/tmp', 'ghostai-dashboard-data.json');
const CLAWBOT_PATH = path.join('/tmp', 'ghostai-clawbot-events.json');

const DEFAULTS = {
    lastSync: null,
    platforms: {
        x: { status: 'unknown', lastPost: null, followers: 0 },
        linkedin: { status: 'unknown', lastPost: null, connections: 0 },
        facebook: { status: 'unknown', lastPost: null, likes: 0 },
        instagram: { status: 'unknown', lastPost: null, followers: 0 },
    },
    postHistory: [],
    pillarMetrics: {},
    queue: { pending: 0, approved: 0, posted: 0, rejected: 0 },
    stats: {
        totalPosts: 0,
        postsToday: 0,
        aiGenerated: 0,
        videoPosts: 0,
        imagePosts: 0,
    },
    alerts: [],
    dailyPosts: [],
};

// In-memory cache (populated from disk on first read)
let dashboardData = null;
let clawbotActivities = null;
const CLAWBOT_MAX_EVENTS = 100;

function readFromDisk(filepath, fallback) {
    try {
        if (fs.existsSync(filepath)) {
            return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        }
    } catch {
        // Corrupted file — start fresh
    }
    return fallback;
}

function writeToDisk(filepath, data) {
    try {
        fs.writeFileSync(filepath, JSON.stringify(data), 'utf-8');
    } catch {
        // /tmp write failure — non-fatal, data is still in memory
    }
}

export function getData() {
    if (!dashboardData) {
        dashboardData = readFromDisk(STORE_PATH, { ...DEFAULTS });
    }
    return dashboardData;
}

export function setData(newData) {
    if (!dashboardData) {
        dashboardData = readFromDisk(STORE_PATH, { ...DEFAULTS });
    }
    dashboardData = {
        ...dashboardData,
        ...newData,
        lastSync: new Date().toISOString(),
    };
    writeToDisk(STORE_PATH, dashboardData);
}

export function addAlert(alert) {
    const data = getData();
    data.alerts.unshift({
        ...alert,
        timestamp: new Date().toISOString(),
    });
    data.alerts = data.alerts.slice(0, 50);
    writeToDisk(STORE_PATH, data);
}

export function getClawbotActivities() {
    if (!clawbotActivities) {
        clawbotActivities = readFromDisk(CLAWBOT_PATH, []);
    }
    return clawbotActivities;
}

export function addClawbotActivities(events) {
    if (!Array.isArray(events)) return 0;
    if (!clawbotActivities) {
        clawbotActivities = readFromDisk(CLAWBOT_PATH, []);
    }
    const sanitized = events.slice(0, 50).map((e) => ({
        type: String(e.type || 'unknown').slice(0, 32),
        channel: String(e.channel || '').slice(0, 32),
        message: String(e.message || '').slice(0, 500),
        status: String(e.status || 'ok').slice(0, 16),
        timestamp: e.timestamp || new Date().toISOString(),
        detail: String(e.detail || '').slice(0, 200),
    }));
    clawbotActivities = [...sanitized, ...clawbotActivities].slice(0, CLAWBOT_MAX_EVENTS);
    writeToDisk(CLAWBOT_PATH, clawbotActivities);
    return sanitized.length;
}
