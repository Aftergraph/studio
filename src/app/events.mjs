// V5.2 event binding module. The complete delegated-event migration is incremental;
// this boundary is intentionally dependency-injected so DOM events cannot own canonical state.
export function bindAppEvents({root,handlers={}}={}){
  if(!root)return ()=>{};
  const onClick=event=>handlers.click?.(event);
  const onSubmit=event=>handlers.submit?.(event);
  const onInput=event=>handlers.input?.(event);
  const onChange=event=>handlers.change?.(event);
  root.addEventListener('click',onClick);root.addEventListener('submit',onSubmit);root.addEventListener('input',onInput);root.addEventListener('change',onChange);
  return ()=>{root.removeEventListener('click',onClick);root.removeEventListener('submit',onSubmit);root.removeEventListener('input',onInput);root.removeEventListener('change',onChange)};
}
