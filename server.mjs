import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createAppServer as createWorkspaceAppServer, upstreamConfigFromEnv } from './server/app-server.mjs';
import { decorateBillingServer } from './server/billing-server.mjs';
import { billingDeliveryAdapterFromEnv } from './server/billing-delivery.mjs';

export function createAppServer(options = {}) {
  const billingOptions = Object.prototype.hasOwnProperty.call(options, 'billingDeliveryAdapter')
    ? options
    : { ...options, billingDeliveryAdapter: billingDeliveryAdapterFromEnv() };
  return decorateBillingServer(createWorkspaceAppServer(options), billingOptions);
}

export { upstreamConfigFromEnv };

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const root=path.dirname(fileURLToPath(import.meta.url));
  const port=Number(process.env.PORT||8000);
  const host=process.env.HOST||'127.0.0.1';
  const stateFile=process.env.AFTERGRAPH_STATE_FILE||path.join(root,'.runtime','workspace-state.json');
  const runtimeIntervalMs=Number(process.env.AFTERGRAPH_RUNTIME_INTERVAL_MS||1250);
  const server=createAppServer({root,stateFile,runtimeIntervalMs,releaseSha:process.env.AFTERGRAPH_RELEASE_SHA||'unknown',fixtures:process.env.AFTERGRAPH_DEMO_FIXTURES==='true'});
  server.listen(port,host,()=>{
    console.log(`Aftergraph Workspace v5 reference app: http://${host}:${port}`);
    if (server.workspace.bootToken) {
      console.log('Authentication enabled; use `npm run auth:bootstrap-token` from a trusted operator shell.');
    }
  });
  let shuttingDown = false;
  const shutdown = signal => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; draining state before shutdown.`);
    server.close(error => {
      if (error) {
        console.error(`Shutdown failed: ${error.message}`);
        process.exitCode = 1;
      }
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}
