import { useEffect, useMemo, useRef, useState } from 'react';
import Env from '../config/env';
import { VoiceChatClient } from '../services/VoiceChatClient';
import AIVisualizer from './AIVisualizer';
import CrisisModal from './CrisisModal';
import './VoiceChatWidget.css';

export default function VoiceChatWidget() {
  const audioRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [mode, setMode] = useState('ws'); // 'ws' or 'http'
  const clientRef = useRef(null);
  const [recState, setRecState] = useState('idle'); // idle|recording|recorded
  const [activeTab, setActiveTab] = useState('ai'); // 'ai' or 'logs'
  const [crisis, setCrisis] = useState({ visible: false, text: '', subtype: '', helpUrl: null });

  const log = (msg) => {
    setLogs((prev) => [msg, ...prev].slice(0, 100));
    // Also console for debugging
    console.log('[VoiceChat]', msg);
  };

  const onError = (e) => {
     log(`ERROR: ${e?.message || e}`);
  };

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
      }
    };
  }, []);

  const initClient = async () => {
    // Destroy previous
    if (clientRef.current) { clientRef.current.destroy(); clientRef.current = null; }
    const client = new VoiceChatClient({ 
      mode, 
      sessionId: Env.SESSION_ID, 
      language: Env.LANGUAGE, 
      audioMime: Env.AUDIO_MIME, 
      onLog: log, 
      onError, 
      onCrisis: ({ text, subtype, helpUrl }) => {
        setCrisis({ visible: true, text: text || 'Ada situasi darurat.', subtype: subtype || 'crisis', helpUrl: helpUrl || null });
      }
    });
    client.attachAudioElement(audioRef.current);
    await client.init();
    clientRef.current = client;
  };

  const start = async () => {
    if (!clientRef.current) await initClient();
    clientRef.current.startRecording();
    setRecState('recording');
  };

  const stop = async () => {
    if (!clientRef.current) return;
    clientRef.current.stopRecording();
    setRecState('recorded');
  };

  const send = async () => {
    if (mode !== 'http') { log('Send is only for HTTP mode'); return; }
    if (!clientRef.current) return;
    await clientRef.current.sendHttp({ stream: true });
    setRecState('idle');
  };

  const reset = () => {
    // Soft reset: do not destroy client or close WS; just reset UI state
    setRecState('idle');
    setCrisis({ visible: false, text: '', subtype: '', helpUrl: null });
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="vc-card">
      <div className="vc-header">
        <h2 className="vc-title">Voice AI Assistant</h2>
        <div className="vc-tabs">
          <button 
            className={`vc-tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            AI Chat
          </button>
          <button 
            className={`vc-tab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            Logs & Info
          </button>
        </div>
      </div>

      {activeTab === 'ai' && (
        <div className="vc-main-view">
          <div className="vc-mode">
            <label>
              Mode:&nbsp;
              <select value={mode} onChange={(e) => { setMode(e.target.value); reset(); }}>
                <option value="ws">Mode B: WebSocket realtime</option>
                <option value="http">Mode A: HTTP streaming</option>
              </select>
            </label>
          </div>

          <div className="vc-ai-section">
            <AIVisualizer audioEl={audioRef.current} height={300} onLog={log} />
            
            <div className="vc-controls">
              {recState === 'idle' && (
                <button className="vc-btn-icon" onClick={start} title="Start Recording">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z" fill="currentColor"/>
                    <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
              {recState === 'recording' && (
                <button className="vc-btn-icon vc-btn-stop" onClick={stop} title="Stop Recording">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/>
                  </svg>
                </button>
              )}
              {recState === 'recorded' && (
                <>
                  {mode === 'http' && (
                    <button className="vc-btn" onClick={send} title="Send">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 6 }}>
                        <path d="M22 2 11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M22 2 15 22l-4-9-9-4 20-7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                      </svg>
                      Send
                    </button>
                  )}
                  <button className="vc-btn vc-btn-secondary" onClick={reset} title="Reset">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 6 }}>
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3 21v-5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Reset
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Crisis Modal Overlay */}
          <CrisisModal 
            visible={crisis.visible}
            text={crisis.text}
            subtype={crisis.subtype}
            helpUrl={crisis.helpUrl}
            onClose={() => setCrisis({ visible: false, text: '', subtype: '', helpUrl: null })}
          />

          <audio ref={audioRef} style={{ display: 'none' }} />
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="vc-logs-panel">
          <div className="vc-env-info">
            <div className="vc-env-info-title">Configuration</div>
            <div className="vc-env-info-item"><strong>HTTP URL:</strong> {Env.BACKEND_HTTP_URL}</div>
            <div className="vc-env-info-item"><strong>WS URL:</strong> {Env.BACKEND_WS_URL}</div>
            <div className="vc-env-info-item"><strong>Session ID:</strong> {Env.SESSION_ID}</div>
            <div className="vc-env-info-item"><strong>Language:</strong> {Env.LANGUAGE}</div>
            <div className="vc-env-info-item"><strong>Audio MIME:</strong> {Env.AUDIO_MIME}</div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div className="vc-env-info-title">Activity Logs</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="vc-btn vc-btn-secondary" onClick={clearLogs} style={{ padding: '6px 12px', fontSize: '12px' }}>
                    Clear Logs
                  </button>
                  <button className="vc-btn vc-btn-secondary" onClick={() => {
                    // dev helper: simulate incoming crisis event
                    const sample = {
                      event: 'crisis',
                      type: 'crisis',
                      text: "Keselamatanmu sangat penting. Jika kamu dalam bahaya segera, mohon hubungi layanan darurat setempat sekarang. Kami tidak dapat memberikan detail cara atau langkah. Kamu tidak sendirian—dukungan dari orang tepercaya atau profesional bisa membantu. Jika berkenan, aku bisa membagikan informasi bantuan resmi sesuai wilayahmu.",
                      meta: { source: 'failsafe', flow: 'if_crisisTerm:true' }
                    };
                    setCrisis({ visible: true, text: sample.text, subtype: sample.type || (sample.meta && sample.meta.subtype), helpUrl: (sample.meta && sample.meta.help_url) || null });
                  }} style={{ padding: '6px 12px', fontSize: '12px' }}>
                    Simulate Crisis
                  </button>
                </div>
            </div>
            <div className="vc-logs">
              {logs.length === 0 ? (
                <div style={{ color: 'var(--vc-muted)', textAlign: 'center', padding: '20px' }}>
                  No activity yet. Start recording to see logs.
                </div>
              ) : (
                logs.map((l, i) => (<div key={i}>{l}</div>))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
