'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const PILLAR_COLORS = {
  value: '#22d3ee',
  hotTakes: '#fb7185',
  portfolio: '#34d399',
  bts: '#f59e0b',
  cta: '#f97316',
};

const PLATFORM_ICONS = {
  x: '𝕏',
  linkedin: 'in',
  facebook: 'f',
  instagram: '◉',
};

const TOKEN_STORAGE_KEY = 'ghostai-token';

function bootstrapTokenFromBrowser() {
  if (typeof window === 'undefined') return '';

  try {
    const saved = localStorage.getItem(TOKEN_STORAGE_KEY) || '';
    const hash = window.location.hash.replace('#', '').trim();
    const token = hash || saved || '';

    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);

    if (hash && window.history?.replaceState) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }

    return token;
  } catch {
    return '';
  }
}

function StatCard({ label, value, icon, subtitle, color }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[--color-text-muted] text-xs font-medium uppercase tracking-wide">{label}</span>
        <span className="text-lg">{icon}</span>
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
        <span className="w-7 h-7 rounded-lg bg-[--color-surface-elevated] border border-[--color-border] flex items-center justify-center text-xs font-semibold">
          {PLATFORM_ICONS[platform] || platform[0]?.toUpperCase()}
        </span>
        <div>
          <div className="font-medium capitalize">{platform === 'x' ? 'X (Twitter)' : platform}</div>
          <div className="text-xs text-[--color-text-muted]">
            {data.lastPost ? `Last post: ${new Date(data.lastPost).toLocaleString()}` : 'No post recorded'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`status-dot ${statusClass}`} />
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
    return <div className="text-[--color-text-muted] text-sm py-4">No posts recorded yet.</div>;
  }

  return (
    <div className="mt-2">
      {posts.slice(0, 10).map((post, i) => (
        <div key={`${post.timestamp || 'unknown'}-${i}`} className="timeline-entry">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="text-xs text-[--color-text-muted]">
              {post.timestamp ? new Date(post.timestamp).toLocaleString() : 'Unknown time'}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full capitalize"
              style={{ background: `${PILLAR_COLORS[post.pillar] || '#64748b'}30`, color: PILLAR_COLORS[post.pillar] || '#64748b' }}
            >
              {post.pillar || 'unknown'}
            </span>
            {post.aiGenerated && <span className="text-xs text-[--color-accent]">AI</span>}
            {post.hasVideo && <span className="text-xs">VIDEO</span>}
          </div>
          <div className="text-sm text-[--color-text-secondary]">{post.text}</div>
        </div>
      ))}
    </div>
  );
}

function DailyChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-[--color-text-muted] text-sm py-4">No posting data available yet.</div>;
  }
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-32 mt-2">
      {data.slice(-14).map((day, i) => (
        <div key={`${day.date}-${i}`} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full relative group">
            <div
              className="chart-bar w-full bg-[--color-accent]"
              style={{ height: `${(day.count / maxCount) * 100}%`, minHeight: day.count > 0 ? '4px' : '0' }}
            />
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-[--color-text-muted] opacity-0 group-hover:opacity-100 transition-opacity">
              {day.count}
            </div>
          </div>
          <span className="text-[9px] text-[--color-text-muted] rotate-[-45deg] origin-top-left">{day.date?.slice(5) || ''}</span>
        </div>
      ))}
    </div>
  );
}

