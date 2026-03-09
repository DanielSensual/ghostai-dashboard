/**
 * In-memory data store for dashboard
 * In production, this could be backed by Vercel KV/Redis.
 * The bot pushes data via POST /api/sync.
 */

let dashboardData = {
    lastSync: null,
    platforms: {
        x: { status: 'unknown', lastPost: null, followers: 0 },
        linkedin: { status: 'unknown', lastPost: null, connections: 0 },
        facebook: { status: 'unknown', lastPost: null, likes: 0 },
        instagram: { status: 'unknown', lastPost: null, followers: 0 },
    },
    postHistory: [],       // Recent posts array
    pillarMetrics: {},     // Engagement per pillar
    queue: { pending: 0, approved: 0, posted: 0, rejected: 0 },
    stats: {
        totalPosts: 0,
        postsToday: 0,
        aiGenerated: 0,
        videoPosts: 0,
        imagePosts: 0,
    },
    alerts: [],            // Recent alerts/errors
    dailyPosts: [],        // Array of { date, count } for chart
};

let clawbotActivities = [];
const CLAWBOT_MAX_EVENTS = 100;

export function getData() {
    return dashboardData;
}

export function setData(newData) {
    dashboardData = {
        ...dashboardData,
        ...newData,
        lastSync: new Date().toISOString(),
    };
}

export function addAlert(alert) {
    dashboardData.alerts.unshift({
        ...alert,
        timestamp: new Date().toISOString(),
    });
    // Keep last 50 alerts
    dashboardData.alerts = dashboardData.alerts.slice(0, 50);
}

export function getClawbotActivities() {
    return clawbotActivities;
}

export function addClawbotActivities(events) {
    if (!Array.isArray(events)) return 0;
    const sanitized = events.slice(0, 50).map((e) => ({
        type: String(e.type || 'unknown').slice(0, 32),
        channel: String(e.channel || '').slice(0, 32),
        message: String(e.message || '').slice(0, 500),
        status: String(e.status || 'ok').slice(0, 16),
        timestamp: e.timestamp || new Date().toISOString(),
        detail: String(e.detail || '').slice(0, 200),
    }));
    clawbotActivities = [...sanitized, ...clawbotActivities].slice(0, CLAWBOT_MAX_EVENTS);
    return sanitized.length;
}
