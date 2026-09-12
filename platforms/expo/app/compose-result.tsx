import { useState } from 'react';
import { ScrollView, Pressable, Share, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { theme } from '../src/theme';
import { compileIntent } from '../src/compose/api';
import type { CompileResponse, ComposeTarget } from '../src/compose/types';

const targets:{id:ComposeTarget;label:string}[]=[
  {id:'auto',label:'Auto'},
  {id:'friday.chatgpt',label:'Friday'},
  {id:'openai.codex',label:'Codex'},
  {id:'anthropic.claude-code',label:'Claude'},
  {id:'aftergraph.hermes',label:'Hermes'},
  {id:'generic',label:'Generic'},
];
const refinements=[
  ['clearer','Clearer'],['more-autonomous','More autonomous'],['safer','Safer'],
  ['more-detailed','More detailed'],['shorter','Shorter'],['execution-ready','Execution-ready'],
] as const;

export default function ComposeResultScreen(){
  const params=useLocalSearchParams<{source?:string;payload?:string;target?:string}>();
  const source=String(params.source||'');
  const initial=(()=>{try{return JSON.parse(String(params.payload||'')) as CompileResponse}catch{return null}})();
  const [result,setResult]=useState<CompileResponse|null>(initial);
  const [target,setTarget]=useState<ComposeTarget>((params.target as ComposeTarget)||'auto');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const recompile=async(nextTarget:ComposeTarget,refinement?:string)=>{
    if(!source||busy)return;
    setBusy(true);setError('');
    try{
      const next=await compileIntent(source,nextTarget,refinement);
      setResult(next);setTarget(nextTarget);
      Haptics.selectionAsync();
    }catch(err){setError(err instanceof Error?err.message:'compile_failed')}
    finally{setBusy(false)}
  };
  const copy=async()=>{
    if(!result)return;
    await Clipboard.setStringAsync(result.artifact.content);
    Haptics.selectionAsync();
  };
  const share=async()=>{if(result)await Share.share({message:result.artifact.content})};

  return (
    <View style={{flex:1,backgroundColor:theme.canvas}}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{padding:20,gap:22,paddingBottom:72}}>
        <View style={{gap:6}}>
          <Text selectable style={{fontSize:12,fontWeight:'700',color:theme.accent,letterSpacing:.5}}>AFTERGRAPH COMPOSE · BY AFTERGRAPH</Text>
          <Text selectable style={{fontSize:12,fontWeight:'700',color:theme.text3}}>Understood as</Text>
          <Text selectable style={{fontSize:27,fontWeight:'760',color:theme.text,letterSpacing:-.8}}>{result?.ir.goal.statement||'No result available'}</Text>
        </View>

        <View style={{gap:9}}>
          <Text selectable style={{fontSize:12,fontWeight:'700',color:theme.text3}}>TARGET</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
            {targets.map(item=><Pressable key={item.id} disabled={busy} onPress={()=>recompile(item.id)} style={{paddingHorizontal:12,paddingVertical:9,borderRadius:999,borderWidth:1,borderColor:item.id===target?theme.text:theme.border,backgroundColor:item.id===target?theme.text:theme.canvas}}><Text style={{fontSize:12,fontWeight:'650',color:item.id===target?theme.canvas:theme.text2}}>{item.label}</Text></Pressable>)}
          </View>
        </View>

        <View style={{gap:10}}>
          <Text selectable style={{fontSize:12,fontWeight:'700',color:theme.text3}}>AGENT-READY INSTRUCTION</Text>
          <View style={{borderWidth:1,borderColor:theme.border,borderRadius:18,borderCurve:'continuous',backgroundColor:theme.surface,padding:17}}>
            <Text selectable style={{fontSize:15,lineHeight:23,color:theme.text}}>{result?.artifact.content||'Compile the thought again to restore the result.'}</Text>
          </View>
        </View>

        <View style={{gap:9}}>
          <Text selectable style={{fontSize:12,fontWeight:'700',color:theme.text3}}>REFINE</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
            {refinements.map(([id,label])=><Pressable key={id} disabled={busy||!result} onPress={()=>recompile(target,id)} style={{paddingHorizontal:12,paddingVertical:9,borderRadius:12,borderWidth:1,borderColor:theme.border,backgroundColor:theme.canvas}}><Text style={{fontSize:12,fontWeight:'620',color:theme.text2}}>{label}</Text></Pressable>)}
          </View>
        </View>

        {error?<Text selectable accessibilityLabel="Compose result error" style={{color:theme.danger}}>{error}</Text>:null}
        <View style={{flexDirection:'row',gap:10}}>
          <Pressable disabled={!result} onPress={copy} style={{flex:1,minHeight:50,borderRadius:14,borderWidth:1,borderColor:theme.border,alignItems:'center',justifyContent:'center'}}><Text style={{fontWeight:'700',color:theme.text}}>Copy</Text></Pressable>
          <Pressable disabled={!result} onPress={share} style={{flex:1,minHeight:50,borderRadius:14,backgroundColor:theme.text,alignItems:'center',justifyContent:'center'}}><Text style={{fontWeight:'700',color:theme.canvas}}>Share</Text></Pressable>
        </View>
        <Text selectable style={{fontSize:11,lineHeight:17,color:theme.text3}}>Compose prepares the instruction only. It does not execute or install anything in v0.1.</Text>
      </ScrollView>
    </View>
  );
}
