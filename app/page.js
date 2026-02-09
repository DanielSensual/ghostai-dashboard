'use client';

import { useState, useEffect, useCallback } from 'react';

const PILLAR_COLORS = {
  value: '#6366f1',
  hotTakes: '#ef4444',
  portfolio: '#22c55e',
  bts: '#f59e0b',
  cta: '#ec4899',
};

const PLATFORM_ICONS = {
  x: '𝕏',
  linkedin: '🔗',
  facebook: '📘',
  instagram: '📸',
};

function StatCard({ label, value, icon, subtitle, color }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[--color-text-muted] text-sm font-medium">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold" style={{ color: color || 'var(--color-text-primary)' }}>
        {value}
      </div>
      {subtitle && <div className="text-xs text-[--color-text-muted] mt-1">{subtitle}</div>}
    </div>
  );
}

function PlatformStatus({ platform, data }) {
  const statusClass = data.status === 'connected' ? 'online' : data.status === 'warning' ? 'warning' : 'offline';
  return (
    <div className="flex items-center justify-between py-3 border-b border-[--color-border] last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-lg">{PLATFORM_ICONS[platform]}</span>
        <div>
          <div className="font-medium capitalize">{platform === 'x' ? 'X (Twitter)' : platform}</div>
          <div className="text-xs text-[--color-text-muted]">
            {data.lastPost ? `Last post: ${new Date(data.lastPost).toLocaleDateString()}` : 'No posts yet'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`status-dot ${statusClass}`}></span>
        <span className="text-xs text-[--color-text-secondary] capitalize">{data.status}</span>
      </div>
    </div>
  );
}

