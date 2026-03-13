/**
 * DialogProvider
 *
 * Provides two imperative APIs accessible via `useDialog()`:
 *   - `confirm(options)`  → Promise<boolean>   — replaces window.confirm
 *   - `toast(options)`    → void               — replaces window.alert
 *
 * Renders a single modal overlay for confirms and a toast stack for alerts.
 * All animations are CSS-only (no extra deps beyond what's already in the project).
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Label for the confirm button (default: "Confirm") */
  confirmLabel?: string;
  /** Label for the cancel button (default: "Cancel") */
  cancelLabel?: string;
  /** Visual style of the confirm button (default: "danger") */
  variant?: 'danger' | 'primary';
}

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  /** Auto-dismiss after ms (default: 3500) */
  duration?: number;
}

interface DialogContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  toast: (opts: ToastOptions) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within <DialogProvider>');
  return ctx;
}

// ─── Internal state types ────────────────────────────────────────────────────

interface ConfirmState {
  opts: ConfirmOptions;
  resolve: (v: boolean) => void;
}

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  /** When to start the exit animation */
  exiting: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOAST_ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const TOAST_COLORS: Record<ToastVariant, { bg: string; icon: string; border: string }> = {
  success: {
    bg: 'rgba(24,122,66,0.07)',
    icon: 'var(--color-success)',
    border: 'rgba(24,122,66,0.22)',
  },
  error: {
    bg: 'rgba(197,95,54,0.08)',
    icon: 'var(--color-terra)',
    border: 'rgba(197,95,54,0.25)',
  },
  info: {
    bg: 'rgba(16,40,69,0.07)',
    icon: 'var(--color-primary-400)',
    border: 'rgba(16,40,69,0.18)',
  },
  warning: {
    bg: 'rgba(217,122,16,0.08)',
    icon: 'var(--color-accent)',
    border: 'rgba(217,122,16,0.25)',
  },
};

let _toastId = 0;

// ─── Provider ────────────────────────────────────────────────────────────────

export default function DialogProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerMap = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // ── confirm ──────────────────────────────────────────────────────────────
  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ opts, resolve });
    });
  }, []);

  const handleConfirmResolve = useCallback(
    (value: boolean) => {
      confirmState?.resolve(value);
      setConfirmState(null);
    },
    [confirmState]
  );

  // ── toast ────────────────────────────────────────────────────────────────
  const dismissToast = useCallback((id: number) => {
    // Trigger exit animation
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    // Remove after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 320);
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = ++_toastId;
      const duration = opts.duration ?? 3500;
      setToasts((prev) => [
        ...prev,
        { id, message: opts.message, variant: opts.variant ?? 'info', exiting: false },
      ]);
      const timer = setTimeout(() => {
        dismissToast(id);
        timerMap.current.delete(id);
      }, duration);
      timerMap.current.set(id, timer);
    },
    [dismissToast]
  );

  // ── render ───────────────────────────────────────────────────────────────
  const confirmOpts = confirmState?.opts;

  return (
    <DialogContext.Provider value={{ confirm, toast }}>
      {children}

      {/* ── Confirm Modal ── */}
      {confirmState && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dlg-title"
          aria-describedby="dlg-desc"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => handleConfirmResolve(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(10,20,38,0.48)',
              backdropFilter: 'blur(3px)',
              animation: 'dlg-fade-in 0.18s ease',
            }}
          />

          {/* Panel */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '420px',
              background: 'linear-gradient(160deg, #fff 0%, var(--color-parchment) 100%)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 24px 60px rgba(10,20,38,0.22), 0 4px 12px rgba(10,20,38,0.1)',
              padding: '1.75rem',
              animation: 'dlg-slide-up 0.22s cubic-bezier(0.34, 1.26, 0.64, 1)',
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: '2.75rem',
                height: '2.75rem',
                borderRadius: '50%',
                background:
                  confirmOpts?.variant === 'primary' ? 'rgba(16,40,69,0.1)' : 'rgba(197,95,54,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <AlertTriangle
                style={{
                  width: '1.25rem',
                  height: '1.25rem',
                  color:
                    confirmOpts?.variant === 'primary'
                      ? 'var(--color-primary-400)'
                      : 'var(--color-terra)',
                }}
              />
            </div>

            <h3
              id="dlg-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.15rem',
                fontWeight: 600,
                color: 'var(--color-ink)',
                marginBottom: '0.5rem',
                lineHeight: 1.3,
              }}
            >
              {confirmOpts?.title}
            </h3>
            <p
              id="dlg-desc"
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-muted)',
                lineHeight: 1.55,
                marginBottom: '1.5rem',
              }}
            >
              {confirmOpts?.message}
            </p>

            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
              {/* Cancel */}
              <button
                onClick={() => handleConfirmResolve(false)}
                style={{
                  padding: '0.5rem 1.1rem',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-accent)',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  border: '1px solid var(--color-border-dark)',
                  borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  color: 'var(--color-muted)',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    'var(--color-surface-2)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-ink)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)';
                }}
              >
                {confirmOpts?.cancelLabel ?? 'Cancel'}
              </button>

              {/* Confirm */}
              <button
                onClick={() => handleConfirmResolve(true)}
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-accent)',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  color: '#fff',
                  background:
                    confirmOpts?.variant === 'primary'
                      ? 'linear-gradient(135deg, var(--color-primary-700), var(--color-primary))'
                      : 'linear-gradient(135deg, var(--color-terra), #a0411e)',
                  boxShadow:
                    confirmOpts?.variant === 'primary'
                      ? '0 4px 12px rgba(16,40,69,0.3)'
                      : '0 4px 12px rgba(197,95,54,0.35)',
                  transition: 'filter 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.filter = '';
                }}
              >
                {confirmOpts?.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Stack ── */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          aria-atomic="false"
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.625rem',
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => {
            const Icon = TOAST_ICONS[t.variant];
            const colors = TOAST_COLORS[t.variant];
            return (
              <div
                key={t.id}
                role="status"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.625rem',
                  padding: '0.75rem 1rem',
                  background: `linear-gradient(135deg, #fff, var(--color-parchment))`,
                  border: `1px solid ${colors.border}`,
                  borderLeft: `3px solid ${colors.icon}`,
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: '0 8px 24px rgba(10,20,38,0.13), 0 2px 6px rgba(10,20,38,0.07)',
                  maxWidth: '340px',
                  minWidth: '240px',
                  pointerEvents: 'all',
                  animation: t.exiting
                    ? 'toast-exit 0.3s ease forwards'
                    : 'toast-enter 0.28s cubic-bezier(0.34,1.26,0.64,1)',
                }}
              >
                <Icon
                  style={{
                    width: '1rem',
                    height: '1rem',
                    color: colors.icon,
                    flexShrink: 0,
                    marginTop: '0.05rem',
                  }}
                />
                <span
                  style={{
                    fontSize: '0.825rem',
                    color: 'var(--color-ink)',
                    lineHeight: 1.45,
                    flex: 1,
                  }}
                >
                  {t.message}
                </span>
                <button
                  onClick={() => dismissToast(t.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.1rem',
                    color: 'var(--color-muted-2)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X style={{ width: '0.8rem', height: '0.8rem' }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Keyframes (injected once) ── */}
      <style>{`
        @keyframes dlg-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dlg-slide-up {
          from { opacity: 0; transform: translateY(18px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toast-enter {
          from { opacity: 0; transform: translateX(24px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes toast-exit {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to   { opacity: 0; transform: translateX(24px) scale(0.95); }
        }
      `}</style>
    </DialogContext.Provider>
  );
}
