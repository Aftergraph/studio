import { attr } from '../../packages/ui/shared.mjs';
import { AGGenUIError, renderGeneratedNode } from './component-registry.mjs';

function fallback(error,index,messageId){
  const code=error instanceof AGGenUIError?error.code:'render_failed';
  return `<section class="ag-generated-surface is-fallback" data-genui-instance="${attr(`${messageId||'message'}:${index}`)}" data-genui-error="${attr(code)}" role="status"><strong>Structured response unavailable</strong><span>The surrounding conversation is still usable.</span></section>`;
}

export function renderGeneratedMessageSurfaces({message={},registry,context={}}={}) {
  const nodes=Array.isArray(message.generatedUI)?message.generatedUI:[];
  return nodes.map((node,index)=>{
    try {
      const rendered=renderGeneratedNode({registry,node,context});
      return `<section class="ag-generated-surface" data-genui-instance="${attr(rendered.instanceId)}" data-genui-component="${attr(rendered.componentId)}" data-genui-version="${attr(rendered.componentVersion)}" data-genui-message-id="${attr(message.id||'')}" data-genui-index="${index}" data-genui-blocked="${rendered.blocked?'true':'false'}">${rendered.html}</section>`;
    } catch(error) {
      return fallback(error,index,message.id);
    }
  }).join('');
}
