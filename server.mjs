import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createAppServer as createWorkspaceAppServer, upstreamConfigFromEnv } from './server/app-server.mjs';
import { createIntentCompileHandler } from './server/intent-routes.mjs';
import { createHermesIntentProvider } from './server/intent-provider.mjs';
import { authSecretFromEnv, subjectFromAuthHeader } from './src/auth/magic-link.mjs';
import { sendJson } from './server/http-utils.mjs';

export { upstreamConfigFromEnv };

export function createAppServer(options={}) {
  const { intentProvider=null, ...workspaceOptions }=options;
  const server=createWorkspaceAppServer(workspaceOptions);
  const baseHandlers=server.listeners('request');
  const compileHandler=createIntentCompileHandler({provider:intentProvider || createHermesIntentProvider()});
  const requireAuth=workspaceOptions.requireAuth ?? process.env.AFTERGRAPH_REQUIRE_AUTH === 'true';
  const secret=workspaceOptions.authSecret || authSecretFromEnv();

  server.removeAllListeners('request');
  server.on('request',async(req,res)=>{
    const url=new URL(req.url || '/', 'http://127.0.0.1');
    if(url.pathname==='/api/v1/intent/compile'){
      if(requireAuth && !subjectFromAuthHeader(req,{secret})){
        sendJson(res,401,{error:'authentication_required'});
        return;
      }
      if(await compileHandler(req,res,url))return;
    }
    for(const handler of baseHandlers)handler(req,res);
  });
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const root=path.dirname(fileURLToPath(import.meta.url));
  const port=Number(process.env.PORT||8000);
  const host=process.env.HOST||'127.0.0.1';
  const stateFile=process.env.AFTERGRAPH_STATE_FILE||path.join(root,'.runtime','workspace-state.json');
  const runtimeIntervalMs=Number(process.env.AFTERGRAPH_RUNTIME_INTERVAL_MS||1250);
  const server=createAppServer({root,stateFile,runtimeIntervalMs,fixtures:process.env.AFTERGRAPH_DEMO_FIXTURES==='true'});
  server.listen(port,host,()=>{
    console.log(`Aftergraph Workspace v5 reference app: http://${host}:${port}`);
    if(server.workspace.bootToken)console.log(`Operator boot token (valid 24h, AFTERGRAPH_AUTH_SECRET): ${server.workspace.bootToken}`);
  });
}
