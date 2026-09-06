import { AGIcon, esc, attr } from '../shared.mjs';

export function AGComposer({mode='Ask',placeholder='Ask, create, analyze, or delegate…'}) {
  return `<form class="ag-composer" data-ag-component="composer" aria-label="Composer"><button type="button" class="ag-composer-plus" aria-label="Add context">+</button><textarea name="message" rows="1" aria-label="Message" data-focus-key="composer-input" placeholder="${attr(placeholder)}"></textarea><button type="button" class="ag-mode" aria-label="Composer mode">${esc(mode)}</button><button type="submit" class="ag-send" aria-label="Send">${AGIcon('arrow',{size:17})}</button></form>`;
}
