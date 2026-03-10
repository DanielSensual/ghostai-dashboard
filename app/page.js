'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import GodModeTerminal from './components/GodModeTerminal';

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

const CLAWBOT_TYPE_STYLES = {
  message: { label: 'MSG', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  tool: { label: 'TOOL', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  error: { label: 'ERR', color: '#fb7185', bg: 'rgba(251,113,133,0.12)' },
  browser: { label: 'WEB', color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
  system: { label: 'SYS', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  unknown: { label: '???', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
};

function ClawbotActivityFeed({ activities }) {
  if (!activities || activities.length === 0) {
    return <div className="empty-state">No ClawBot activity yet. Waiting for events...</div>;
  }

  return (
    <div className="clawbot-feed">
      {activities.slice(0, 30).map((event, i) => {
        const style = CLAWBOT_TYPE_STYLES[event.type] || CLAWBOT_TYPE_STYLES.unknown;
        const timeStr = event.timestamp
          ? new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '';
        return (
          <div key={`${event.timestamp}-${i}`} className="clawbot-entry">
            <div className="clawbot-entry-header">
              <span className="clawbot-type-badge" style={{ color: style.color, background: style.bg }}>
                {style.label}
              </span>
              {event.channel && (
                <span className="clawbot-channel">{event.channel}</span>
              )}
              <span className="clawbot-time">{timeStr}</span>
              {event.status === 'error' && (
                <span className="clawbot-status-error">✗</span>
              )}
            </div>
            <div className="clawbot-message">{event.message}</div>
            {event.detail && <div className="clawbot-detail">{event.detail}</div>}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, icon, subtitle, color }) {
  return (
    <div className="stat-card hud-brackets">
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <span className="stat-card-icon">{icon}</span>
      </div>
      <div className="stat-card-value" style={{ color: color || 'var(--color-accent-blue)' }}>
        {value}
      </div>
      {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
    </div>
  );
}

function PlatformStatus({ platform, data }) {
  const statusClass = data.status === 'connected' ? 'online' : data.status === 'warning' ? 'warning' : 'offline';
  return (
    <div className="platform-row">
      <div className="platform-info">
        <span className="platform-icon-box" style={{ borderColor: statusClass === 'online' ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {PLATFORM_ICONS[platform] || platform[0]?.toUpperCase()}
        </span>
        <div>
          <div className="platform-name" style={{ color: 'var(--color-text-primary)' }}>{platform === 'x' ? 'X (TWITTER)' : platform.toUpperCase()}</div>
          <div className="platform-last-post" style={{ fontFamily: 'var(--font-mono)' }}>
            {data.lastPost ? `LST:[${new Date(data.lastPost).toLocaleTimeString()}]` : 'NO DATA'}
          </div>
        </div>
      </div>
      <div className="platform-status">
        <span className={`status-dot ${statusClass}`} />
        <span className="platform-status-label" style={{ fontFamily: 'var(--font-mono)' }}>{data.status.toUpperCase()}</span>
      </div>
    </div>
  );
}

function PillarBar({ name, value, maxValue, color }) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="pillar-row">
      <div className="pillar-label">
        <span className="pillar-name">{name}</span>
        <span className="pillar-count">{value} posts</span>
      </div>
      <div className="pillar-bar">
        <div className="pillar-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function PostTimeline({ posts }) {
  if (!posts || posts.length === 0) {
    return <div className="empty-state">No posts recorded yet.</div>;
  }

  return (
    <div className="timeline-list">
      {posts.slice(0, 10).map((post, i) => (
        <div key={`${post.timestamp || 'unknown'}-${i}`} className="timeline-entry">
          <div className="timeline-meta">
            <span className="timeline-time">
              {post.timestamp ? new Date(post.timestamp).toLocaleString() : 'Unknown time'}
            </span>
            <span
              className="timeline-pillar-tag"
              style={{ background: `${PILLAR_COLORS[post.pillar] || '#64748b'}30`, color: PILLAR_COLORS[post.pillar] || '#64748b' }}
            >
              {post.pillar || 'unknown'}
            </span>
            {post.aiGenerated && <span className="timeline-ai-tag">AI</span>}
            {post.hasVideo && <span className="timeline-video-tag">VIDEO</span>}
          </div>
          <div className="timeline-text">{post.text}</div>
        </div>
      ))}
    </div>
  );
}

function DailyChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="empty-state">No posting data available yet.</div>;
  }
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="daily-chart">
      {data.slice(-14).map((day, i) => (
        <div key={`${day.date}-${i}`} className="daily-chart-col">
          <div className="daily-chart-bar-wrap">
            <div
              className="chart-bar"
              style={{ height: `${(day.count / maxCount) * 100}%`, minHeight: day.count > 0 ? '4px' : '0' }}
            />
            <div className="daily-chart-tooltip">{day.count}</div>
          </div>
          <span className="daily-chart-label">{day.date?.slice(5) || ''}</span>
        </div>
      ))}
    </div>
  );
}

function AlertLog({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return <div className="empty-state">No alerts in feed.</div>;
  }
  const severityColor = {
    error: 'var(--color-danger)',
    warning: 'var(--color-warning)',
    info: 'var(--color-accent)',
    success: 'var(--color-success)',
  };
  return (
    <div className="alert-list">
      {alerts.slice(0, 20).map((alert, i) => (
        <div key={`${alert.timestamp || 'unknown'}-${i}`} className="alert-row">
          <div className="alert-severity-bar" style={{ background: severityColor[alert.severity] || '#64748b' }} />
          <div className="alert-content">
            <div className="alert-title">{alert.title}</div>
            <div className="alert-message">{alert.message}</div>
            <div className="alert-time">{alert.timestamp ? new Date(alert.timestamp).toLocaleString() : ''}</div>
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
    <div className="queue-grid">
      {items.map((item) => (
        <div key={item.label} className="queue-item">
          <div className="queue-value" style={{ color: item.color }}>{item.value}</div>
          <div className="queue-label">{item.label}</div>
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
      <label className="command-checkbox-label">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="command-checkbox"
        />
        {field.label}
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <label className="command-field-label">{field.label}</label>
        <textarea
          className="command-input command-textarea"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div>
      <label className="command-field-label">{field.label}</label>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        min={field.min}
        max={field.max}
        className="command-input"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CommandCard({ command, values, onChange, onRun, busy }) {
  return (
    <div className="command-card hud-brackets">
      <div className="command-card-header">
        <div>
          <h3 className="command-title">{command.title}</h3>
          <p className="command-desc">{command.description}</p>
        </div>
        {busy && <span className="run-chip running">running</span>}
      </div>

      <div className="command-fields">
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
        {busy ? 'EXECUTING...' : 'INITIATE COMMAND'}
      </button>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [commandData, setCommandData] = useState({ commands: [], runs: [], runningCount: 0, executorMode: 'unknown' });
  const [commandForms, setCommandForms] = useState({});
  const [commandsLoading, setCommandsLoading] = useState(false);
  const [commandError, setCommandError] = useState('');
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [godModeOpen, setGodModeOpen] = useState(false);

  // ClawBot activity state
  const [clawbotActivities, setClawbotActivities] = useState([]);

  // Ghost Agent pipeline state
  const [pipeline, setPipeline] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/sync', { cache: 'no-store' });
      if (!res.ok) return false;
      const json = await res.json();
      setData(json);
      return true;
    } catch {
      return false;
    }
  }, []);

  const fetchCommands = useCallback(async () => {
    try {
      const res = await fetch('/api/commands', { cache: 'no-store' });
      if (!res.ok) return false;
      const json = await res.json();
      setCommandData({
        commands: Array.isArray(json.commands) ? json.commands : [],
        runs: Array.isArray(json.runs) ? json.runs : [],
        runningCount: Number.isFinite(json.runningCount) ? json.runningCount : 0,
        executorMode: String(json.executorMode || 'unknown'),
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

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch('/api/lead-pipeline', { cache: 'no-store' });
      if (!res.ok) return false;
      const json = await res.json();
      setPipeline(json);
      return true;
    } catch {
      return false;
    }
  }, []);

  const fetchClawbot = useCallback(async () => {
    try {
      const res = await fetch('/api/clawbot', { cache: 'no-store' });
      if (!res.ok) return false;
      const json = await res.json();
      setClawbotActivities(Array.isArray(json.activities) ? json.activities : []);
      return true;
    } catch {
      return false;
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setCommandsLoading(true);

    await Promise.all([fetchAnalytics(), fetchCommands(), fetchPipeline(), fetchClawbot()]);

    setLoading(false);
    setCommandsLoading(false);
  }, [fetchAnalytics, fetchCommands, fetchPipeline, fetchClawbot]);

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      await refreshAll();
      if (!mounted) return;
    };

    void start();

    const analyticsInterval = setInterval(() => {
      void fetchAnalytics();
    }, 30000);

    const commandInterval = setInterval(() => {
      void fetchCommands();
    }, 5000);

    const pipelineInterval = setInterval(() => {
      void fetchPipeline();
    }, 30000);

    const clawbotInterval = setInterval(() => {
      void fetchClawbot();
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(analyticsInterval);
      clearInterval(commandInterval);
      clearInterval(pipelineInterval);
      clearInterval(clawbotInterval);
    };
  }, [fetchAnalytics, fetchCommands, fetchPipeline, fetchClawbot, refreshAll]);

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
    setCommandError('');
    setCommandsLoading(true);

    try {
      const payload = {
        commandId,
        params: commandForms[commandId] || {},
      };

      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setCommandError(json.error || `Failed to start command (${res.status})`);
      } else if (json?.run?.id) {
        setSelectedRunId(json.run.id);
      }

      await fetchCommands();
      await fetchAnalytics();
    } catch (error) {
      setCommandError(error.message || 'Unexpected command error');
    } finally {
      setCommandsLoading(false);
    }
  }, [commandForms, fetchAnalytics, fetchCommands]);

  // Split commands into Ghost Agent vs Social
  const ghostCommands = useMemo(() => {
    return (commandData.commands || []).filter(c => c.id.startsWith('ghost-'));
  }, [commandData.commands]);

  const socialCommands = useMemo(() => {
    return (commandData.commands || []).filter(c => !c.id.startsWith('ghost-'));
  }, [commandData.commands]);

  const d = data || {};
  const platforms = d.platforms || {};
  const stats = d.stats || {};
  const pillarMetrics = d.pillarMetrics || {};
  const maxPillarPosts = Math.max(...Object.values(pillarMetrics).map((m) => m?.totalPosts || 0), 1);

  // Pipeline stats
  const gw = pipeline?.gateway || {};
  const gwOnline = gw.status === 'ok';
  const todayStats = pipeline?.pipeline?.today || {};
  const weeklyStats = pipeline?.pipeline?.weekly || [];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-decor" />
        <div className="dashboard-header-inner">
          <div className="dashboard-header-title-group">
            <span className="dashboard-header-emoji" style={{ color: 'var(--color-accent-blue)', textShadow: 'var(--glow-cyan)' }}>⟁</span>
            <div>
              <h1 className="dashboard-title">GHOST // COMMAND CENTER</h1>
              <p className="dashboard-sync-status">
                {d.lastSync ? `Analytics sync: ${new Date(d.lastSync).toLocaleString()}` : 'Waiting for analytics sync'}
              </p>
            </div>
          </div>
          <div className="dashboard-header-actions">
            <span className={`run-chip ${gwOnline ? 'succeeded' : 'failed'}`}>
              Gateway {gwOnline ? 'Online' : 'Offline'}
            </span>
            <span className="run-chip">{gw.tools || 0} tools</span>
            <span className="run-chip">{commandData.runningCount} active</span>
            <button
              type="button"
              onClick={() => setGodModeOpen(true)}
              className="refresh-btn"
              style={{ border: '1px solid var(--color-accent-amber)', color: 'var(--color-accent-amber)', fontWeight: 700 }}
            >
              [ OVERRIDE PROTOCOL ]
            </button>
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="refresh-btn"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Ghost Agent Pipeline Stats */}
        <div className="stats-grid">
          <StatCard
            label="Gateway"
            value={gwOnline ? 'Online' : 'Offline'}
            icon="👻"
            color={gwOnline ? 'var(--color-success)' : 'var(--color-danger)'}
            subtitle={gwOnline ? `Model: ${gw.model || 'gpt-5.4'}` : 'Start with 🚀 Start Gateway'}
          />
          <StatCard
            label="Leads Hunted"
            value={todayStats.lead_hunted?.count || 0}
            icon="🎯"
            color="var(--color-accent)"
            subtitle={`${weeklyStats.find(w => w.type === 'lead_hunted')?.count || 0} this week`}
          />
          <StatCard
            label="Emails Sent"
            value={todayStats.email_sent?.count || 0}
            icon="📧"
            color="var(--color-warning)"
            subtitle={`${weeklyStats.find(w => w.type === 'email_sent')?.count || 0} this week`}
          />
          <StatCard
            label="Invoices"
            value={todayStats.invoice_created?.count || 0}
            icon="💰"
            color="var(--color-success)"
            subtitle={`$${weeklyStats.find(w => w.type === 'invoice_created')?.total || 0} this week`}
          />
          <StatCard
            label="Social Posts"
            value={todayStats.social_post?.count || 0}
            icon="📱"
            subtitle={`${weeklyStats.find(w => w.type === 'social_post')?.count || 0} this week`}
          />
        </div>

        {/* Ghost Agent Operations */}
        <section className="stat-card hud-brackets">
          <div className="ops-header">
            <div>
              <h2 className="section-title">SYSTEM.AGENTS // GHOST</h2>
              <p className="section-subtitle">Autonomous revenue engine — telemetry active.</p>
            </div>
            {commandsLoading && <span className="run-chip running">syncing...</span>}
          </div>

          {commandError && (
            <div className="command-error">
              {commandError}
            </div>
          )}

          <div className="commands-grid">
            {ghostCommands.map((command) => (
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

        {/* ClawBot Activity Feed */}
        <section className="stat-card hud-brackets">
          <div className="ops-header">
            <div>
              <h2 className="section-title">🦞 ClawBot Activity</h2>
              <p className="section-subtitle">Live feed of OpenClaw agent actions — messages, tools, browser, errors.</p>
            </div>
            <span className="run-chip" style={{ fontSize: '0.7rem' }}>{clawbotActivities.length} events</span>
          </div>
          <ClawbotActivityFeed activities={clawbotActivities} />
        </section>

        {/* Social Media Operations */}
        <section className="stat-card hud-brackets">
          <div className="ops-header">
            <div>
              <h2 className="section-title">Social Operations</h2>
              <p className="section-subtitle">Run automation tasks and monitor output in real time.</p>
            </div>
          </div>

          <div className="commands-grid">
            {socialCommands.map((command) => (
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

        {/* Command Runs + Live Console */}
        <section className="runs-layout">
          <div className="stat-card hud-brackets">
            <h3 className="section-title">Command Runs</h3>
            <div className="runs-list">
              {(commandData.runs || []).length === 0 && (
                <div className="empty-state">No runs yet.</div>
              )}
              {(commandData.runs || []).map((run) => (
                <button
                  type="button"
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className={`run-entry ${selectedRunId === run.id ? 'run-entry-active' : ''}`}
                >
                  <div className="run-entry-header">
                    <div className="run-entry-title">{run.title}</div>
                    <span className={`run-chip ${run.status}`}>{run.status}</span>
                  </div>
                  <div className="run-entry-time">
                    {new Date(run.startedAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="stat-card hud-brackets">
            <div className="console-header">
              <h3 className="section-title">Live Console</h3>
              {selectedRun && <span className={`run-chip ${selectedRun.status}`}>{selectedRun.status}</span>}
            </div>
            {!selectedRun && <div className="empty-state">Select a run to inspect output.</div>}
            {selectedRun && (
              <>
                <div className="console-command-line">{selectedRun.commandLine}</div>
                <pre className="run-console">{selectedRun.output || 'No output yet...'}</pre>
              </>
            )}
          </div>
        </section>

        {/* Analytics Stat Cards Row */}
        <div className="stats-grid">
          <StatCard label="Total Posts" value={stats.totalPosts || 0} icon="📊" />
          <StatCard label="Today" value={stats.postsToday || 0} icon="📅" color="var(--color-accent)" />
          <StatCard label="AI Generated" value={stats.aiGenerated || 0} icon="🧠" color="var(--color-accent)" />
          <StatCard label="Video Posts" value={stats.videoPosts || 0} icon="🎬" />
          <StatCard label="Image Posts" value={stats.imagePosts || 0} icon="🎨" />
        </div>

        {/* Platform Status / Pillars / Queue */}
        <div className="analytics-grid">
          <div className="stat-card hud-brackets">
            <h2 className="section-title">Platform Status</h2>
            {Object.entries(platforms).map(([platform, pData]) => (
              <PlatformStatus key={platform} platform={platform} data={pData} />
            ))}
          </div>

          <div className="stat-card hud-brackets">
            <h2 className="section-title">Content Pillars</h2>
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
              <div className="empty-state">Pillar data will appear after more activity.</div>
            )}
          </div>

          <div className="stat-card hud-brackets">
            <h2 className="section-title">Content Queue</h2>
            <QueueSummary queue={d.queue || { pending: 0, approved: 0, posted: 0, rejected: 0 }} />
          </div>
        </div>

        {/* Charts Row */}
        <div className="charts-grid">
          <div className="stat-card hud-brackets">
            <h2 className="section-title">Daily Posting Activity</h2>
            <DailyChart data={d.dailyPosts || []} />
          </div>

          <div className="stat-card hud-brackets">
            <h2 className="section-title">Recent Alerts</h2>
            <AlertLog alerts={d.alerts || []} />
          </div>
        </div>

        {/* Post Timeline */}
        <div className="stat-card hud-brackets">
          <h2 className="section-title">Post Timeline</h2>
          <PostTimeline posts={d.postHistory || []} />
        </div>
      </main>
      <GodModeTerminal isOpen={godModeOpen} onClose={() => setGodModeOpen(false)} />
    </div>
  );
}
