const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const attr = esc;
const MODES=['Ask','Research','Build','Create','Delegate','Automate'];

export function normalizeIntent(input={}) {
  const rawMode=String(input.mode||'Ask');
  const mode=MODES.find(item=>item.toLowerCase()===rawMode.toLowerCase()) || 'Ask';
  const unique=[];const seen=new Set();
  for (const item of Array.isArray(input.context)?input.context:[]) {
    const key=`${item?.type||'object'}:${item?.id||''}`;
    if (!item?.id || seen.has(key)) continue;
    seen.add(key);unique.push({ type:item.type||'object', id:item.id, label:item.label||item.id });
  }
  return {
    text:String(input.text||''),
    mode,
    context:unique,
    attachments:(Array.isArray(input.attachments)?input.attachments:[]).map(item=>({ name:String(item.name||'attachment'), kind:String(item.kind||'file') })),
  };
}

export function AGIntentComposer({ intent=normalizeIntent(), capabilities=MODES, voiceAvailable=false }={}) {
  const normalized=normalizeIntent(intent);
  return `<form class="ag-intent-composer" data-ag-component="intent-composer" data-intent-mode="${attr(normalized.mode)}"><div class="ag-intent-capabilities" role="tablist" aria-label="Intent capability">${capabilities.map(cap=>`<button type="button" role="tab" aria-selected="${cap===normalized.mode?'true':'false'}" class="${cap===normalized.mode?'active':''}" data-capability="${attr(cap)}">${esc(cap)}</button>`).join('')}</div>${normalized.context.length?`<div class="ag-intent-context" aria-label="Attached context">${normalized.context.map(item=>`<button type="button" data-context-remove="${attr(item.type)}:${attr(item.id)}"><span>${esc(item.type)}</span>${esc(item.label)}<i>×</i></button>`).join('')}</div>`:''}${normalized.attachments.length?`<div class="ag-intent-attachments">${normalized.attachments.map(item=>`<span><i>${esc(item.kind)}</i>${esc(item.name)}</span>`).join('')}</div>`:''}<input type="file" multiple data-intent-files hidden aria-label="Attach files"><div class="ag-intent-input"><button type="button" data-composer-action="attach" aria-label="Attach files">＋</button><textarea name="message" rows="1" placeholder="Ask, build, or direct the workspace…">${esc(normalized.text)}</textarea><button type="button" data-composer-action="voice" aria-label="Voice input" ${voiceAvailable?'':'disabled aria-disabled="true" title="Voice requires a connected host"'}>◉</button><button type="submit" class="ag-intent-send" aria-label="Send intent">↑</button></div><footer><span>${esc(normalized.mode)} mode</span><button type="button" data-composer-action="context-picker">Context</button><button type="button" data-composer-action="capability-picker">Capabilities</button></footer></form>`;
}
