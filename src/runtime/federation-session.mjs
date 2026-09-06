function freeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  for(const child of Object.values(value))freeze(child);
  return Object.freeze(value);
}

const READS=Object.freeze([
  ['integrations','integrations'],
  ['objects','objects'],
  ['now','now'],
  ['capabilities','capabilities'],
]);

export function createFederationSession({client,onChange=()=>{}}={}){
  if(!client)throw new TypeError('federation client required');
  let snapshot=freeze({phase:'idle',complete:false,integrations:[],objects:[],capabilities:[],now:{coverage:{complete:false,unavailable:[]}},errors:[]});

  async function refresh(){
    const settled=await Promise.allSettled(READS.map(([,method])=>client[method]()));
    const next={integrations:[],objects:[],capabilities:[],now:{coverage:{complete:false,unavailable:[]}},errors:[]};
    settled.forEach((result,index)=>{
      const [surface]=READS[index];
      if(result.status==='fulfilled'){
        const value=result.value?.[surface];
        if(surface==='now')next.now=value||next.now;
        else next[surface]=Array.isArray(value)?value:[];
      }else{
        next.errors.push({surface,message:String(result.reason?.message||result.reason||'unavailable')});
      }
    });
    const coverageComplete=next.now?.coverage?.complete!==false;
    next.phase=next.errors.length?'degraded':'current';
    next.complete=next.errors.length===0&&coverageComplete;
    snapshot=freeze(next);
    onChange(snapshot);
    return snapshot;
  }

  return Object.freeze({refresh,snapshot:()=>snapshot});
}
