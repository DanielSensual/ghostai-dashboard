import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import crypto from 'node:crypto';

const BOT_ROOT = process.env.BOT_COMMAND_ROOT
    ? path.resolve(process.env.BOT_COMMAND_ROOT)
    : path.resolve(process.cwd(), '..', 'ghostai-x-bot');

const MAX_RUNS = 40;
const MAX_OUTPUT_CHARS = 60000;

const store = globalThis.__ghostaiCommandCenterStore || {
    runs: [],
    runningPids: new Map(),
};

if (!globalThis.__ghostaiCommandCenterStore) {
    globalThis.__ghostaiCommandCenterStore = store;
}

function assertBotRoot() {
    if (!fs.existsSync(BOT_ROOT)) {
        throw new Error(`Bot workspace not found: ${BOT_ROOT}`);
    }
}

function toInt(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (Number.isNaN(parsed)) return fallback;
    return parsed;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function asString(value, fallback = '') {
    const str = typeof value === 'string' ? value : fallback;
    return str.trim();
}

function sanitizeChunk(chunk) {
    return String(chunk || '').replace(/\u001b\[[0-9;]*m/g, '');
}

function appendOutput(run, chunk) {
    const next = `${run.output || ''}${sanitizeChunk(chunk)}`;
    run.output = next.length <= MAX_OUTPUT_CHARS
        ? next
        : next.slice(next.length - MAX_OUTPUT_CHARS);
}

function buildCatalog() {
    return [
        {
            id: 'engage-x',
            title: 'Engage X',
            description: 'Reply to fresh, high-value X posts.',
            singleFlight: true,
            fields: [
                { key: 'limit', type: 'number', label: 'Limit', min: 1, max: 25, defaultValue: 10 },
                { key: 'dryRun', type: 'boolean', label: 'Dry Run', defaultValue: false },
            ],
            build(params = {}) {
                const limit = clamp(toInt(params.limit, 10), 1, 25);
                const dryRun = Boolean(params.dryRun);
                const args = ['scripts/engage-x.js', `--limit=${limit}`];
                if (dryRun) args.push('--dry-run');
                return {
                    command: 'node',
                    args,
                    cwd: BOT_ROOT,
                    env: {
                        AI_PROVIDER: process.env.AI_PROVIDER || 'openai',
                        OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-5.2',
                    },
                };
            },
        },
        {
            id: 'engage-instagram',
            title: 'Engage Instagram',
            description: 'Find and comment on relevant Instagram posts.',
            singleFlight: true,
            fields: [
                { key: 'limit', type: 'number', label: 'Limit', min: 1, max: 30, defaultValue: 10 },
                { key: 'dryRun', type: 'boolean', label: 'Dry Run', defaultValue: true },
            ],
            build(params = {}) {
                const limit = clamp(toInt(params.limit, 10), 1, 30);
                const dryRun = Boolean(params.dryRun);
                const args = ['scripts/engage-instagram.js', `--limit=${limit}`];
                if (dryRun) args.push('--dry-run');
                return {
                    command: 'node',
                    args,
                    cwd: BOT_ROOT,
                    env: {
                        AI_PROVIDER: process.env.AI_PROVIDER || 'openai',
                        OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-5.2',
                    },
                };
            },
        },
        {
            id: 'post-all-video',
            title: 'Post Video (All Platforms)',
            description: 'Post one local video to X, LinkedIn, Facebook, and Instagram.',
            singleFlight: true,
            fields: [
                { key: 'videoFile', type: 'text', label: 'Video File Path', defaultValue: '' },
                { key: 'xCaption', type: 'textarea', label: 'X Caption (<= 280)', defaultValue: '' },
                { key: 'mainCaption', type: 'textarea', label: 'Main Caption (LI/FB/IG)', defaultValue: '' },
                { key: 'dryRun', type: 'boolean', label: 'Dry Run', defaultValue: true },
            ],
            build(params = {}) {
                const videoFileRaw = asString(params.videoFile);
                const xCaption = asString(params.xCaption);
                const mainCaption = asString(params.mainCaption);
                const dryRun = Boolean(params.dryRun);

                if (!videoFileRaw) throw new Error('videoFile is required');
                if (!mainCaption) throw new Error('mainCaption is required');
                if (!xCaption) throw new Error('xCaption is required');
                if (xCaption.length > 280) throw new Error('xCaption must be 280 characters or fewer');
                if (mainCaption.length > 2200) throw new Error('mainCaption must be 2200 characters or fewer');

                const videoFile = path.isAbsolute(videoFileRaw)
                    ? videoFileRaw
                    : path.resolve(BOT_ROOT, videoFileRaw);

                const args = [
                    'scripts/post-all-video.js',
                    '--video-file',
                    videoFile,
                    '--x-caption',
                    xCaption,
                    '--main-caption',
                    mainCaption,
                ];
                if (dryRun) args.push('--dry-run');

                return {
                    command: 'node',
                    args,
                    cwd: BOT_ROOT,
                    env: {
                        AI_PROVIDER: process.env.AI_PROVIDER || 'openai',
                        OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-5.2',
                    },
                };
            },
        },
        {
            id: 'test-connections',
            title: 'Test Connections',
            description: 'Run end-to-end platform connectivity checks.',
            singleFlight: true,
            fields: [],
            build() {
                return {
                    command: 'node',
                    args: ['scripts/test-connection.js'],
                    cwd: BOT_ROOT,
                };
            },
        },
        {
            id: 'sync-dashboard',
            title: 'Sync Dashboard',
            description: 'Push latest bot metrics into this dashboard.',
            singleFlight: true,
            fields: [],
            build() {
                return {
                    command: 'node',
                    args: ['scripts/sync-dashboard.js'],
                    cwd: BOT_ROOT,
                    env: {
                        DASHBOARD_URL: process.env.DASHBOARD_URL || 'http://localhost:3000',
                        DASHBOARD_SECRET: process.env.DASHBOARD_SECRET || 'ghostai-dev-token',
                    },
                };
            },
        },
    ];
}

function getCatalogMap() {
    const catalog = buildCatalog();
    const byId = new Map(catalog.map((item) => [item.id, item]));
    return { catalog, byId };
}

function compactRun(run) {
    return {
        id: run.id,
        commandId: run.commandId,
        title: run.title,
        description: run.description,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt || null,
        exitCode: Number.isInteger(run.exitCode) ? run.exitCode : null,
        commandLine: run.commandLine,
        output: run.output || '',
        params: run.params || {},
    };
}

function pushRun(run) {
    store.runs.unshift(run);
    if (store.runs.length > MAX_RUNS) {
        store.runs = store.runs.slice(0, MAX_RUNS);
    }
}

export function listCommands() {
    return buildCatalog().map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        fields: item.fields || [],
    }));
}

