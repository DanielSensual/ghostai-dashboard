'use client';

import { useEffect, useState, useCallback } from 'react';

const DAILY_OUTREACH_LIMIT = 50;

function StatCard({ label, value, icon, color, subtitle }) {
    return (
        <div className="stat-card">
            <div className="stat-card-header">
                <span className="stat-card-label">{label}</span>
                <span className="stat-card-icon-lg">{icon}</span>
            </div>
            <div className="stat-card-value" style={{ color: color || 'var(--color-text-primary)' }}>
                {value}
            </div>
            {subtitle ? <div className="stat-card-subtitle">{subtitle}</div> : null}
        </div>
    );
}

function CampaignTable({ campaigns }) {
    if (!campaigns.length) {
        return <div className="empty-state">No campaign data synced yet.</div>;
    }

    return (
        <div className="table-scroll">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Niche</th>
                        <th>City</th>
                        <th>Campaigns</th>
                    </tr>
                </thead>
                <tbody>
                    {campaigns.map((row, idx) => (
                        <tr key={`${row.niche}-${row.city}-${idx}`}>
                            <td>{row.niche}</td>
                            <td className="text-secondary">{row.city}</td>
                            <td>{row.count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function TopLeadsTable({ topLeads }) {
    if (!topLeads.length) {
        return <div className="empty-state">No top leads synced yet.</div>;
    }

    return (
        <div className="table-scroll">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Lead</th>
                        <th>Score</th>
                        <th>City</th>
                        <th>Segment</th>
                        <th>Offer</th>
                        <th>Email</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {topLeads.map((lead, idx) => (
                        <tr key={`${lead.name}-${idx}`}>
                            <td>{lead.name}</td>
                            <td><span className="text-accent font-semibold">{lead.score}</span></td>
                            <td className="text-secondary">{lead.city || '—'}</td>
                            <td className="text-secondary">{lead.segment || '—'}</td>
                            <td className="text-secondary">{lead.offer || '—'}</td>
                            <td className="text-secondary">{lead.email || '—'}</td>
                            <td><span className="status-badge">{lead.status || 'new'}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function SegmentBreakdownTable({ rows }) {
    if (!rows.length) {
        return <div className="empty-state">No segment performance data synced yet.</div>;
    }

    return (
        <div className="table-scroll">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Segment</th>
                        <th>Leads</th>
                        <th>Replied</th>
                        <th>Booked</th>
                        <th>Win Rate</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => {
                        const winRate = row.leads > 0 ? ((row.booked / row.leads) * 100).toFixed(1) : '0.0';
                        return (
                            <tr key={`${row.segment}-${idx}`}>
                                <td>{row.segment}</td>
                                <td>{row.leads}</td>
                                <td>{row.replied}</td>
                                <td>{row.booked}</td>
                                <td className="text-accent font-semibold">{winRate}%</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function DailySendSeriesChart({ rows }) {
    if (!rows.length) {
        return <div className="empty-state">No daily send series synced yet.</div>;
    }

    const maxCount = Math.max(...rows.map((row) => Number(row.count || 0)), 1);
    return (
        <div className="daily-chart">
            {rows.slice(-14).map((row, idx) => {
                const count = Number(row.count || 0);
                const heightPct = Math.max(0, (count / maxCount) * 100);
                return (
                    <div key={`${row.date}-${idx}`} className="daily-chart-col">
                        <div className="daily-chart-bar-wrap">
                            <div className="chart-bar" style={{ height: `${heightPct}%`, minHeight: count > 0 ? '4px' : '0' }} />
                        </div>
                        <span className="daily-chart-label">{(row.date || '').slice(5)}</span>
                    </div>
                );
            })}
        </div>
    );
}

export default function LeadPipelinePage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [copied, setCopied] = useState(false);

    const fetchLeadData = useCallback(async () => {
        try {
            const response = await fetch('/api/lead-pipeline', {
                cache: 'no-store',
            });

            if (response.ok) {
                const payload = await response.json();
                setData(payload);
            }
        } catch {
            // silent
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        const firstRun = setTimeout(() => {
            void fetchLeadData();
        }, 0);

        const interval = setInterval(() => {
            void fetchLeadData();
        }, 30000);

        return () => {
            clearTimeout(firstRun);
            clearInterval(interval);
        };
    }, [fetchLeadData]);

    const pipeline = data?.pipeline || {};
    const campaigns = data?.campaigns || [];
    const topLeads = data?.topLeads || [];
    const segmentBreakdown = data?.segmentBreakdown || pipeline.segmentBreakdown || [];
    const dailySendSeries = data?.dailySendSeries || pipeline.dailySendSeries || [];
    const remainingDaily = Math.max(0, DAILY_OUTREACH_LIMIT - Number(pipeline.todayOutreach || 0));
    const replyRate = Number(pipeline.replyRate || 0);
    const bookRate = Number(pipeline.bookRate || 0);
    const suppressionCount = Number(pipeline.suppressionCount || 0);
    const weeklySendCount = dailySendSeries.slice(-7).reduce((sum, row) => sum + Number(row.count || 0), 0);

    const continuationLines = [
        'GhostAI Systems Lead Pipeline - Agent Continuation Pack',
        `Timestamp: ${new Date().toISOString()}`,
        `Last Sync: ${data?.lastSync || 'never'}`,
        '',
        'Current Metrics:',
        `- totalLeads: ${pipeline.totalLeads || 0}`,
        `- hotLeads: ${pipeline.hotLeads || 0}`,
        `- warmLeads: ${pipeline.warmLeads || 0}`,
        `- withEmail: ${pipeline.withEmail || 0}`,
        `- contacted: ${pipeline.contacted || 0}`,
        `- replied: ${pipeline.replied || 0}`,
        `- booked: ${pipeline.booked || 0}`,
        `- replyRate: ${replyRate.toFixed(2)}%`,
        `- bookRate: ${bookRate.toFixed(2)}%`,
        `- suppressionCount: ${suppressionCount}`,
        `- todayOutreach: ${pipeline.todayOutreach || 0}/${DAILY_OUTREACH_LIMIT}`,
        '',
        'Continuation Commands:',
        '1) cd /Users/danielcastillo/Projects/Websites/Bots/ghostai-lead-hunter',
        '2) npm run status',
        '3) npm run qualify -- --limit 120',
        '4) npm run enrich:free -- --limit 120',
        `5) npm run outreach -- --tier hot --limit ${Math.max(5, Math.min(20, remainingDaily || 20))}`,
        '6) npm run outreach -- --followup',
        '7) npm run sync',
        '8) npm run orchestrate -- --run-all --dry-run',
        '',
        'Top Leads Snapshot:',
        ...topLeads.slice(0, 10).map((lead) => `- [${lead.score}] ${lead.name} | ${lead.city} | ${lead.email || 'no-email'} | ${lead.status}`),
    ];

    const continuationPack = continuationLines.join('\n');

    const copyContinuationPack = async () => {
        try {
            await navigator.clipboard.writeText(continuationPack);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <div className="dashboard-header-inner">
                    <div className="dashboard-header-title-group">
                        <span className="dashboard-header-emoji">🎯</span>
                        <div>
                            <h1 className="dashboard-title">GhostAI Systems Lead Pipeline</h1>
                            <p className="dashboard-sync-status">
                                {data?.lastSync ? `Last sync: ${new Date(data.lastSync).toLocaleString()}` : 'Awaiting first sync'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setLoading(true);
                            void fetchLeadData();
                        }}
                        className="refresh-btn"
                    >
                        ↻ Refresh
                    </button>
                </div>
            </header>

            <main className="dashboard-main">
                {/* Lead Stats */}
                <div className="lead-stats-grid">
                    <StatCard label="Total Leads" value={pipeline.totalLeads || 0} icon="📦" />
                    <StatCard label="Hot Leads" value={pipeline.hotLeads || 0} icon="🔥" color="var(--color-accent)" />
                    <StatCard label="With Email" value={pipeline.withEmail || 0} icon="📧" />
                    <StatCard label="Booked" value={pipeline.booked || 0} icon="📅" color="var(--color-success)" />
                    <StatCard label="Reply Rate" value={`${replyRate.toFixed(2)}%`} icon="💬" />
                    <StatCard label="Book Rate" value={`${bookRate.toFixed(2)}%`} icon="📈" />
                    <StatCard label="Suppressed" value={suppressionCount} icon="🛑" />
                    <StatCard
                        label="Today Outreach"
                        value={`${pipeline.todayOutreach || 0}/${DAILY_OUTREACH_LIMIT}`}
                        icon="📬"
                        subtitle={`${remainingDaily} sends remaining today`}
                    />
                </div>

                {/* Campaign Matrix + Agent Pack */}
                <div className="two-col-grid">
                    <div className="stat-card">
                        <h2 className="section-title-icon">
                            <span>🗂️</span> Campaign Matrix
                        </h2>
                        <CampaignTable campaigns={campaigns} />
                    </div>

                    <div className="stat-card">
                        <div className="continuation-header">
                            <h2 className="section-title-icon">
                                <span>🤖</span> Agent Continuation Pack
                            </h2>
                            <button onClick={copyContinuationPack} className="copy-btn">
                                {copied ? 'Copied' : 'Copy Pack'}
                            </button>
                        </div>
                        <p className="continuation-desc">
                            Any AI agent can copy this block and continue the pipeline immediately.
                        </p>
                        <textarea
                            readOnly
                            value={continuationPack}
                            className="continuation-textarea"
                        />
                    </div>
                </div>

                {/* Segment Win Rate + Daily Send */}
                <div className="two-col-grid">
                    <div className="stat-card">
                        <h2 className="section-title-icon">
                            <span>📊</span> Segment Win Rate
                        </h2>
                        <SegmentBreakdownTable rows={segmentBreakdown.slice(0, 20)} />
                    </div>

                    <div className="stat-card">
                        <h2 className="section-title-icon">
                            <span>📈</span> Daily Send Series
                        </h2>
                        <p className="send-series-meta">
                            Last 7 days sends: {weeklySendCount} | Reply rate: {replyRate.toFixed(2)}% | Book rate: {bookRate.toFixed(2)}%
                        </p>
                        <DailySendSeriesChart rows={dailySendSeries} />
                    </div>
                </div>

                {/* Top Leads */}
                <div className="stat-card">
                    <h2 className="section-title-icon">
                        <span>🏆</span> Top Leads
                    </h2>
                    <TopLeadsTable topLeads={topLeads.slice(0, 30)} />
                </div>
            </main>
        </div>
    );
}
