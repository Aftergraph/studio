declare module 'react' { export function useState<T>(value:T): [T,(value:T)=>void]; }
declare module 'react-native' { export const ScrollView:any; export const Pressable:any; export const Text:any; export const TextInput:any; export const View:any; export const Share:{share(input:{message:string}):Promise<any>}; }
declare module 'expo-router' { export const Tabs:any; export const router:{push(input:any):void}; export function useLocalSearchParams<T=Record<string,string|undefined>>():T; }
declare module 'expo-image' { export const Image:any; }
declare module 'expo-haptics' { export const ImpactFeedbackStyle:any; export function selectionAsync():Promise<void>; export function impactAsync(style:any):Promise<void>; }
declare namespace JSX { interface IntrinsicElements { [elemName:string]: any } }
declare module 'react/jsx-runtime' { export const jsx:any; export const jsxs:any; export const Fragment:any; }
