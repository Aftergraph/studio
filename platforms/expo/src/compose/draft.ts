import Storage from 'expo-sqlite/kv-store';

const DRAFT_KEY='aftergraph.compose.draft.v1';

export async function loadDraft(){
  try{return (await Storage.getItem(DRAFT_KEY))||'';}
  catch{return '';}
}

export async function saveDraft(value:string){
  const next=String(value||'');
  if(!next){await Storage.removeItem(DRAFT_KEY);return;}
  await Storage.setItem(DRAFT_KEY,next);
}

export async function clearDraft(){
  await Storage.removeItem(DRAFT_KEY);
}
