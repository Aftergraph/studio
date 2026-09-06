import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const expoMotion=await readFile(new URL('../platforms/expo/src/motion.ts',import.meta.url),'utf8').catch(()=> '');
const swiftMotion=await readFile(new URL('../platforms/swiftui/Aftergraph/MotionSemantic.swift',import.meta.url),'utf8').catch(()=> '');

test('Expo shares living-interface motion semantics',()=>{
  for(const name of ['surface.expand','trajectory.advance','attention.focus','outcome.settle']) assert.match(expoMotion,new RegExp(name.replace('.','\\.')));
  assert.match(expoMotion,/spring/);
});

test('SwiftUI shares living-interface motion semantics',()=>{
  for(const name of ['surfaceExpand','trajectoryAdvance','attentionFocus','outcomeSettle']) assert.match(swiftMotion,new RegExp(name));
  assert.match(swiftMotion,/spring/);
});
