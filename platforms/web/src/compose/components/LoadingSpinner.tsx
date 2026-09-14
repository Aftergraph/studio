'use client';

import { Z_INDEX } from '../constants';

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  overlay?: boolean;
}

export function LoadingSpinner({ 
  size = 'medium', 
  text,
  overlay = false 
}: LoadingSpinnerProps) {
  const sizeClass = `spinner-${size}`;
  
  if (overlay) {
    return (
      <div className="spinner-overlay" style={{ zIndex: Z_INDEX.loading }}>
        <div className={`spinner-container ${sizeClass}`}>
          <div className="spinner" aria-label="Loading" />
          {text && <p className="spinner-text">{text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`spinner-container ${sizeClass}`}>
      <div className="spinner" aria-label="Loading" />
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );
}

export function InlineSpinner({ size = 'small' }: { size?: 'small' | 'medium' | 'large' }) {
  return (
    <span className={`inline-spinner spinner-${size}`} aria-label="Loading">
      <span className="spinner" />
    </span>
  );
}
