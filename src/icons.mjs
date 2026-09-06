const paths = {
  today:'<path d="M4 13h6V4H4v9Zm0 7h6v-3H4v3Zm10 0h6v-9h-6v9Zm0-13h6V4h-6v3Z"/>',
  chat:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M8 9h8M8 13h5"/>',
  work:'<path d="M4 7h16v12H4z"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 11h16"/>',
  library:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M8 8h8M8 12h8"/>',
  agents:'<circle cx="9" cy="9" r="3"/><circle cx="17" cy="8" r="2"/><path d="M4 20a5 5 0 0 1 10 0M14 18a4 4 0 0 1 7 2"/>',
  connections:'<circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 11l8-4M8 13l8 4"/>',
  brain:'<path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 3 3 3 0 0 0 2 3v1a3 3 0 0 0 3 3c1 0 2-.5 3-1.5V5.5C11 4.5 10 4 9 4Z"/><path d="M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 3 3 3 0 0 1-2 3v1a3 3 0 0 1-3 3c-1 0-2-.5-3-1.5V5.5C13 4.5 14 4 15 4Z"/>',
  output:'<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 13h8M8 17h5"/>',
  control:'<path d="M12 3 5 6v5c0 4.8 2.8 8.1 7 10 4.2-1.9 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  system:'<circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2.2-.8-.6-1.5 1-2-2.1-2.1-2 1-1.6-.6L10.5 2h-3l-.8 2.2-1.5.6-2-1L1.1 5.9l1 2-.6 1.6L0 10.5v3l2.2.8.6 1.5-1 2 2.1 2.1 2-1 1.6.6.8 2.5h3l.8-2.2 1.5-.6 2 1 2.1-2.1-1-2 .6-1.6 1.7-1Z" transform="translate(2 0) scale(.83)"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  command:'<path d="M9 6a3 3 0 1 0-3 3h3V6Zm6 0v3h3a3 3 0 1 0-3-3Zm0 12a3 3 0 1 0 3-3h-3v3Zm-6 0v-3H6a3 3 0 1 0 3 3Z"/><path d="M9 9h6v6H9z"/>',
  moon:'<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  arrow:'<path d="m9 18 6-6-6-6"/>',
  send:'<path d="m3 20 18-8L3 4l3 8-3 8Z"/><path d="M6 12h15"/>',
  paperclip:'<path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 1 1-2.8-2.8l8.3-8.3"/>',
  inspect:'<circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  spark:'<path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  play:'<path d="m8 5 11 7-11 7V5Z"/>',
  shield:'<path d="M12 3 5 6v5c0 4.8 2.8 8.1 7 10 4.2-1.9 7-5.2 7-10V6l-7-3Z"/>',
  file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/>',
  external:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6H5V6h6"/>',
  chevronDown:'<path d="m6 9 6 6 6-6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  evidence:'<path d="M5 4h14v16H5z"/><path d="m8 12 2 2 5-5M8 17h8"/>',
};

export function icon(name, { size=18, className='' } = {}) {
  const body = paths[name] || paths.file;
  return `<svg class="ui-icon ${className}" aria-hidden="true" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
