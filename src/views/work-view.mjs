export function renderWorkView({rail='',header='',summary='',attention='',outcome='',trajectory='',artifact='',artifactOpen=false}={}){
  const billingLauncher=`<a class="ag-billing-launcher" href="/billing/" aria-label="Open Aftergraph Billing"><span class="ag-billing-launcher-mark" aria-hidden="true"></span><span><strong>Aftergraph Billing</strong><small>Review invoice-ready work</small></span><span class="ag-billing-launcher-arrow" aria-hidden="true">→</span></a>`;
  return `<main id="main-content" class="ag-workspace-work ag-calm-work ${artifactOpen?'with-artifact':''}">
    <aside class="ag-mission-rail">${rail}</aside>
    <section class="ag-work-canvas"><div class="ag-work-detail ag-outcome-first">${header}${summary}${attention}${outcome}${billingLauncher}<details class="ag-work-trajectory-disclosure"><summary><span>Trajectory</span><small>Inspect execution path</small></summary>${trajectory}</details></div>${artifactOpen?artifact:''}</section>
  </main>`;
}
