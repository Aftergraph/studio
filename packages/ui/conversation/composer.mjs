import { AGIcon, esc, attr } from '../shared.mjs';

function normalizeContext(context=[]) {
  const seen=new Set();
  const refs=[];
  for (const item of Array.isArray(context)?context:[]) {
    const type=String(item?.type||'object');
    const id=String(item?.id||'');
    if (!id) continue;
    const key=`${type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({type,id,label:String(item?.label||item?.title||id)});
  }
  return refs;
}

export function AGComposer({
  mode='Ask',
  placeholder='Ask, create, analyze, or delegate…',
  context=[],
  intentHint='',
}={}) {
  const refs=normalizeContext(context);
  const contextHtml=refs.length?`<div class="ag-composer-context" aria-label="Selected context">${refs.map(item=>`<span data-context-ref="${attr(item.type)}:${attr(item.id)}"><small>${esc(item.type)}</small>${esc(item.label)}</span>`).join('')}</div>`:'';
  const preview=intentHint?`<div class="ag-composer-intent" data-intent-preview role="status">${esc(intentHint)}</div>`:'';
  return `<form class="ag-composer" data-ag-component="composer" aria-label="Composer" data-composer-mode="${attr(mode)}">
    ${contextHtml}${preview}
    <button type="button" class="ag-composer-plus" data-composer-action="context-picker" aria-label="Add context">+</button>
    <textarea name="message" rows="1" aria-label="Message" data-focus-key="composer-input" placeholder="${attr(placeholder)}"></textarea>
    <button type="button" class="ag-mode" aria-label="Composer mode">${esc(mode)}</button>
    <button type="submit" class="ag-send" aria-label="Send">${AGIcon('arrow',{size:17})}</button>
  </form>`;
}
