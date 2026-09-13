'use client';

import { useEffect, useState } from 'react';
import { Z_INDEX, TOAST_DURATION } from '../constants';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  message: string;
  type: ToastType;
  duration: number;
  onDismiss?: () => void;
  dismissible?: boolean;
}

const toastIcon: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2717',
  warning: '\u26a0',
  info: '\u2139',
};

export function Toast({
  message,
  type = 'info',
  duration = TOAST_DURATION,
  onDismiss,
  dismissible = true,
}: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    let exitTimer: ReturnType<typeof setTimeout> | null = null;
    const timer = setTimeout(() => {
      setIsExiting(true);
      exitTimer = setTimeout(() => {
        onDismiss?.();
      }, 300);
    }, duration);

    return () => {
      clearTimeout(timer);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss?.();
    }, 300);
  };

  return (
    <div
      className={`toast toast-${type} ${isExiting ? 'toast-exiting' : 'toast-entering'}`}
      role="alert"
      aria-live="polite"
      style={{ zIndex: Z_INDEX.toast }}
    >
      <span className="toast-icon" aria-hidden="true">
        {toastIcon[type]}
      </span>
      <span className="toast-message">{message}</span>
      {dismissible && (
        <button
          className="toast-dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss"
          type="button"
        >
          {'\u00d7'}
        </button>
      )}
    </div>
  );
}

export interface ToastContainerProps {
  children: React.ReactNode;
}

export function ToastContainer({ children }: ToastContainerProps) {
  return (
    <div className="toast-container" style={{ zIndex: Z_INDEX.toast }}>
      {children}
    </div>
  );
}

export type ToastState = {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  dismissible?: boolean;
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const addToast = (toast: Omit<ToastState, 'id'>) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const success = (message: string, duration: number = TOAST_DURATION) => {
    return addToast({ message, type: 'success' as const, duration });
  };

  const error = (message: string, duration: number = TOAST_DURATION) => {
    return addToast({ message, type: 'error' as const, duration });
  };

  const info = (message: string, duration: number = TOAST_DURATION) => {
    return addToast({ message, type: 'info' as const, duration });
  };

  const warning = (message: string, duration: number = TOAST_DURATION) => {
    return addToast({ message, type: 'warning' as const, duration });
  };

  const clearAll = () => {
    setToasts([]);
  };

  return {
    toasts,
    addToast,
    dismissToast,
    success,
    error,
    info,
    warning,
    clearAll,
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();

  return (
    <>
      {children}
      <ToastContainer>
        {toast.toasts.map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            duration={t.duration}
            dismissible={t.dismissible ?? true}
            onDismiss={() => toast.dismissToast(t.id)}
          />
        ))}
      </ToastContainer>
    </>
  );
}
