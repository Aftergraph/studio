import { ScrollView, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { theme } from '../src/theme';

export default function WorkScreen() {
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{padding:20,gap:24,backgroundColor:theme.canvas}}>
    <View style={{gap:4}}><Text selectable style={{fontSize:30,fontWeight:'760',letterSpacing:-1,color:theme.text}}>Work</Text><Text selectable style={{fontSize:12,color:theme.text3}}>Mission state, progress, evidence and control.</Text></View>
    {[['Build Q4 business report','65%','Data Analysis Agent'],['Deploy production release','92%','Needs approval'],['Research competitor landscape','78%','Research Agent']].map(([title,progress,meta])=><Pressable key={title} onPress={()=>Haptics.selectionAsync()} style={{minHeight:76,borderTopWidth:1,borderTopColor:theme.border,flexDirection:'row',alignItems:'center',gap:12}}><View style={{width:36,height:36,borderRadius:11,borderCurve:'continuous',backgroundColor:meta==='Needs approval'?'#FFF5DF':theme.surface,alignItems:'center',justifyContent:'center'}}><Image source={`sf:${meta==='Needs approval'?'exclamationmark.shield':'briefcase'}`} style={{width:18,height:18,tintColor:meta==='Needs approval'?theme.warning:theme.text2}}/></View><View style={{flex:1,gap:4}}><Text selectable style={{fontWeight:'670',color:theme.text}}>{title}</Text><Text selectable style={{fontSize:11,color:theme.text3}}>{meta}</Text></View><Text selectable style={{fontSize:12,color:theme.text3,fontVariant:['tabular-nums']}}>{progress}</Text></Pressable>)}
  </ScrollView>;
}
