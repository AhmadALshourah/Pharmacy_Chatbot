import { useContext } from 'react';
import { ToastCtx } from '../../contexts/ToastContext';
import Icon from './Icon';

// L8: warn gets a circle-with-! icon; error keeps the triangle-with-! (alert)
// so the two types are visually distinct, not just by colour.
const ICONS = {
  success: 'check',
  error:   'alert',
  warn:    'warnCircle',
  info:    'bell',
};

export default function ToastContainer() {
  const { toasts, dismiss } = useContext(ToastCtx);
  if (!toasts.length) return null;

  return (
    <div className="pc-toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`pc-toast pc-toast-${t.type}`}>
          <span className={`pc-toast-icon pc-toast-icon-${t.type}`}>
            <Icon name={ICONS[t.type] ?? 'bell'} size={13} stroke={2.2} />
          </span>
          <span className="pc-toast-msg">{t.message}</span>
          <button className="pc-toast-dismiss" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <Icon name="x" size={12} stroke={2} />
          </button>
        </div>
      ))}
    </div>
  );
}
