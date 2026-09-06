import { AGIcon, esc, attr } from '../shared.mjs';

export function AGIconButton({label,action='',icon='sparkle',tone='default'}) {
  return `<button type="button" class="ag-icon-button ${attr(tone)}" data-ag-component="icon-button" aria-label="${attr(label)}"${action?` data-action="${attr(action)}"`:''}>${AGIcon(icon,{size:16})}</button>`;
}
