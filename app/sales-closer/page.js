'use client';

import { useEffect, useState, useCallback } from 'react';

const TIER_STYLES = {
    close_now: { emoji: '🔥', label: 'CLOSE NOW', color: 'hsl(15, 100%, 55%)', bg: 'hsla(15, 100%, 55%, 0.12)' },
    warm_pursuit: { emoji: '🟡', label: 'WARM PURSUIT', color: 'hsl(45, 100%, 55%)', bg: 'hsla(45, 100%, 55%, 0.12)' },
    dormant: { emoji: '🧊', label: 'DORMANT', color: 'hsl(200, 70%, 60%)', bg: 'hsla(200, 70%, 60%, 0.12)' },
};

const CHANNEL_ICONS = { email: '📧', sms: '📱', voice: '📞', system: '⚙️' };

function StatCard({ label, value, icon, color, subtitle }) {
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

function FunnelStage({ label, count, total, color, icon }) {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return (
        <div className="closer-funnel-stage">
            <div className="closer-funnel-header">
                <span className="closer-funnel-icon">{icon}</span>
                <span className="closer-funnel-label">{label}</span>
                <span className="closer-funnel-count" style={{ color }}>{count}</span>
            </div>
            <div className="closer-funnel-bar-track">
                <div
                    className="closer-funnel-bar-fill"
                    style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%`, background: color }}
                />
            </div>
            <div className="closer-funnel-pct">{pct.toFixed(1)}%</div>
        </div>
    );
}

function SignalBadge({ tier }) {
    const style = TIER_STYLES[tier] || TIER_STYLES.dormant;
    return (
        <span className="closer-signal-badge" style={{ color: style.color, background: style.bg, borderColor: style.color }}>
            {style.emoji} {style.label}
        </span>
    );
}

function TopSignalsTable({ signals }) {
    if (!signals.length) {
        return <div className="empty-state">No signal data yet. Run the closer pipeline to compute scores.</div>;
    }

    return (
        <div className="table-scroll">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Lead</th>
                        <th>Score</th>
                        <th>Tier</th>
                        <th>Segment</th>
                        <th>Closer Status</th>
                        <th>Touches</th>
                        <th>Signals</th>
                    </tr>
                </thead>
                <tbody>
                    {signals.map((sig, i) => {
                        const signalKeys = Object.keys(sig.signals || {});
                        return (
                            <tr key={`${sig.name}-${i}`}>
                                <td>
                                    <div>{sig.name}</div>
                                    <div className="text-secondary" style={{ fontSize: '0.65rem' }}>{sig.email}</div>
                                </td>
                                <td>
                                    <span className="text-accent font-semibold" style={{ fontSize: '1.1rem' }}>{sig.score}</span>
                                </td>
                                <td><SignalBadge tier={sig.tier} /></td>
                                <td className="text-secondary">{sig.segment || '—'}</td>
                                <td>
                                    <span className="status-badge">{sig.closerStatus || 'pending'}</span>
                                </td>
                                <td className="text-secondary">{sig.touches}</td>
                                <td>
                                    <div className="closer-signal-chips">
                                        {signalKeys.map(key => (
                                            <span key={key} className="closer-signal-chip">{key}</span>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function CloserLogFeed({ log }) {
    if (!log.length) {
        return <div className="empty-state">No closer outreach sent yet.</div>;
    }

    return (
        <div className="closer-log-feed">
            {log.slice(0, 15).map((entry, i) => {
                const tierStyle = TIER_STYLES[entry.signalTier] || TIER_STYLES.dormant;
                const timeStr = entry.sentAt
                    ? new Date(entry.sentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '';
                return (
                    <div key={`${entry.id}-${i}`} className="closer-log-entry">
                        <div className="closer-log-header">
                            <span className="closer-log-channel">
                                {CHANNEL_ICONS[entry.channel] || '📧'} {entry.channel?.toUpperCase()}
                            </span>
                            <span className="closer-log-type">{entry.type}</span>
                            <span className="closer-log-score" style={{ color: tierStyle.color }}>
                                [{entry.signalScore}]
                            </span>
                            <span className="closer-log-time">{timeStr}</span>
                        </div>
                        <div className="closer-log-lead">{entry.leadName}</div>
                        {entry.subject && <div className="closer-log-subject">{entry.subject}</div>}
                        {entry.replyClass && (
                            <span className="closer-reply-badge">{entry.replyClass}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function SalesCloserPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/sales-closer', { cache: 'no-store' });
            if (res.ok) {
                const payload = await res.json();
                setData(payload);
            }
        } catch {
            // silent
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void fetchData();
        const interval = setInterval(() => void fetchData(), 15000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const tiers = data?.signalTiers || { closeNow: 0, warmPursuit: 0, dormant: 0 };
    const funnel = data?.funnel || {};
    const stats = data?.closerStats || { totalSent: 0, emailsSent: 0, smsSent: 0, todaySent: 0 };
    const topSignals = data?.topSignals || [];
    const closerLog = data?.closerLog || [];

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <div className="header-decor" />
                <div className="dashboard-header-inner">
                    <div className="dashboard-header-title-group">
                        <span className="dashboard-header-emoji" style={{ color: 'hsl(15, 100%, 55%)', textShadow: '0 0 20px hsla(15, 100%, 55%, 0.5)' }}>🎯</span>
                        <div>
                            <h1 className="dashboard-title" style={{ color: 'hsl(15, 100%, 55%)' }}>GHOST // SALES CLOSER</h1>
                            <p className="dashboard-sync-status">
                                {data?.lastSync ? `Sync: ${new Date(data.lastSync).toLocaleString()}` : 'Awaiting pipeline data'}
                            </p>
                        </div>
                    </div>
                    <div className="dashboard-header-actions">
                        <a href="/" className="refresh-btn">← Command Center</a>
                        <a href="/lead-pipeline" className="refresh-btn">Lead Pipeline</a>
                        <button type="button" onClick={() => { setLoading(true); void fetchData(); }} className="refresh-btn">
                            ↻ Refresh
                        </button>
                    </div>
                </div>
            </header>

            <main className="dashboard-main">
                {/* Signal Tier Cards */}
                <div className="closer-tier-grid">
                    <div className="closer-tier-card close-now">
                        <div className="closer-tier-emoji">🔥</div>
                        <div className="closer-tier-value">{tiers.closeNow}</div>
                        <div className="closer-tier-label">CLOSE NOW</div>
                        <div className="closer-tier-sub">Score ≥ 80</div>
                    </div>
                    <div className="closer-tier-card warm-pursuit">
                        <div className="closer-tier-emoji">🟡</div>
                        <div className="closer-tier-value">{tiers.warmPursuit}</div>
                        <div className="closer-tier-label">WARM PURSUIT</div>
                        <div className="closer-tier-sub">Score 40-79</div>
                    </div>
                    <div className="closer-tier-card dormant-tier">
                        <div className="closer-tier-emoji">🧊</div>
                        <div className="closer-tier-value">{tiers.dormant}</div>
                        <div className="closer-tier-label">DORMANT</div>
                        <div className="closer-tier-sub">Score &lt; 40</div>
                    </div>
                </div>

                {/* Closer Stats Row */}
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <StatCard label="Total Closer Sends" value={stats.totalSent} icon="📤" color="var(--color-accent-blue)" />
                    <StatCard label="Emails Sent" value={stats.emailsSent} icon="📧" color="var(--color-accent-amber)" />
                    <StatCard label="SMS Sent" value={stats.smsSent} icon="📱" color="var(--color-success)" />
                    <StatCard label="Today" value={stats.todaySent} icon="📅" color="var(--color-warning)" subtitle="closer touches today" />
                </div>

                {/* Conversion Funnel */}
                <div className="stat-card hud-brackets">
                    <h2 className="section-title" style={{ color: 'hsl(15, 100%, 55%)' }}>
                        Conversion Funnel
                    </h2>
                    <p className="section-subtitle" style={{ marginBottom: '16px' }}>
                        Lead lifecycle from acquisition → close
                    </p>
                    <div className="closer-funnel-container">
                        <FunnelStage label="Total Leads" count={funnel.totalLeads || 0} total={funnel.totalLeads || 1} color="var(--color-text-secondary)" icon="📦" />
                        <FunnelStage label="Contacted" count={funnel.contacted || 0} total={funnel.totalLeads || 1} color="var(--color-accent-blue)" icon="📧" />
                        <FunnelStage label="Engaged" count={funnel.engaged || 0} total={funnel.totalLeads || 1} color="hsl(45, 100%, 55%)" icon="👀" />
                        <FunnelStage label="Replied" count={funnel.replied || 0} total={funnel.totalLeads || 1} color="var(--color-accent-amber)" icon="💬" />
                        <FunnelStage label="Closing" count={funnel.closing || 0} total={funnel.totalLeads || 1} color="hsl(15, 100%, 55%)" icon="🎯" />
                        <FunnelStage label="Proposal Sent" count={funnel.proposalSent || 0} total={funnel.totalLeads || 1} color="hsl(280, 80%, 60%)" icon="📋" />
                        <FunnelStage label="Meeting Scheduled" count={funnel.meetingScheduled || 0} total={funnel.totalLeads || 1} color="var(--color-success)" icon="📅" />
                        <FunnelStage label="Closed Won" count={funnel.closedWon || 0} total={funnel.totalLeads || 1} color="hsl(130, 80%, 50%)" icon="🏆" />
                        <FunnelStage label="Closed Lost" count={funnel.closedLost || 0} total={funnel.totalLeads || 1} color="var(--color-danger)" icon="🛑" />
                    </div>
                </div>

                {/* Top Signals + Closer Log */}
                <div className="two-col-grid">
                    <div className="stat-card hud-brackets">
                        <h2 className="section-title">🎯 Top Engagement Signals</h2>
                        <TopSignalsTable signals={topSignals.slice(0, 15)} />
                    </div>

                    <div className="stat-card hud-brackets">
                        <h2 className="section-title">📡 Closer Outreach Log</h2>
                        <CloserLogFeed log={closerLog} />
                    </div>
                </div>
            </main>
        </div>
    );
}
