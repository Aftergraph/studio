import { useState } from 'react';
import { ScrollView, Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { theme } from '../src/theme';
import { compileIntent } from '../src/compose/api';

export default function ComposeScreen(){
  const [roughThought,setRoughThought]=useState('');
  const [status,setStatus]=useState<'idle'|'working'|'error'>('idle');
  const [error,setError]=useState('');

  const improve=async()=>{
    const source=roughThought.trim();
    if(!source)return;
    setStatus('working');
    setError('');
    try{
      const compiled=await compileIntent(source,'auto');
      setStatus('idle');
      Haptics.selectionAsync();
      router.push({pathname:'/compose-result',params:{source,payload:JSON.stringify(compiled),target:'auto'}});
    }catch(err){
      setStatus('error');
      setError(err instanceof Error?err.message:'compile_failed');
    }
  };

  return (
    <View style={{flex:1,backgroundColor:theme.canvas}}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{padding:20,gap:18,paddingBottom:130}}>
        <View style={{gap:7}}>
          <Text selectable style={{fontSize:13,fontWeight:'700',color:theme.accent,letterSpacing:.4}}>AFTERGRAPH COMPOSE</Text>
          <Text selectable style={{fontSize:30,fontWeight:'760',color:theme.text,letterSpacing:-1}}>Write like you think.</Text>
          <Text selectable style={{fontSize:15,lineHeight:22,color:theme.text2}}>Turn an unfinished thought into a clear instruction for the right AI agent.</Text>
        </View>

        <View style={{borderWidth:1,borderColor:theme.border,borderRadius:20,borderCurve:'continuous',backgroundColor:theme.surface,padding:16,gap:12}}>
          <TextInput
            value={roughThought}
            onChangeText={setRoughThought}
            placeholder="Dump the rough thought here…"
            placeholderTextColor={theme.text3}
            multiline
            autoFocus
            textAlignVertical="top"
            style={{minHeight:180,fontSize:18,lineHeight:26,color:theme.text}}
          />
          <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
            <Image source="sf:wand.and.stars" style={{width:18,height:18,tintColor:theme.accent}} />
            <Text selectable style={{flex:1,fontSize:12,color:theme.text3}}>Auto target · authority stays explicit</Text>
          </View>
        </View>

        <Pressable
          disabled={!roughThought.trim()||status==='working'}
          onPress={improve}
          style={{minHeight:56,borderRadius:16,borderCurve:'continuous',backgroundColor:roughThought.trim()?theme.text:theme.border,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:9}}
        >
          <Image source="sf:arrow.up.right" style={{width:17,height:17,tintColor:roughThought.trim()?theme.canvas:theme.text3}} />
          <Text style={{fontSize:16,fontWeight:'720',color:roughThought.trim()?theme.canvas:theme.text3}}>{status==='working'?'Improving…':'Improve'}</Text>
        </Pressable>

        {status==='error'?<View style={{padding:14,borderRadius:14,backgroundColor:theme.surface}}><Text selectable style={{color:theme.danger}}>Couldn’t improve this thought. {error}</Text></View>:null}

      </ScrollView>
    </View>
  );
}
