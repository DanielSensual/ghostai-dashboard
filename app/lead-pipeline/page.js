'use client';

import { useEffect, useState, useCallback } from 'react';

const TOKEN_STORAGE_KEY = 'ghostai-token';
const DAILY_OUTREACH_LIMIT = 50;

function bootstrapTokenFromBrowser() {
    if (typeof window === 'undefined') return '';

    try {
        const saved = localStorage.getItem(TOKEN_STORAGE_KEY) || '';
        const hash = window.location.hash.replace('#', '').trim();
        const token = hash || saved || '';

        if (token) {
            localStorage.setItem(TOKEN_STORAGE_KEY, token);
        }

        if (hash && window.history?.replaceState) {
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        }

        return token;
    } catch {
        return '';
    }
}

function StatCard({ label, value, icon, color, subtitle }) {
    return (
        <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[--color-text-muted] text-sm font-medium">{label}</span>
                <span className="text-xl">{icon}</span>
            </div>
            <div className="text-3xl font-bold" style={{ color: color || 'var(--color-text-primary)' }}>
                {value}
            </div>
            {subtitle ? <div className="text-xs text-[--color-text-muted] mt-1">{subtitle}</div> : null}
        </div>
    );
}

function CampaignTable({ campaigns }) {
    if (!campaigns.length) {
        return <div className="text-sm text-[--color-text-muted]">No campaign data synced yet.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left border-b border-[--color-border]">
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">Niche</th>
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">City</th>
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">Campaigns</th>
                    </tr>
                </thead>
                <tbody>
                    {campaigns.map((row, idx) => (
                        <tr key={`${row.niche}-${row.city}-${idx}`} className="border-b border-[--color-border] last:border-0">
                            <td className="py-2 pr-3">{row.niche}</td>
                            <td className="py-2 pr-3 text-[--color-text-secondary]">{row.city}</td>
                            <td className="py-2 pr-3">{row.count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function TopLeadsTable({ topLeads }) {
    if (!topLeads.length) {
        return <div className="text-sm text-[--color-text-muted]">No top leads synced yet.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left border-b border-[--color-border]">
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">Lead</th>
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">Score</th>
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">City</th>
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">Segment</th>
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">Offer</th>
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">Email</th>
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {topLeads.map((lead, idx) => (
                        <tr key={`${lead.name}-${idx}`} className="border-b border-[--color-border] last:border-0">
                            <td className="py-2 pr-3">{lead.name}</td>
                            <td className="py-2 pr-3">
                                <span className="text-[--color-accent] font-semibold">{lead.score}</span>
                            </td>
                            <td className="py-2 pr-3 text-[--color-text-secondary]">{lead.city || '—'}</td>
                            <td className="py-2 pr-3 text-[--color-text-secondary]">{lead.segment || '—'}</td>
                            <td className="py-2 pr-3 text-[--color-text-secondary]">{lead.offer || '—'}</td>
                            <td className="py-2 pr-3 text-[--color-text-secondary]">{lead.email || '—'}</td>
                            <td className="py-2 pr-3">
                                <span className="px-2 py-0.5 rounded-full text-xs bg-[--color-border] capitalize">
                                    {lead.status || 'new'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function SegmentBreakdownTable({ rows }) {
    if (!rows.length) {
        return <div className="text-sm text-[--color-text-muted]">No segment performance data synced yet.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left border-b border-[--color-border]">
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">Segment</th>
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">Leads</th>
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">Replied</th>
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">Booked</th>
                        <th className="py-2 pr-3 font-medium text-[--color-text-muted]">Win Rate</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => {
                        const winRate = row.leads > 0 ? ((row.booked / row.leads) * 100).toFixed(1) : '0.0';
                        return (
                            <tr key={`${row.segment}-${idx}`} className="border-b border-[--color-border] last:border-0">
                                <td className="py-2 pr-3">{row.segment}</td>
                                <td className="py-2 pr-3">{row.leads}</td>
                                <td className="py-2 pr-3">{row.replied}</td>
                                <td className="py-2 pr-3">{row.booked}</td>
                                <td className="py-2 pr-3 text-[--color-accent] font-semibold">{winRate}%</td>
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
        return <div className="text-sm text-[--color-text-muted]">No daily send series synced yet.</div>;
    }

    const maxCount = Math.max(...rows.map((row) => Number(row.count || 0)), 1);
    return (
        <div className="flex items-end gap-1 h-32">
            {rows.slice(-14).map((row, idx) => {
                const count = Number(row.count || 0);
                const heightPct = Math.max(0, (count / maxCount) * 100);
                return (
                    <div key={`${row.date}-${idx}`} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t bg-[--color-accent]" style={{ height: `${heightPct}%`, minHeight: count > 0 ? '4px' : '0' }} />
                        <span className="text-[10px] text-[--color-text-muted]">{(row.date || '').slice(5)}</span>
                    </div>
                );
            })}
        </div>
    );
}

export default function LeadPipelinePage() {
    const [token, setToken] = useState(() => bootstrapTokenFromBrowser());
    const [loading, setLoading] = useState(() => Boolean(token));
    const [authenticated, setAuthenticated] = useState(false);
    const [data, setData] = useState(null);
    const [copied, setCopied] = useState(false);

    const fetchLeadDataWithToken = useCallback(async (activeToken) => {
        if (!activeToken) {
            setAuthenticated(false);
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/lead-pipeline', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${activeToken}`,
                },
                cache: 'no-store',
            });

            if (response.ok) {
                const payload = await response.json();
                setData(payload);
                setAuthenticated(true);
            } else {
                setAuthenticated(false);
            }
        } catch {
            setAuthenticated(false);
        }

        setLoading(false);
    }, []);

    const fetchLeadData = useCallback(async () => {
        await fetchLeadDataWithToken(token);
    }, [fetchLeadDataWithToken, token]);

    useEffect(() => {
        if (!token) return undefined;

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
    }, [token, fetchLeadData]);

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
        '8) cd /Users/danielcastillo/Projects/Websites/Bots',
        '9) node scripts/ghostai-orchestrator.js --run-all --dry-run',
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

    if (!authenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="stat-card glow-border max-w-md w-full mx-4">
                    <div className="text-center mb-6">
                        <div className="text-4xl mb-2">🎯</div>
                        <h1 className="text-xl font-bold">GhostAI Lead Pipeline</h1>
                        <p className="text-sm text-[--color-text-muted] mt-1">
                            Secure handoff page for AI agent continuation
                        </p>
                    </div>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            const nextToken = String(event.target.token.value || '').trim();
                            if (!nextToken) {
                                setAuthenticated(false);
                                setLoading(false);
                                return;
                            }

                            setToken(nextToken);
                            if (typeof window !== 'undefined') {
                                localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
                            }

                            setLoading(true);
                            void fetchLeadDataWithToken(nextToken);
                        }}
                    >
                        <input
                            name="token"
                            type="password"
                            placeholder="Enter access token"
                            autoComplete="off"
                            spellCheck={false}
                            className="w-full px-4 py-3 bg-[--color-background] border border-[--color-border] rounded-lg text-sm focus:outline-none focus:border-[--color-accent] transition-colors"
                        />
                        <button
                            type="submit"
                            className="w-full mt-4 px-4 py-3 bg-[--color-accent] text-white rounded-lg text-sm font-medium hover:brightness-110 transition-all"
                        >
                            Authenticate
                        </button>
                    </form>
                    {loading ? <div className="text-center text-sm text-[--color-text-muted] mt-4 animate-pulse-subtle">Verifying...</div> : null}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-12">
            <header className="border-b border-[--color-border] px-6 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🎯</span>
                        <div>
                            <h1 className="text-lg font-bold">GhostAI Systems Lead Pipeline</h1>
                            <p className="text-xs text-[--color-text-muted]">
                                {data?.lastSync ? `Last sync: ${new Date(data.lastSync).toLocaleString()}` : 'Awaiting first sync'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setLoading(true);
                            void fetchLeadData();
                        }}
                        className="px-4 py-2 text-sm border border-[--color-border] rounded-lg hover:border-[--color-accent] transition-colors"
                    >
                        ↻ Refresh
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="stat-card">
                        <h2 className="font-semibold mb-3 flex items-center gap-2">
                            <span>🗂️</span> Campaign Matrix
                        </h2>
                        <CampaignTable campaigns={campaigns} />
                    </div>

                    <div className="stat-card">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <h2 className="font-semibold flex items-center gap-2">
                                <span>🤖</span> Agent Continuation Pack
                            </h2>
                            <button
                                onClick={copyContinuationPack}
                                className="px-3 py-1.5 text-xs border border-[--color-border] rounded-lg hover:border-[--color-accent] transition-colors"
                            >
                                {copied ? 'Copied' : 'Copy Pack'}
                            </button>
                        </div>
                        <p className="text-xs text-[--color-text-muted] mb-3">
                            Any AI agent can copy this block and continue the pipeline immediately.
                        </p>
                        <textarea
                            readOnly
                            value={continuationPack}
                            className="w-full min-h-72 text-xs bg-[--color-background] border border-[--color-border] rounded-lg p-3 focus:outline-none"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="stat-card">
                        <h2 className="font-semibold mb-3 flex items-center gap-2">
                            <span>📊</span> Segment Win Rate
                        </h2>
                        <SegmentBreakdownTable rows={segmentBreakdown.slice(0, 20)} />
                    </div>

                    <div className="stat-card">
                        <h2 className="font-semibold mb-3 flex items-center gap-2">
                            <span>📈</span> Daily Send Series
                        </h2>
                        <p className="text-xs text-[--color-text-muted] mb-3">
                            Last 7 days sends: {weeklySendCount} | Reply rate: {replyRate.toFixed(2)}% | Book rate: {bookRate.toFixed(2)}%
                        </p>
                        <DailySendSeriesChart rows={dailySendSeries} />
                    </div>
                </div>

                <div className="stat-card">
                    <h2 className="font-semibold mb-3 flex items-center gap-2">
                        <span>🏆</span> Top Leads
                    </h2>
                    <TopLeadsTable topLeads={topLeads.slice(0, 30)} />
                </div>
            </main>
        </div>
    );
}
