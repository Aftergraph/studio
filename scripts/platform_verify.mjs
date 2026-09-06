import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
function run(label,cmd,args,cwd=root){
  const r=spawnSync(cmd,args,{cwd,encoding:'utf8'});
  if(r.error?.code==='ENOENT'||r.error||r.status===null||(r.stderr&&r.stderr.includes('is not recognized'))){
    console.log(`SKIP ${label} (${cmd} not installed)`);
    return;
  }
  if(r.status!==0){
    console.error(`FAIL ${label}\n${r.stdout}\n${r.stderr}`);
    process.exitCode=1;
  } else {
    console.log(`PASS ${label}`);
  }
}
function check(label,ok){console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)process.exitCode=1}
const expoRoot=path.join(root,'platforms/expo');
run('Expo TypeScript syntax/contracts','tsc',['-p','tsconfig.json'],expoRoot);
const expoFiles=readdirSync(path.join(expoRoot,'app')).filter(x=>x.endsWith('.tsx'));
const expoSource=expoFiles.map(x=>readFileSync(path.join(expoRoot,'app',x),'utf8')).join('\n');
const expoTheme=readFileSync(path.join(expoRoot,'src/theme.ts'),'utf8');
const expoMotion=readFileSync(path.join(expoRoot,'src/motion.ts'),'utf8');
const expoSpace=readFileSync(path.join(expoRoot,'app/space.tsx'),'utf8');
check('Expo exposes Chat/Work/Space primary modes',expoTheme.includes("['Chat', 'Work', 'Space']"));
check('Expo owns a real Space route',expoSource.includes('name="space"')&&expoSpace.includes('Semantic zoom')&&expoSpace.includes('Follow agent'));
check('Expo uses automatic content insets',expoSource.includes('contentInsetAdjustmentBehavior="automatic"'));
check('Expo uses SF Symbols',expoSource.includes('source={`sf:')||expoSource.includes('source="sf:'));
check('Expo uses interaction haptics',expoSource.includes('Haptics.'));
check('Expo shares motion semantics',expoMotion.includes("'surface.expand'")&&expoMotion.includes("'attention.focus'")&&expoMotion.includes('spring'));
check('Expo avoids deprecated SafeAreaView',!expoSource.includes('SafeAreaView'));
check('Expo avoids Dimensions.get',!expoSource.includes('Dimensions.get'));

const swiftDir=path.join(root,'platforms/swiftui/Aftergraph');
const swiftFiles=readdirSync(swiftDir).filter(x=>x.endsWith('.swift')).map(x=>path.join(swiftDir,x));
run('SwiftUI parse','swiftc',['-parse',...swiftFiles]);
const swiftSource=swiftFiles.map(x=>readFileSync(x,'utf8')).join('\n');
const swiftRoot=readFileSync(path.join(swiftDir,'RootView.swift'),'utf8');
const swiftMotion=readFileSync(path.join(swiftDir,'MotionSemantic.swift'),'utf8');
const swiftSpace=readFileSync(path.join(swiftDir,'SpaceView.swift'),'utf8');
check('SwiftUI exposes Chat/Work/Space primary modes',swiftRoot.includes('Label("Chat"')&&swiftRoot.includes('Label("Work"')&&swiftRoot.includes('Label("Space"'));
check('SwiftUI owns a native Space view',swiftSpace.includes('struct SpaceView')&&swiftSpace.includes('Semantic zoom')&&swiftSpace.includes('Follow agent'));
check('SwiftUI uses NavigationStack',swiftSource.includes('NavigationStack'));
check('SwiftUI uses TabView',swiftSource.includes('TabView'));
check('SwiftUI uses native sheets',swiftSource.includes('.sheet('));
check('SwiftUI uses searchable',swiftSource.includes('.searchable('));
check('SwiftUI uses sensory feedback in Space',swiftSpace.includes('sensoryFeedback'));
check('SwiftUI shares motion semantics',swiftMotion.includes('surfaceExpand')&&swiftMotion.includes('attentionFocus')&&swiftMotion.includes('outcomeSettle')&&swiftMotion.includes('.spring('));
if(!process.exitCode)console.log('ALL PLATFORM V5 SOURCE CHECKS PASS');
