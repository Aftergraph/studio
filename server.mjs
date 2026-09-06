import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createAppServer, upstreamConfigFromEnv } from './server/app-server.mjs';

export { createAppServer, upstreamConfigFromEnv };

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const root=path.dirname(fileURLToPath(import.meta.url));
  const port=Number(process.env.PORT||8000);
  const host=process.env.HOST||'127.0.0.1';
  const stateFile=process.env.AFTERGRAPH_STATE_FILE||path.join(root,'.runtime','workspace-state.json');
  const runtimeIntervalMs=Number(process.env.AFTERGRAPH_RUNTIME_INTERVAL_MS||1250);
  const server=createAppServer({root,stateFile,runtimeIntervalMs});
  server.listen(port,host,()=>console.log(`Aftergraph Workspace v5 reference app: http://${host}:${port}`));
}
