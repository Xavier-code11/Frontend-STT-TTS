import { useEffect, useRef } from 'react';
import './CrisisModal.css';

export default function CrisisModal({ visible = false, text = '', subtype = '', helpUrl = null, onClose = () => {} }) {
  const okRef = useRef(null);

  useEffect(() => {
    if (visible && okRef.current) {
      try { okRef.current.focus(); } catch {}
    }
  }, [visible]);

  if (!visible) return null;

  const label = subtype || 'crisis';

  const onBackdropClick = (e) => {
    // prevent closing when clicking inside the modal content
    if (e.target && e.target.classList && e.target.classList.contains('crisis-backdrop')) {
      // Do not close on backdrop click to ensure acknowledgement via OK
      e.stopPropagation();
    }
  };

  return (
    <div className="crisis-backdrop" onClick={onBackdropClick} aria-modal="true" role="dialog" aria-label="Crisis notification">
      <div className="crisis-modal">
        <div className="crisis-header">
          <span className="crisis-badge">{label}</span>
        </div>
        <div className="crisis-body">
          <p className="crisis-text">{text}</p>
        </div>
        <div className="crisis-actions">
          <button className="crisis-btn crisis-ok" onClick={onClose} ref={okRef} autoFocus>
            OK
          </button>
          {helpUrl ? (
            <a className="crisis-btn crisis-help" href={helpUrl} target="_blank" rel="noopener noreferrer">
              Dapatkan Bantuan
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