function PillarBar({ name, value, maxValue, color }) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="capitalize font-medium">{name}</span>
        <span className="text-[--color-text-muted]">{value} posts</span>
      </div>
      <div className="pillar-bar">
        <div className="pillar-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function PostTimeline({ posts }) {
  if (!posts || posts.length === 0) {
    return <div className="text-[--color-text-muted] text-sm py-4">No posts recorded yet. Sync data from the bot.</div>;
  }
  return (
    <div className="mt-2">
      {posts.slice(0, 10).map((post, i) => (
        <div key={i} className="timeline-entry">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-[--color-text-muted]">
              {post.timestamp ? new Date(post.timestamp).toLocaleString() : 'Unknown time'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full capitalize"
              style={{ background: PILLAR_COLORS[post.pillar] + '20', color: PILLAR_COLORS[post.pillar] || '#888' }}>
              {post.pillar}
            </span>
            {post.aiGenerated && <span className="text-xs text-[--color-accent]">🧠 AI</span>}
            {post.hasVideo && <span className="text-xs">🎬</span>}
            {post.hasImage && <span className="text-xs">🎨</span>}
          </div>
          <div className="text-sm text-[--color-text-secondary] line-clamp-2">
            {post.text}
          </div>
          <div className="flex gap-3 mt-1">
            {post.results?.x && <span className="text-xs text-[--color-text-muted]">✅ X</span>}
            {post.results?.linkedin && <span className="text-xs text-[--color-text-muted]">✅ LinkedIn</span>}
            {post.results?.facebook && <span className="text-xs text-[--color-text-muted]">✅ Facebook</span>}
            {post.results?.instagram && <span className="text-xs text-[--color-text-muted]">✅ Instagram</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function DailyChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-[--color-text-muted] text-sm py-4">No posting data available yet.</div>;
  }
  const maxCount = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-32 mt-2">
      {data.slice(-14).map((day, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full relative group">
            <div
              className="chart-bar w-full bg-[--color-accent]"
              style={{ height: `${(day.count / maxCount) * 100}%`, minHeight: day.count > 0 ? '4px' : '0' }}
            />
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-[--color-text-muted] opacity-0 group-hover:opacity-100 transition-opacity">
              {day.count}
            </div>
          </div>
          <span className="text-[9px] text-[--color-text-muted] rotate-[-45deg] origin-top-left">
            {day.date?.slice(5) || ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function AlertLog({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return <div className="text-[--color-text-muted] text-sm py-4">No alerts. All systems operational.</div>;
  }
  const severityColor = { error: 'var(--color-danger)', warning: 'var(--color-warning)', info: 'var(--color-accent)', success: 'var(--color-success)' };
  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {alerts.slice(0, 20).map((alert, i) => (
        <div key={i} className="flex gap-3 py-2 border-b border-[--color-border] last:border-0">
          <div className="w-1 rounded-full flex-shrink-0" style={{ background: severityColor[alert.severity] || '#555' }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{alert.title}</div>
            <div className="text-xs text-[--color-text-muted] truncate">{alert.message}</div>
            <div className="text-[10px] text-[--color-text-muted] mt-0.5">
              {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function QueueSummary({ queue }) {
  const items = [
    { label: 'Pending', value: queue.pending, color: 'var(--color-warning)' },
    { label: 'Approved', value: queue.approved, color: 'var(--color-success)' },
    { label: 'Posted', value: queue.posted, color: 'var(--color-accent)' },
    { label: 'Rejected', value: queue.rejected, color: 'var(--color-danger)' },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map(item => (
        <div key={item.label} className="text-center">
          <div className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
          <div className="text-xs text-[--color-text-muted]">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/sync?token=${encodeURIComponent(token)}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setAuthenticated(true);
      } else {
        setAuthenticated(false);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    // Check for token in URL hash or localStorage
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ghostai-token') : '';
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    const t = hash || saved || '';
    if (t) {
      setToken(t);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ghostai-token', t);
        window.location.hash = '';
      }
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchData();
      const interval = setInterval(fetchData, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [token, fetchData]);

  // Login screen
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="stat-card glow-border max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">👻</div>
            <h1 className="text-xl font-bold">GhostAI Dashboard</h1>
            <p className="text-sm text-[--color-text-muted] mt-1">Private Analytics & Command Center</p>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            const t = e.target.token.value;
            setToken(t);
            localStorage.setItem('ghostai-token', t);
            setLoading(true);
            setTimeout(fetchData, 100);
          }}>
            <input
              name="token"
              type="password"
              placeholder="Enter access token"
              className="w-full px-4 py-3 bg-[--color-background] border border-[--color-border] rounded-lg text-sm focus:outline-none focus:border-[--color-accent] transition-colors"
            />
            <button
              type="submit"
              className="w-full mt-4 px-4 py-3 bg-[--color-accent] text-white rounded-lg text-sm font-medium hover:brightness-110 transition-all"
            >
              Authenticate
            </button>
          </form>
          {loading && <div className="text-center text-sm text-[--color-text-muted] mt-4 animate-pulse-subtle">Verifying...</div>}
        </div>
      </div>
    );
  }

  const d = data || {};
  const platforms = d.platforms || {};
  const stats = d.stats || {};
  const pillarMetrics = d.pillarMetrics || {};
  const maxPillarPosts = Math.max(...Object.values(pillarMetrics).map(m => m?.totalPosts || 0), 1);

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="border-b border-[--color-border] px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👻</span>
            <div>
              <h1 className="text-lg font-bold">GhostAI Command Center</h1>
              <p className="text-xs text-[--color-text-muted]">
                {d.lastSync ? `Last sync: ${new Date(d.lastSync).toLocaleString()}` : 'Awaiting first sync'}
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 text-sm border border-[--color-border] rounded-lg hover:border-[--color-accent] transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total Posts" value={stats.totalPosts || 0} icon="📊" />
          <StatCard label="Today" value={stats.postsToday || 0} icon="📅" color="var(--color-accent)" />
          <StatCard label="AI Generated" value={stats.aiGenerated || 0} icon="🧠" color="var(--color-accent)" />
          <StatCard label="Video Posts" value={stats.videoPosts || 0} icon="🎬" />
          <StatCard label="Image Posts" value={stats.imagePosts || 0} icon="🎨" />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Platform Status */}
          <div className="stat-card">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <span>📡</span> Platform Status
            </h2>
            {Object.entries(platforms).map(([platform, pData]) => (
              <PlatformStatus key={platform} platform={platform} data={pData} />
            ))}
          </div>

          {/* Content Pillars Performance */}
          <div className="stat-card">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <span>📊</span> Content Pillars
            </h2>
            {Object.entries(pillarMetrics).length > 0 ? (
              Object.entries(pillarMetrics).map(([name, metrics]) => (
                <PillarBar
                  key={name}
                  name={name}
                  value={metrics?.totalPosts || 0}
                  maxValue={maxPillarPosts}
                  color={PILLAR_COLORS[name] || '#555'}
                />
              ))
            ) : (
              <div className="text-[--color-text-muted] text-sm py-4">
                Pillar data will appear after posts accumulate engagement metrics.
              </div>
            )}
          </div>

          {/* Queue */}
          <div className="stat-card">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <span>📋</span> Content Queue
            </h2>
            <QueueSummary queue={d.queue || { pending: 0, approved: 0, posted: 0, rejected: 0 }} />
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Posting Chart */}
          <div className="stat-card">
            <h2 className="font-semibold mb-1 flex items-center gap-2">
              <span>📈</span> Daily Posting Activity
            </h2>
            <DailyChart data={d.dailyPosts || []} />
          </div>

          {/* Alerts */}
          <div className="stat-card">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <span>🚨</span> Recent Alerts
            </h2>
            <AlertLog alerts={d.alerts || []} />
          </div>
        </div>

        {/* Post Timeline */}
        <div className="stat-card">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <span>📝</span> Post Timeline
          </h2>
          <PostTimeline posts={d.postHistory || []} />
        </div>
      </main>
    </div>
  );
}