export function listRuns() {
    return store.runs.map(compactRun);
}

export function getCommandCenterState() {
    return {
        executorMode: 'local',
        botRoot: BOT_ROOT,
        commands: listCommands(),
        runs: listRuns(),
        runningCount: store.runs.filter((run) => run.status === 'running').length,
    };
}

export function runCommand(commandId, params = {}) {
    assertBotRoot();

    const { byId } = getCatalogMap();
    const command = byId.get(commandId);
    if (!command) {
        const err = new Error(`Unknown command: ${commandId}`);
        err.code = 'E_UNKNOWN_COMMAND';
        throw err;
    }

    const activeRun = command.singleFlight
        ? store.runs.find((run) => run.commandId === commandId && run.status === 'running')
        : null;
    if (activeRun) {
        const err = new Error(`${command.title} is already running`);
        err.code = 'E_BUSY';
        throw err;
    }

    const plan = command.build(params || {});
    const id = `cmd_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const run = {
        id,
        commandId: command.id,
        title: command.title,
        description: command.description,
        status: 'running',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        exitCode: null,
        output: '',
        params: params || {},
        commandLine: `${plan.command} ${(plan.args || []).join(' ')}`,
    };

    pushRun(run);

    const child = spawn(plan.command, plan.args || [], {
        cwd: plan.cwd || BOT_ROOT,
        env: {
            ...process.env,
            ...(plan.env || {}),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    store.runningPids.set(id, child.pid);

    child.stdout?.on('data', (chunk) => appendOutput(run, chunk));
    child.stderr?.on('data', (chunk) => appendOutput(run, chunk));

    child.on('error', (error) => {
        appendOutput(run, `\n❌ Process error: ${error.message}\n`);
        run.status = 'failed';
        run.exitCode = 1;
        run.finishedAt = new Date().toISOString();
        store.runningPids.delete(id);
    });

    child.on('close', (code) => {
        run.exitCode = Number.isInteger(code) ? code : 1;
        run.status = code === 0 ? 'succeeded' : 'failed';
        run.finishedAt = new Date().toISOString();
        store.runningPids.delete(id);
    });

    return compactRun(run);
}
