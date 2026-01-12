import { useEffect, useRef } from 'react';
import { AudioVisualizationService } from '../lib/audio/AudioVisualizationService';
import { ParticleVisualizer } from '../lib/visualization/ParticleVisualizer';
import './AIVisualizer.css';

export default function AIVisualizer({ audioEl, height = 180, onLog = () => {} }) {
  const outerRef = useRef(null);
  const canvasRef = useRef(null);
  const coreRef = useRef(null);
  const svcRef = useRef(null);
  const visRef = useRef(null);

  useEffect(() => {
    if (!audioEl) return; // wait until audio element is available

    const canvas = canvasRef.current;
    const container = outerRef.current && outerRef.current.querySelector('.ai-vis-container');
    const core = coreRef.current;

    let vis;
    try {
      vis = new ParticleVisualizer(canvas, { onLog });
    } catch (e) {
      onLog(`ParticleVisualizer init error: ${e && e.message ? e.message : e}`);
      return;
    }
    visRef.current = vis;

    const svc = new AudioVisualizationService({ audioEl, onLog });
    svcRef.current = svc;

    let mounted = true;
    (async () => {
      await svc.init();
      if (!mounted) return;

      let lastState = 'listening';
      if (container) {
        container.dataset.state = 'listening';
      }

      svc.start((level) => {
        const l = Math.max(0, Math.min(1, level || 0));
        // feed particles so they move more when the AI is speaking
        vis.setLevel(l);

        // decide high-level state: speaking vs listening
        if (container) {
          const state = l > 0.04 ? 'speaking' : 'listening';
          if (state !== lastState) {
            container.dataset.state = state;
            lastState = state;
          }
        }

        // subtle extra modulation on the core circle scale
        if (core) {
          const scale = 1 + l * 0.1;
          core.style.transform = `scale(${scale})`;
        }
      });

      vis.start();
    })();

    return () => {
      mounted = false;
      try { svcRef.current && svcRef.current.destroy(); } catch (e) {}
      try { visRef.current && visRef.current.destroy(); } catch (e) {}
      svcRef.current = null;
      visRef.current = null;
    };
  }, [audioEl]);

  return (
    <div ref={outerRef} className="ai-vis-outer" style={{ height }}>
      <div className="ai-vis-container" data-state="listening">
        <div className="ai-vis-layer ai-vis-particles">
          <canvas ref={canvasRef} className="ai-vis-canvas" />
        </div>
        <div className="ai-vis-layer ai-vis-core-wrapper">
          <div className="ai-vis-core-glow" />
          <div className="ai-vis-core" ref={coreRef}>
            <div className="ai-vis-core-inner" />
          </div>
        </div>
      </div>
    </div>
  );
}
