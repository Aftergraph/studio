export function createSurfaceLifecycle(names=[]) {
  const state=new Map(names.map(name=>[String(name),false]));
  return Object.freeze({
    entered(name,isOpen){
      const key=String(name);
      const previous=Boolean(state.get(key));
      const next=Boolean(isOpen);
      state.set(key,next);
      return next&&!previous;
    },
    isOpen(name){return Boolean(state.get(String(name)))},
    snapshot(){return Object.fromEntries(state.entries())},
  });
}
