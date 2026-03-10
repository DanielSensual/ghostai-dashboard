'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const VOICE_CONTROL_INSTRUCTIONS = [
    'You are GHOST, the AI command interface for Ghost AI Systems.',
    'You serve Daniel Castillo — founder, operator, military veteran.',
    'Listen to the operator and rewrite their spoken request as one clean execution goal.',
    'Return ONLY the cleaned command text.',
    'Do NOT add commentary, markdown, bullets, labels, or quotes.',
    'Preserve important constraints like city names, limits, dry-run mode, platform names, and account handles.',
    'If the request is unclear or incomplete, respond exactly as: CLARIFY: <short question>',
    'Do NOT answer the request yourself — you are a command parser, not an assistant.',
    'Keep responses sharp and military-precise. You are a weapon, not a chatbot.',
].join(' ');

function normalizeGoalText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractResponseText(response) {
    const parts = [];

    for (const item of response?.output || []) {
        if (typeof item?.text === 'string') {
            parts.push(item.text);
        }

        for (const part of item?.content || []) {
            if (typeof part?.text === 'string') {
                parts.push(part.text);
            } else if (typeof part?.transcript === 'string') {
                parts.push(part.transcript);
            }
        }
    }

    return normalizeGoalText(parts.join(' '));
}

function formatRealtimeError(payload) {
    if (payload?.error?.message) return payload.error.message;
    if (typeof payload?.message === 'string') return payload.message;
    return 'Realtime voice session failed.';
}

