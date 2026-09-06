/**
 * @aftergraph/brand/react
 * React components and hooks for Aftergraph Brand Design System.
 */

import React, { createContext, useContext, useMemo } from 'react';
import {
  BRAND_TOKENS,
  BRAND_COLORS,
  BRAND_THEMES,
  resolveBrandColor,
} from './index.mjs';

export const BrandContext = createContext({
  theme: 'dark',
  tokens: BRAND_TOKENS,
  resolveColor: (role) => resolveBrandColor(role, 'dark'),
});

export function BrandProvider({ theme = 'dark', children }) {
  const value = useMemo(() => ({
    theme,
    tokens: BRAND_TOKENS,
    resolveColor: (role) => resolveBrandColor(role, theme),
  }), [theme]);

  return React.createElement(BrandContext.Provider, { value }, children);
}

export function useBrandTokens() {
  return useContext(BrandContext);
}

/**
 * High-fidelity SVG Aftergraph Monogram component
 */
export function AftergraphMonogram({
  size = 32,
  variant = 'default', // 'default' | 'mono' | 'inverse'
  className = '',
  style = {},
  ...props
}) {
  const strokeColor = variant === 'inverse' ? '#080C14' : (variant === 'mono' ? '#F5F7FA' : '#42C7E8');
  const edgeColor = variant === 'inverse' ? '#080C14' : '#F5F7FA';
  const nodeColor = variant === 'inverse' ? '#080C14' : '#F5F7FA';
  const kernelColor = variant === 'inverse' ? '#080C14' : (variant === 'mono' ? '#F5F7FA' : '#42C7E8');

  return React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 256 256',
      role: 'img',
      'aria-label': 'Aftergraph Monogram',
      className: `ag-brand-monogram ${className}`.trim(),
      style: { display: 'inline-block', verticalAlign: 'middle', ...style },
      ...props,
    },
    React.createElement('path', {
      d: 'M128 24 218 76v104l-90 52-90-52V76z',
      fill: 'none',
      stroke: strokeColor,
      strokeWidth: 10,
      strokeLinejoin: 'round',
    }),
    React.createElement(
      'g',
      { stroke: edgeColor, strokeWidth: 6, fill: 'none', strokeLinejoin: 'round' },
      React.createElement('path', { d: 'M78 92 128 62l50 30v72l-50 30-50-30z' }),
      React.createElement('path', { d: 'M128 62v132' })
    ),
    React.createElement(
      'g',
      { fill: nodeColor },
      React.createElement('circle', { cx: 128, cy: 62, r: 10 }),
      React.createElement('circle', { cx: 78, cy: 92, r: 10 }),
      React.createElement('circle', { cx: 178, cy: 92, r: 10 }),
      React.createElement('circle', { cx: 78, cy: 164, r: 10 }),
      React.createElement('circle', { cx: 178, cy: 164, r: 10 }),
      React.createElement('circle', { cx: 128, cy: 194, r: 10 })
    ),
    React.createElement('path', {
      d: 'm128 101 27 27-27 27-27-27z',
      fill: kernelColor,
    })
  );
}

/**
 * High-fidelity SVG Aftergraph Wordmark component
 */
export function AftergraphWordmark({
  height = 36,
  variant = 'dark', // 'dark' | 'light' | 'transparent'
  showTagline = true,
  className = '',
  style = {},
  ...props
}) {
  const isLight = variant === 'light';
  const textColor = isLight ? '#080C14' : '#F5F7FA';
  const tagColor = isLight ? '#0C52EF' : '#42C7E8';
  const width = Math.round(height * 4.6);

  return React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width,
      height,
      viewBox: '0 0 1200 260',
      role: 'img',
      'aria-label': 'Aftergraph Wordmark',
      className: `ag-brand-wordmark ${className}`.trim(),
      style: { display: 'inline-block', verticalAlign: 'middle', ...style },
      ...props,
    },
    variant !== 'transparent'
      ? React.createElement('rect', {
          width: 1200,
          height: 260,
          fill: isLight ? '#F5F7FA' : '#080C14',
        })
      : null,
    React.createElement(
      'text',
      {
        x: 40,
        y: showTagline ? 140 : 160,
        fill: textColor,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 96,
        fontWeight: 760,
        letterSpacing: '-1.5',
      },
      'Aftergraph'
    ),
    showTagline
      ? React.createElement(
          'text',
          {
            x: 44,
            y: 200,
            fill: tagColor,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 26,
            fontWeight: 500,
          },
          'Infrastructure for governed autonomous intelligence'
        )
      : null
  );
}

/**
 * High-fidelity SVG Aftergraph App Icon component
 */
export function AftergraphAppIcon({
  size = 64,
  className = '',
  style = {},
  ...props
}) {
  return React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 512 512',
      role: 'img',
      'aria-label': 'Aftergraph App Icon',
      className: `ag-brand-app-icon ${className}`.trim(),
      style: { display: 'inline-block', verticalAlign: 'middle', ...style },
      ...props,
    },
    React.createElement('rect', {
      x: 16,
      y: 16,
      width: 480,
      height: 480,
      rx: 108,
      fill: '#080C14',
      stroke: '#42C7E8',
      strokeWidth: 3,
      strokeOpacity: 0.28,
    }),
    React.createElement(
      'g',
      { transform: 'translate(89.6 89.6) scale(1.3)' },
      React.createElement('path', {
        d: 'M128 24 218 76v104l-90 52-90-52V76z',
        fill: 'none',
        stroke: '#42C7E8',
        strokeWidth: 10,
        strokeLinejoin: 'round',
      }),
      React.createElement(
        'g',
        { stroke: '#F5F7FA', strokeWidth: 6, fill: 'none', strokeLinejoin: 'round' },
        React.createElement('path', { d: 'M78 92 128 62l50 30v72l-50 30-50-30z' }),
        React.createElement('path', { d: 'M128 62v132' })
      ),
      React.createElement('circle', { cx: 128, cy: 62, r: 11, fill: '#7759E8' }),
      React.createElement('circle', { cx: 78, cy: 92, r: 10, fill: '#4C8BD8' }),
      React.createElement('circle', { cx: 178, cy: 92, r: 10, fill: '#42C7E8' }),
      React.createElement('circle', { cx: 78, cy: 164, r: 10, fill: '#F0A64A' }),
      React.createElement('circle', { cx: 178, cy: 164, r: 10, fill: '#24C4AD' }),
      React.createElement('circle', { cx: 128, cy: 194, r: 11, fill: '#F5F7FA' }),
      React.createElement('path', {
        d: 'm128 101 27 27-27 27-27-27z',
        fill: '#42C7E8',
      })
    )
  );
}
