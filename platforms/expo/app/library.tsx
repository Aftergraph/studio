import { ScrollView, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { theme } from '../src/theme';

export default function LibraryScreen(){
  const files=[['q4_report_draft.md','Document · 24 KB','doc.text'],['revenue_chart.svg','Chart · 18 KB','chart.line.uptrend.xyaxis'],['market_analysis.json','Data · 92 KB','curlybraces'],['release-evidence.json','Evidence · 41 KB','checkmark.shield']];
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{padding:20,gap:0,backgroundColor:theme.canvas}}><View style={{gap:4,marginBottom:24}}><Text selectable style={{fontSize:30,fontWeight:'760',letterSpacing:-1,color:theme.text}}>Library</Text><Text selectable style={{fontSize:12,color:theme.text3}}>Durable output, not chat debris.</Text></View>{files.map(([name,meta,symbol])=><Pressable key={name} onPress={()=>Haptics.selectionAsync()} style={{minHeight:68,borderTopWidth:1,borderTopColor:theme.border,flexDirection:'row',alignItems:'center',gap:12}}><View style={{width:36,height:36,borderRadius:11,borderCurve:'continuous',backgroundColor:'#EAF1FF',alignItems:'center',justifyContent:'center'}}><Image source={`sf:${symbol}`} style={{width:18,height:18,tintColor:theme.accent}}/></View><View style={{flex:1,gap:4}}><Text selectable style={{fontWeight:'650',color:theme.text}}>{name}</Text><Text selectable style={{fontSize:11,color:theme.text3}}>{meta}</Text></View><Image source="sf:chevron.right" style={{width:12,height:12,tintColor:theme.text3}}/></Pressable>)}</ScrollView>
}