function AlertLog({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return <div className="text-[--color-text-muted] text-sm py-4">No alerts in feed.</div>;
  }
  const severityColor = {
    error: 'var(--color-danger)',
    warning: 'var(--color-warning)',
    info: 'var(--color-accent)',
    success: 'var(--color-success)',
  };
  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {alerts.slice(0, 20).map((alert, i) => (
        <div key={`${alert.timestamp || 'unknown'}-${i}`} className="flex gap-3 py-2 border-b border-[--color-border] last:border-0">
          <div className="w-1 rounded-full flex-shrink-0" style={{ background: severityColor[alert.severity] || '#64748b' }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{alert.title}</div>
            <div className="text-xs text-[--color-text-muted] truncate">{alert.message}</div>
            <div className="text-[10px] text-[--color-text-muted] mt-0.5">{alert.timestamp ? new Date(alert.timestamp).toLocaleString() : ''}</div>
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
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <div className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
          <div className="text-xs text-[--color-text-muted]">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function createInitialFormValues(commands) {
  const state = {};
  for (const command of commands || []) {
    state[command.id] = {};
    for (const field of command.fields || []) {
      if (field.type === 'boolean') {
        state[command.id][field.key] = Boolean(field.defaultValue);
      } else {
        state[command.id][field.key] = String(field.defaultValue ?? '');
      }
    }
  }
  return state;
}

function CommandInput({ field, value, onChange }) {
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm text-[--color-text-secondary]">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-[--color-accent]"
        />
        {field.label}
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <label className="text-xs text-[--color-text-muted]">{field.label}</label>
        <textarea
          className="command-input command-textarea mt-1"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs text-[--color-text-muted]">{field.label}</label>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        min={field.min}
        max={field.max}
        className="command-input mt-1"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CommandCard({ command, values, onChange, onRun, busy }) {
  return (
    <div className="command-card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold">{command.title}</h3>
          <p className="text-xs text-[--color-text-muted] mt-1">{command.description}</p>
        </div>
        {busy && <span className="run-chip running">running</span>}
      </div>

      <div className="space-y-2 mb-3">
        {(command.fields || []).map((field) => (
          <CommandInput
            key={`${command.id}-${field.key}`}
            field={field}
            value={values?.[field.key]}
            onChange={(nextValue) => onChange(command.id, field.key, nextValue)}
          />
        ))}
      </div>

      <button
        type="button"
        className="command-run-btn"
        disabled={busy}
        onClick={() => onRun(command.id)}
      >
        {busy ? 'Running...' : 'Run Command'}
      </button>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [token, setToken] = useState(() => bootstrapTokenFromBrowser());
  const [loading, setLoading] = useState(() => Boolean(token));
  const [authenticated, setAuthenticated] = useState(false);

  const [commandData, setCommandData] = useState({ commands: [], runs: [], runningCount: 0 });
  const [commandForms, setCommandForms] = useState({});
  const [commandsLoading, setCommandsLoading] = useState(false);
  const [commandError, setCommandError] = useState('');
  const [selectedRunId, setSelectedRunId] = useState(null);

  const fetchAnalyticsWithToken = useCallback(async (activeToken) => {
    if (!activeToken) return false;

    try {
      const res = await fetch('/api/sync', {
        method: 'GET',
        headers: { Authorization: `Bearer ${activeToken}` },
        cache: 'no-store',
      });
      if (!res.ok) return false;
      const json = await res.json();
      setData(json);
      return true;
    } catch {
      return false;
    }
  }, []);

  const fetchCommandsWithToken = useCallback(async (activeToken) => {
    if (!activeToken) return false;

    try {
      const res = await fetch('/api/commands', {
        method: 'GET',
        headers: { Authorization: `Bearer ${activeToken}` },
        cache: 'no-store',
      });
      if (!res.ok) return false;
      const json = await res.json();
      setCommandData({
        commands: Array.isArray(json.commands) ? json.commands : [],
        runs: Array.isArray(json.runs) ? json.runs : [],
        runningCount: Number.isFinite(json.runningCount) ? json.runningCount : 0,
      });
      setCommandForms((prev) => {
        const seed = createInitialFormValues(Array.isArray(json.commands) ? json.commands : []);
        const next = { ...seed, ...prev };
        for (const command of json.commands || []) {
          next[command.id] = {
            ...(seed[command.id] || {}),
            ...(prev[command.id] || {}),
          };
        }
        return next;
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setCommandsLoading(true);

    const [analyticsOk, commandsOk] = await Promise.all([
      fetchAnalyticsWithToken(token),
      fetchCommandsWithToken(token),
    ]);

    const ok = analyticsOk || commandsOk;
    setAuthenticated(ok);
    setLoading(false);
    setCommandsLoading(false);
  }, [fetchAnalyticsWithToken, fetchCommandsWithToken, token]);

  const authenticateWithToken = useCallback(async (nextToken) => {
    if (!nextToken) return;
    setLoading(true);
    setCommandsLoading(true);

    const [analyticsOk, commandsOk] = await Promise.all([
      fetchAnalyticsWithToken(nextToken),
      fetchCommandsWithToken(nextToken),
    ]);

    setAuthenticated(analyticsOk || commandsOk);
    setLoading(false);
    setCommandsLoading(false);
  }, [fetchAnalyticsWithToken, fetchCommandsWithToken]);

  useEffect(() => {
    if (!token) return undefined;
    let mounted = true;

    const start = async () => {
      await refreshAll();
      if (!mounted) return;
    };

    void start();

    const analyticsInterval = setInterval(() => {
      void fetchAnalyticsWithToken(token);
    }, 30000);

    const commandInterval = setInterval(() => {
      void fetchCommandsWithToken(token);
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(analyticsInterval);
      clearInterval(commandInterval);
    };
  }, [fetchAnalyticsWithToken, fetchCommandsWithToken, refreshAll, token]);

  useEffect(() => {
    const runs = commandData.runs || [];
    if (runs.length === 0) {
      setSelectedRunId(null);
      return;
    }
    if (!selectedRunId || !runs.some((run) => run.id === selectedRunId)) {
      setSelectedRunId(runs[0].id);
    }
  }, [commandData.runs, selectedRunId]);

  const runningCommandIds = useMemo(() => {
    const set = new Set();
    for (const run of commandData.runs || []) {
      if (run.status === 'running') set.add(run.commandId);
    }
    return set;
  }, [commandData.runs]);

  const selectedRun = useMemo(() => {
    if (!selectedRunId) return null;
    return (commandData.runs || []).find((run) => run.id === selectedRunId) || null;
  }, [commandData.runs, selectedRunId]);

  const handleCommandFieldChange = useCallback((commandId, key, value) => {
    setCommandForms((prev) => ({
      ...prev,
      [commandId]: {
        ...(prev[commandId] || {}),
        [key]: value,
      },
    }));
  }, []);

  const handleRunCommand = useCallback(async (commandId) => {
    if (!token) return;

    setCommandError('');
    setCommandsLoading(true);

    try {
      const payload = {
        commandId,
        params: commandForms[commandId] || {},
      };

      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setCommandError(json.error || `Failed to start command (${res.status})`);
      } else if (json?.run?.id) {
        setSelectedRunId(json.run.id);
      }

      await fetchCommandsWithToken(token);
      await fetchAnalyticsWithToken(token);
    } catch (error) {
      setCommandError(error.message || 'Unexpected command error');
    } finally {
      setCommandsLoading(false);
    }
  }, [commandForms, fetchAnalyticsWithToken, fetchCommandsWithToken, token]);

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="stat-card glow-border max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold">GhostAI Command Center</h1>
            <p className="text-sm text-[--color-text-muted] mt-1">Authenticate to access operator controls.</p>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            const t = String(e.target.token.value || '').trim();
            if (!t) {
              setAuthenticated(false);
              setLoading(false);
              return;
            }
            setToken(t);
            if (typeof window !== 'undefined') {
              localStorage.setItem(TOKEN_STORAGE_KEY, t);
            }
            void authenticateWithToken(t);
          }}
          >
            <input
              name="token"
              type="password"
              placeholder="Enter access token"
              autoComplete="off"
              spellCheck={false}
              className="w-full px-4 py-3 command-input"
            />
            <button
              type="submit"
              className="w-full mt-4 command-run-btn"
            >
              Authenticate
            </button>
          </form>
          {loading && <div className="text-center text-sm text-[--color-text-muted] mt-4 animate-pulse-subtle">Verifying token...</div>}
        </div>
      </div>
    );
  }

  const d = data || {};
  const platforms = d.platforms || {};
  const stats = d.stats || {};
  const pillarMetrics = d.pillarMetrics || {};
  const maxPillarPosts = Math.max(...Object.values(pillarMetrics).map((m) => m?.totalPosts || 0), 1);

  return (
    <div className="min-h-screen pb-12">
      <header className="border-b border-[--color-border] px-6 py-4 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
          <div>
            <h1 className="text-lg font-bold">GhostAI Command Center</h1>
            <p className="text-xs text-[--color-text-muted]">
              {d.lastSync ? `Analytics sync: ${new Date(d.lastSync).toLocaleString()}` : 'Waiting for analytics sync'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="run-chip">{commandData.runningCount} active</span>
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="px-4 py-2 text-sm border border-[--color-border] rounded-lg hover:border-[--color-accent] transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        <section className="stat-card">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div>
              <h2 className="font-semibold">Operations</h2>
              <p className="text-xs text-[--color-text-muted] mt-1">Run automation tasks and monitor output in real time.</p>
            </div>
            {commandsLoading && <span className="run-chip running">syncing...</span>}
          </div>

          {commandError && (
            <div
              className="mb-4 px-3 py-2 rounded-lg border border-[--color-danger] text-sm text-[--color-danger]"
              style={{ background: 'rgba(248, 113, 113, 0.1)' }}
            >
              {commandError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(commandData.commands || []).map((command) => (
              <CommandCard
                key={command.id}
                command={command}
                values={commandForms[command.id]}
                onChange={handleCommandFieldChange}
                onRun={handleRunCommand}
                busy={runningCommandIds.has(command.id)}
              />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
          <div className="stat-card">
            <h3 className="font-semibold mb-3">Command Runs</h3>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {(commandData.runs || []).length === 0 && (
                <div className="text-sm text-[--color-text-muted]">No runs yet.</div>
              )}
              {(commandData.runs || []).map((run) => (
                <button
                  type="button"
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedRunId === run.id ? 'border-[--color-accent] bg-[--color-surface-elevated]' : 'border-[--color-border] hover:border-[--color-border-hover]'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{run.title}</div>
                    <span className={`run-chip ${run.status}`}>{run.status}</span>
                  </div>
                  <div className="text-xs text-[--color-text-muted] mt-1">
                    {new Date(run.startedAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-2 gap-3">
              <h3 className="font-semibold">Live Console</h3>
              {selectedRun && <span className={`run-chip ${selectedRun.status}`}>{selectedRun.status}</span>}
            </div>
            {!selectedRun && <div className="text-sm text-[--color-text-muted]">Select a run to inspect output.</div>}
            {selectedRun && (
              <>
                <div className="text-xs text-[--color-text-muted] mb-2">{selectedRun.commandLine}</div>
                <pre className="run-console">{selectedRun.output || 'No output yet...'}</pre>
              </>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total Posts" value={stats.totalPosts || 0} icon="📊" />
          <StatCard label="Today" value={stats.postsToday || 0} icon="📅" color="var(--color-accent)" />
          <StatCard label="AI Generated" value={stats.aiGenerated || 0} icon="🧠" color="var(--color-accent)" />
          <StatCard label="Video Posts" value={stats.videoPosts || 0} icon="🎬" />
          <StatCard label="Image Posts" value={stats.imagePosts || 0} icon="🎨" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="stat-card">
            <h2 className="font-semibold mb-3">Platform Status</h2>
            {Object.entries(platforms).map(([platform, pData]) => (
              <PlatformStatus key={platform} platform={platform} data={pData} />
            ))}
          </div>

          <div className="stat-card">
            <h2 className="font-semibold mb-3">Content Pillars</h2>
            {Object.entries(pillarMetrics).length > 0 ? (
              Object.entries(pillarMetrics).map(([name, metrics]) => (
                <PillarBar
                  key={name}
                  name={name}
                  value={metrics?.totalPosts || 0}
                  maxValue={maxPillarPosts}
                  color={PILLAR_COLORS[name] || '#64748b'}
                />
              ))
            ) : (
              <div className="text-[--color-text-muted] text-sm py-4">Pillar data will appear after more activity.</div>
            )}
          </div>

          <div className="stat-card">
            <h2 className="font-semibold mb-3">Content Queue</h2>
            <QueueSummary queue={d.queue || { pending: 0, approved: 0, posted: 0, rejected: 0 }} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="stat-card">
            <h2 className="font-semibold mb-1">Daily Posting Activity</h2>
            <DailyChart data={d.dailyPosts || []} />
          </div>

          <div className="stat-card">
            <h2 className="font-semibold mb-3">Recent Alerts</h2>
            <AlertLog alerts={d.alerts || []} />
          </div>
        </div>

        <div className="stat-card">
          <h2 className="font-semibold mb-3">Post Timeline</h2>
          <PostTimeline posts={d.postHistory || []} />
        </div>
      </main>
    </div>
  );
}
