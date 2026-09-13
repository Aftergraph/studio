export function createSSEBroker({version}={}){
  const clients=new Set();let sequence=0;
  // ponytail: track last broadcast time for throttling
  let lastBroadcastTime=0;
  const MIN_BROADCAST_INTERVAL_MS=10; // ~100 broadcasts/sec max
  // ponytail: batch multiple broadcasts into a single flush to prevent storms
  let pendingPayload=null;
  let flushScheduled=false;
  const encode=payload=>`id: ${++sequence}\nevent: workspace\ndata: ${JSON.stringify({version,...payload})}\n\n`;
  function scheduleFlush(){
    if(flushScheduled)return;
    flushScheduled=true;
    queueMicrotask(flush);
  }
  function flush(){
    flushScheduled=false;
    if(!pendingPayload)return;
    const payload=pendingPayload;
    pendingPayload=null;
    const now=Date.now();
    const elapsed=now-lastBroadcastTime;
    if(elapsed<MIN_BROADCAST_INTERVAL_MS){
      // reschedule for after throttle window
      setTimeout(flush,MIN_BROADCAST_INTERVAL_MS-elapsed);
      return;
    }
    lastBroadcastTime=now;
    const message=encode(payload);
    for(const client of clients){
      try{client.write(message)}catch{clients.delete(client)}
    }
  }
  return Object.freeze({
    attach(req,res,initialPayload){res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','connection':'keep-alive','x-content-type-options':'nosniff'});res.write(`event: workspace\ndata: ${JSON.stringify({version,...initialPayload})}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));},
    // ponytail: batch broadcasts - coalesce rapid calls into single flush
    broadcast(payload){
      pendingPayload=payload; // latest payload wins (coalescing)
      scheduleFlush();
    },
    closeAll(){for(const client of clients){try{client.end()}catch{}}clients.clear()},
    clientCount(){return clients.size},
    sequence(){return sequence},
  });
}