export default function GodModeTerminal({ isOpen, onClose }) {
    const [input, setInput] = useState('');
    const [history, setHistory] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [pipelineData, setPipelineData] = useState(null);
    const [authError, setAuthError] = useState(false);
    const [confirmBeforeRun, setConfirmBeforeRun] = useState(true);
    const [spokenRepliesEnabled, setSpokenRepliesEnabled] = useState(true);
    const [pendingGoal, setPendingGoal] = useState(null);
    const [voiceState, setVoiceState] = useState({
        status: 'idle',
        message: '',
        transcript: '',
        error: '',
    });

    const inputRef = useRef(null);
    const feedRef = useRef(null);
    const voiceSessionRef = useRef(null);
    const audioRef = useRef(null);

    const SECRET = process.env.NEXT_PUBLIC_GOD_MODE_SECRET || '';

    const authHeaders = useCallback((contentType = 'application/json') => {
        return {
            ...(contentType ? { 'Content-Type': contentType } : {}),
            ...(SECRET ? { 'x-god-mode-secret': SECRET } : {}),
        };
    }, [SECRET]);

    const speakText = useCallback((text) => {
        const message = normalizeGoalText(text);
        if (!message || !spokenRepliesEnabled || typeof window === 'undefined' || !window.speechSynthesis) {
            return;
        }

        // Skip browser TTS when a Realtime voice session is active — OpenAI audio handles it
        if (voiceSessionRef.current) {
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1;
        utterance.pitch = 0.95;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice =
            voices.find((voice) => /Samantha|Ava|Allison|Google US English/i.test(voice.name)) ||
            voices.find((voice) => voice.lang?.toLowerCase().startsWith('en-us')) ||
            voices.find((voice) => voice.lang?.toLowerCase().startsWith('en')) ||
            null;

        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        window.speechSynthesis.speak(utterance);
    }, [spokenRepliesEnabled]);

    const stageGoal = useCallback((rawGoal, source = 'text') => {
        const goal = normalizeGoalText(rawGoal);
        if (!goal) return;

        setPendingGoal({
            text: goal,
            source,
            createdAt: new Date().toISOString(),
        });
        setInput(goal);
        setHistory((prev) => [
            ...prev,
            {
                type: 'system',
                text: `Command staged for approval (${source}). Review and approve before Ghost runs it.`,
                time: new Date(),
            },
        ]);
        speakText('Command captured. Review and approve before I run it.');
    }, [speakText]);

    function teardownVoiceSession(nextState = null) {
        const current = voiceSessionRef.current;
        if (current?.timeoutId) {
            window.clearTimeout(current.timeoutId);
        }
        current?.dataChannel?.close();
        current?.peerConnection?.close();
        current?.stream?.getTracks?.().forEach((track) => track.stop());
        voiceSessionRef.current = null;

        if (nextState) {
            setVoiceState((prev) => ({
                ...prev,
                ...nextState,
            }));
        }
    }

    async function executeGoal(rawGoal, source = 'text') {
        const goal = normalizeGoalText(rawGoal);
        if (!goal || isProcessing) return;

        setPendingGoal(null);
        setInput(source === 'voice' ? goal : '');
        setIsProcessing(true);
        setHistory((prev) => [
            ...prev,
            {
                type: 'user',
                text: source === 'voice' ? `VOICE: ${goal}` : goal,
                time: new Date(),
            },
        ]);

        try {
            const res = await fetch('/api/god-mode', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ goal }),
            });
            const data = await res.json();

            if (!res.ok) {
                if (res.status === 401 || res.status === 503) {
                    setAuthError(true);
                }
                throw new Error(data.error || `HTTP ${res.status}`);
            }

            setInput('');
            setHistory((prev) => [
                ...prev,
                {
                    type: 'system',
                    text: 'Goal accepted. Ghost is processing...',
                    time: new Date(),
                },
            ]);
            speakText('Ghost accepted your command and is processing it now.');

            await new Promise((resolve) => setTimeout(resolve, 8000));

            const pipeRes = await fetch('/api/god-mode?action=pipeline', { headers: authHeaders() });
            if (pipeRes.ok) {
                const pipeData = await pipeRes.json();
                setPipelineData(pipeData);

                setHistory((prev) => [
                    ...prev,
                    {
                        type: 'ghost',
                        text: `Processing complete. Pipeline: ${pipeData.pendingGoals || 0} pending goals.`,
                        time: new Date(),
                    },
                ]);
                speakText(`Processing complete. Pipeline has ${pipeData.pendingGoals || 0} pending goals.`);
            }
        } catch (err) {
            setInput(goal);
            setHistory((prev) => [
                ...prev,
                {
                    type: 'error',
                    text: `ERROR: ${err.message}`,
                    time: new Date(),
                },
            ]);
            speakText(`Error. ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    }

    async function startVoiceCommand() {
        if (isProcessing) return;
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        if (!window.RTCPeerConnection) {
            setVoiceState({
                status: 'error',
                message: '',
                transcript: '',
                error: 'This browser does not support WebRTC voice sessions.',
            });
            return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            setVoiceState({
                status: 'error',
                message: '',
                transcript: '',
                error: 'Microphone access is not available in this browser.',
            });
            return;
        }

        teardownVoiceSession();
        setVoiceState({
            status: 'connecting',
            message: 'Connecting to OpenAI Realtime...',
            transcript: '',
            error: '',
        });

        try {
            const peerConnection = new RTCPeerConnection();
            const dataChannel = peerConnection.createDataChannel('oai-events');
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

            // Play remote audio from OpenAI Realtime (Ghost's voice)
            peerConnection.ontrack = (event) => {
                if (audioRef.current && event.streams?.[0]) {
                    audioRef.current.srcObject = event.streams[0];
                    audioRef.current.play().catch(() => { });
                }
            };

            voiceSessionRef.current = {
                peerConnection,
                dataChannel,
                stream,
                partialText: '',
                responseRequested: false,
                timeoutId: window.setTimeout(() => {
                    teardownVoiceSession({
                        status: 'error',
                        message: '',
                        transcript: '',
                        error: 'Voice session timed out before a command was captured.',
                    });
                }, 60000),
            };

            dataChannel.addEventListener('open', () => {
                dataChannel.send(JSON.stringify({
                    type: 'session.update',
                    session: {
                        type: 'realtime',
                        output_modalities: ['text', 'audio'],
                        instructions: VOICE_CONTROL_INSTRUCTIONS,
                        voice: 'ash',
                        audio: {
                            input: {
                                turn_detection: {
                                    type: 'semantic_vad',
                                    create_response: false,
                                    interrupt_response: false,
                                },
                            },
                        },
                    },
                }));

                setVoiceState({
                    status: 'listening',
                    message: 'GHOST is listening...',
                    transcript: '',
                    error: '',
                });
            });

            dataChannel.addEventListener('message', (event) => {
                let payload;
                try {
                    payload = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (payload.type === 'input_audio_buffer.speech_started') {
                    setVoiceState((prev) => ({
                        ...prev,
                        status: 'listening',
                        message: 'Listening...',
                        error: '',
                    }));
                    return;
                }

                if (payload.type === 'input_audio_buffer.speech_stopped') {
                    const current = voiceSessionRef.current;
                    if (!current || current.responseRequested) return;

                    current.responseRequested = true;
                    current.partialText = '';

                    setVoiceState((prev) => ({
                        ...prev,
                        status: 'thinking',
                        message: 'Parsing your command...',
                        transcript: '',
                        error: '',
                    }));

                    dataChannel.send(JSON.stringify({
                        type: 'response.create',
                        response: {
                            conversation: 'none',
                            metadata: {
                                source: 'god-mode-voice',
                            },
                            output_modalities: ['text', 'audio'],
                        },
                    }));
                    return;
                }

                if (payload.type === 'response.output_text.delta' || payload.type === 'response.text.delta') {
                    const delta = payload.delta || '';
                    const current = voiceSessionRef.current;
                    if (!current) return;

                    current.partialText = `${current.partialText || ''}${delta}`;
                    setVoiceState((prev) => ({
                        ...prev,
                        transcript: normalizeGoalText(current.partialText),
                    }));
                    return;
                }

                if (payload.type === 'response.done') {
                    const current = voiceSessionRef.current;
                    const text = normalizeGoalText(
                        current?.partialText || extractResponseText(payload.response)
                    );

                    if (!text) {
                        teardownVoiceSession({
                            status: 'error',
                            message: '',
                            transcript: '',
                            error: 'Voice command finished without usable text.',
                        });
                        return;
                    }

                    teardownVoiceSession({
                        status: 'idle',
                        message: '',
                        transcript: '',
                        error: '',
                    });

                    if (text.startsWith('CLARIFY:')) {
                        const question = normalizeGoalText(text.slice('CLARIFY:'.length));
                        setHistory((prev) => [
                            ...prev,
                            {
                                type: 'ghost',
                                text: question || 'Say that again with a bit more detail.',
                                time: new Date(),
                            },
                        ]);
                        speakText(question || 'Say that again with a bit more detail.');
                        return;
                    }

                    if (confirmBeforeRun) {
                        stageGoal(text, 'voice');
                    } else {
                        speakText('Executing your voice command now.');
                        void executeGoal(text, 'voice');
                    }
                    return;
                }

                if (payload.type === 'error') {
                    teardownVoiceSession({
                        status: 'error',
                        message: '',
                        transcript: '',
                        error: formatRealtimeError(payload),
                    });
                    speakText(formatRealtimeError(payload));
                }
            });

            peerConnection.addEventListener('connectionstatechange', () => {
                const state = peerConnection.connectionState;
                if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                    if (!voiceSessionRef.current) return;
                    teardownVoiceSession({
                        status: 'error',
                        message: '',
                        transcript: '',
                        error: 'Voice session disconnected.',
                    });
                }
            });

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            const response = await fetch('/api/realtime/session', {
                method: 'POST',
                headers: authHeaders('application/sdp'),
                body: offer.sdp,
            });

            const answerSdp = await response.text();
            if (!response.ok) {
                let errorMessage = answerSdp;
                try {
                    const payload = JSON.parse(answerSdp);
                    errorMessage = payload?.error || answerSdp;
                } catch { /* keep raw text */ }
                throw new Error(errorMessage || `HTTP ${response.status}`);
            }

            await peerConnection.setRemoteDescription({
                type: 'answer',
                sdp: answerSdp,
            });
        } catch (err) {
            teardownVoiceSession({
                status: 'error',
                message: '',
                transcript: '',
                error: err.message || 'Unable to start voice control.',
            });
            speakText(err.message || 'Unable to start voice control.');
        }
    }

    function toggleVoiceCommand() {
        const isVoiceActive = voiceState.status === 'connecting' || voiceState.status === 'listening' || voiceState.status === 'thinking';

        if (isVoiceActive) {
            teardownVoiceSession({
                status: 'idle',
                message: '',
                transcript: '',
                error: '',
            });
            return;
        }

        void startVoiceCommand();
    }

    // Auto-focus input when terminal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Poll pipeline while processing
    useEffect(() => {
        if (!isProcessing) return undefined;
        const interval = setInterval(async () => {
            try {
                const res = await fetch('/api/god-mode?action=pipeline', { headers: authHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    setPipelineData(data);
                }
            } catch { /* noop */ }
        }, 3000);
        return () => clearInterval(interval);
    }, [authHeaders, isProcessing]);

    // Auto-scroll feed
    useEffect(() => {
        if (feedRef.current) {
            feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
    }, [history, voiceState.transcript]);

    useEffect(() => {
        if (!isOpen) {
            teardownVoiceSession({
                status: 'idle',
                message: '',
                transcript: '',
                error: '',
            });
        }
    }, [isOpen]);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis && !spokenRepliesEnabled) {
            window.speechSynthesis.cancel();
        }
    }, [spokenRepliesEnabled]);

    useEffect(() => {
        return () => teardownVoiceSession();
    }, []);

    function handleSubmit(e) {
        e.preventDefault();
        if (!input.trim() || isProcessing) return;

        if (confirmBeforeRun) {
            stageGoal(input, 'text');
            return;
        }

        void executeGoal(input, 'text');
    }

    function handleApprovePendingGoal() {
        if (!pendingGoal) return;
        speakText('Approved. Running your command.');
        void executeGoal(pendingGoal.text, pendingGoal.source);
    }

    function handleEditPendingGoal() {
        if (!pendingGoal) return;
        setInput(pendingGoal.text);
        setPendingGoal(null);
        inputRef.current?.focus();
        speakText('Pending command moved to the editor.');
    }

    function handleDismissPendingGoal() {
        setPendingGoal(null);
        speakText('Pending command dismissed.');
    }

    if (!isOpen) return null;

    const quickActions = [
        { label: 'Hunt Leads', goal: 'Hunt 10 realtor leads in Orlando FL using the Google Places API.' },
        { label: 'Send Outreach', goal: 'Check the pipeline for qualified leads and send outreach emails to the top 3.' },
        { label: 'Pipeline Status', goal: 'Check the revenue pipeline and give me a full status report.' },
        { label: 'Post to X', goal: 'Write and post a thought-leadership tweet about AI automation for businesses.' },
        { label: 'Health Check', goal: 'Check all tool connections and report which are working and which need attention.' },
    ];

    const voiceActive = voiceState.status === 'connecting' || voiceState.status === 'listening' || voiceState.status === 'thinking';
    const voiceButtonLabel = voiceActive ? 'STOP MIC' : 'VOICE';

    return (
        <div className="godmode-overlay" onClick={onClose}>
            <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
            <div className="godmode-container" onClick={(e) => e.stopPropagation()}>
                <div className="godmode-header">
                    <div className="godmode-header-left">
                        <div className="godmode-badge">GOD MODE</div>
                        <span className="godmode-subtitle">Ghost AI Command Terminal</span>
                    </div>
                    <button className="godmode-close" onClick={onClose}>&times;</button>
                </div>

                {authError && (
                    <div className="godmode-entry godmode-entry-error" style={{ margin: '12px 20px 0' }}>
                        <div className="godmode-entry-text">
                            Authentication failed. Set <code>GOD_MODE_SECRET</code> and <code>NEXT_PUBLIC_GOD_MODE_SECRET</code>.
                        </div>
                    </div>
                )}

                <div className="godmode-quick-actions">
                    {quickActions.map((qa, i) => (
                        <button
                            key={i}
                            className="godmode-quick-btn"
                            disabled={isProcessing}
                            onClick={() => {
                                setInput(qa.goal);
                                inputRef.current?.focus();
                            }}
                        >
                            {qa.label}
                        </button>
                    ))}
                </div>

                <div className="godmode-control-row">
                    <label className="godmode-toggle">
                        <input
                            type="checkbox"
                            checked={confirmBeforeRun}
                            onChange={(e) => setConfirmBeforeRun(e.target.checked)}
                        />
                        <span>Confirm Before Run</span>
                    </label>
                    <label className="godmode-toggle">
                        <input
                            type="checkbox"
                            checked={spokenRepliesEnabled}
                            onChange={(e) => setSpokenRepliesEnabled(e.target.checked)}
                        />
                        <span>Spoken Replies</span>
                    </label>
                </div>

                <div className="godmode-orb-section">
                    <button
                        type="button"
                        className={`godmode-orb${voiceActive ? ' godmode-orb-active' : ''}${voiceState.status === 'thinking' ? ' godmode-orb-thinking' : ''}${voiceState.error ? ' godmode-orb-error' : ''}`}
                        onClick={toggleVoiceCommand}
                        disabled={isProcessing}
                        aria-label={voiceActive ? 'Stop voice command' : 'Start voice command'}
                    >
                        <div className="godmode-orb-core" />
                        <div className="godmode-orb-ring godmode-orb-ring-1" />
                        <div className="godmode-orb-ring godmode-orb-ring-2" />
                        <div className="godmode-orb-ring godmode-orb-ring-3" />
                    </button>
                    <div className={`godmode-orb-label${voiceState.error ? ' godmode-orb-label-error' : ''}`}>
                        {voiceState.error || (voiceActive ? voiceState.message || 'GHOST is listening...' : 'Tap orb to speak')}
                    </div>
                    {voiceState.transcript && (
                        <div className="godmode-orb-transcript">{voiceState.transcript}</div>
                    )}
                </div>

                {pendingGoal && (
                    <div className="godmode-pending">
                        <div className="godmode-pending-header">
                            <span className="godmode-pending-badge">Pending Approval</span>
                            <span className="godmode-pending-source">{pendingGoal.source.toUpperCase()}</span>
                        </div>
                        <div className="godmode-pending-text">{pendingGoal.text}</div>
                        <div className="godmode-pending-actions">
                            <button type="button" className="godmode-pending-btn godmode-pending-btn-primary" onClick={handleApprovePendingGoal}>
                                Approve
                            </button>
                            <button type="button" className="godmode-pending-btn" onClick={handleEditPendingGoal}>
                                Edit
                            </button>
                            <button type="button" className="godmode-pending-btn" onClick={handleDismissPendingGoal}>
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}

                <div className="godmode-feed" ref={feedRef}>
                    {history.length === 0 && (
                        <div className="godmode-empty">
                            <div className="godmode-empty-icon">G</div>
                            <div>Type a command or use voice mode. Ghost will execute it through the command center.</div>
                        </div>
                    )}

                    {history.map((entry, i) => (
                        <div key={i} className={`godmode-entry godmode-entry-${entry.type}`}>
                            <div className="godmode-entry-header">
                                <span className="godmode-entry-role">
                                    {entry.type === 'user' ? 'YOU' : entry.type === 'ghost' ? 'GHOST' : entry.type === 'error' ? 'ERROR' : 'SYSTEM'}
                                </span>
                                <span className="godmode-entry-time">
                                    {entry.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                            </div>
                            <div className="godmode-entry-text">{entry.text}</div>
                        </div>
                    ))}

                    {isProcessing && (
                        <div className="godmode-entry godmode-entry-system">
                            <div className="godmode-processing-indicator">
                                <div className="godmode-spinner"></div>
                                <span>Ghost is processing...</span>
                            </div>
                        </div>
                    )}

                    {pipelineData?.pendingGoals > 0 && !isProcessing && (
                        <div className="godmode-entry godmode-entry-system">
                            <div className="godmode-entry-text">
                                Pending goals in pipeline: {pipelineData.pendingGoals}
                            </div>
                        </div>
                    )}
                </div>

                <form className="godmode-input-bar" onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="text"
                        className="godmode-input"
                        placeholder="Tell Ghost what to do..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isProcessing}
                    />
                    <button
                        type="submit"
                        className="godmode-send-btn"
                        disabled={isProcessing || !input.trim()}
                    >
                        {isProcessing ? 'WAIT' : 'RUN'}
                    </button>
                </form>
            </div>
        </div>
    );
}
