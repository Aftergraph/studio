import Storage from 'expo-sqlite/kv-store';
import type { CompileResponse, ComposeTarget } from './types';

const HISTORY_KEY='aftergraph.compose.recents.v1';

export type CompositionRecord={
  id:string;
  createdAt:string;
  source:string;
  target:ComposeTarget;
  interpretedGoal:string;
  output:string;
  refinement?:string|null;
  result:CompileResponse;
};

async function readRecords():Promise<CompositionRecord[]>{
  try{
    const raw=await Storage.getItem(HISTORY_KEY);
    const parsed=raw?JSON.parse(raw):[];
    return Array.isArray(parsed)?parsed:[];
  }catch{return [];}
}
export async function listRecentCompositions(){
  return readRecords();
}

export async function saveComposition(record:CompositionRecord){
  const current=await readRecords();
  const next=[record,...current.filter(item=>item.id!==record.id)].slice(0,50);
  await Storage.setItem(HISTORY_KEY,JSON.stringify(next));
}

export async function deleteComposition(id:string){
  const current=await readRecords();
  await Storage.setItem(HISTORY_KEY,JSON.stringify(current.filter(item=>item.id!==id)));
}

export async function getComposition(id:string){
  const current=await readRecords();
  return current.find(item=>item.id===id)||null;
}
