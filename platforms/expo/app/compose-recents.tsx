import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../src/theme';
import {
  deleteComposition,
  listRecentCompositions,
  type CompositionRecord,
} from '../src/compose/history';

export default function ComposeRecentsScreen(){
  const [items,setItems]=useState<CompositionRecord[]>([]);

  const reload=()=>listRecentCompositions().then(setItems);
  useEffect(()=>{void reload();},[]);

  const open=(item:CompositionRecord)=>{
    router.push({
      pathname:'/compose-result',
      params:{source:item.source,payload:JSON.stringify(item.result),target:item.target,recordId:item.id},
    });
  };

  const remove=(item:CompositionRecord)=>{
    Alert.alert('Delete composition?','This only removes the local Compose history item.',[
      {text:'Cancel',style:'cancel'},
      {text:'Delete',style:'destructive',onPress:async()=>{await deleteComposition(item.id);await reload();}},
    ]);
  };

  return (
    <View style={{flex:1,backgroundColor:theme.canvas}}>
      <FlatList
        data={items}
        keyExtractor={item=>item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{padding:20,gap:10,paddingBottom:60}}
        ListHeaderComponent={<View style={{gap:5,marginBottom:12}}><Text style={{fontSize:28,fontWeight:'760',color:theme.text}}>Recents</Text><Text style={{color:theme.text3}}>Your latest Compose instructions, stored only on this device.</Text></View>}
        ListEmptyComponent={<Text selectable style={{color:theme.text3}}>No successful compositions yet.</Text>}
        renderItem={({item})=>(
          <View style={{borderWidth:1,borderColor:theme.border,borderRadius:16,backgroundColor:theme.surface,padding:14,gap:8}}>
            <Pressable onPress={()=>open(item)} accessibilityRole="button" style={{gap:5}}>
              <Text numberOfLines={2} style={{fontSize:15,fontWeight:'700',color:theme.text}}>{item.interpretedGoal}</Text>
              <Text numberOfLines={2} style={{fontSize:13,lineHeight:19,color:theme.text2}}>{item.source}</Text>
              <Text style={{fontSize:11,color:theme.text3}}>{item.target} · {new Date(item.createdAt).toLocaleString()}</Text>
            </Pressable>
            <Pressable onPress={()=>remove(item)} accessibilityRole="button">
              <Text style={{fontSize:12,fontWeight:'650',color:theme.danger}}>Delete</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
