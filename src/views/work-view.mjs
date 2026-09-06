export function renderWorkView({rail='',header='',summary='',attention='',outcome='',trajectory='',artifact='',artifactOpen=false}={}){
  return `<main id="main-content" class="ag-workspace-work ag-calm-work ${artifactOpen?'with-artifact':''}">
    <aside class="ag-mission-rail">${rail}</aside>
    <section class="ag-work-canvas"><div class="ag-work-detail ag-outcome-first">${header}${summary}${attention}${outcome}<details class="ag-work-trajectory-disclosure"><summary><span>Trajectory</span><small>Inspect execution path</small></summary>${trajectory}</details></div>${artifactOpen?artifact:''}</section>
  </main>`;
}
