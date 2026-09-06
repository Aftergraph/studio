export function renderSpaceView({toolbar='',canvas='',context='',composer='',spaceId='space_primary',mode='balanced'}={}){
  return `<main id="main-content" class="ag-space-stage ag-direct-space" data-space-id="${String(spaceId)}" data-space-mode="${String(mode)}">
    <div class="ag-space-edge-controls">${toolbar}</div>
    <div class="ag-space-layout"><div class="ag-space-canvas">${canvas}</div><aside class="ag-space-context">${context}</aside></div>
    <div class="ag-space-composer">${composer}</div>
  </main>`;
}
