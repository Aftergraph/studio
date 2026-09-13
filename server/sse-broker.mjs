export function createSSEBroker({version}={}){
  const clients=new Set();let sequence=0;
  // ponytail: track last broadcast time for throttling
  let lastBroadcastTime=0;
  const MIN_BROADCAST_INTERVAL_MS=10; // ~100 broadcasts/sec max
  const encode=payload=>`id: ${++sequence}\nevent: workspace\ndata: ${JSON.stringify({version,...payload})}\n\n`;
  return Object.freeze({
    attach(req,res,initialPayload){res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','connection':'keep-alive','x-content-type-options':'nosniff'});res.write(`event: workspace\ndata: ${JSON.stringify({version,...initialPayload})}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));},
    broadcast(payload){const now=Date.now();const elapsed=now-lastBroadcastTime;if(elapsed<MIN_BROADCAST_INTERVAL_MS)return;lastBroadcastTime=now;const message=encode(payload);for(const client of clients){try{client.write(message)}catch{clients.delete(client)}}},
    closeAll(){for(const client of clients){try{client.end()}catch{}}clients.clear()},
    clientCount(){return clients.size},
    sequence(){return sequence},
  });
}
