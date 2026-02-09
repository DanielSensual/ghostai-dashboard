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
