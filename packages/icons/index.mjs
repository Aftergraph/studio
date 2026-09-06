const ICONS = Object.freeze({
  trajectory:{ name:'trajectory', path:'M4 17h4V7h4v6h4V4h4' },
  approval:{ name:'approval', path:'M12 3l7 3v5c0 4.4-2.6 8-7 10-4.4-2-7-5.6-7-10V6l7-3z' },
  artifact:{ name:'artifact', path:'M6 3h8l4 4v14H6z M14 3v5h5' },
  evidence:{ name:'evidence', path:'M5 12l4 4L19 6' },
  agent:{ name:'agent', path:'M8 8a4 4 0 1 0 8 0 4 4 0 0 0-8 0zm-3 13c.5-4 3-6 7-6s6.5 2 7 6' },
  command:{ name:'command', path:'M9 6H6a3 3 0 1 0 3 3V6zm6 0h3a3 3 0 1 1-3 3V6zm-6 9H6a3 3 0 1 1 3-3v3zm6 0h3a3 3 0 1 0-3-3v3z' },
  sparkle:{ name:'sparkle', path:'M12 3l1.4 4.1L17.5 9l-4.1 1.4L12 14.5l-1.4-4.1L6.5 9l4.1-1.9L12 3z' },
  pause:{ name:'pause', path:'M8 5h3v14H8zm5 0h3v14h-3z' },
  play:{ name:'play', path:'M8 5l11 7-11 7z' },
  close:{ name:'close', path:'M6 6l12 12M18 6L6 18' },
  inspect:{ name:'inspect', path:'M12 5c5 0 8 7 8 7s-3 7-8 7-8-7-8-7 3-7 8-7zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
  shield:{ name:'shield', path:'M12 3l7 3v5c0 4-2.3 7.4-7 10-4.7-2.6-7-6-7-10V6z' },
  check:{ name:'check', path:'M5 12l4 4L19 6' },
  arrow:{ name:'arrow', path:'M5 12h14m-5-5 5 5-5 5' },
});

export function iconSpec(name) {
  return ICONS[name] || { name:'unknown', path:'M6 6h12v12H6z' };
}

export function AGIcon(name,{size=18,label=''}={}) {
  const spec=iconSpec(name);
  const aria=label ? `role="img" aria-label="${escapeAttr(label)}"` : 'aria-hidden="true"';
  return `<svg class="ag-icon" ${aria} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${spec.path}"/></svg>`;
}

function escapeAttr(v=''){return String(v).replace(/[&"<>]/g,m=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[m]));}
