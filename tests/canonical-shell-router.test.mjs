import test from 'node:test';
import assert from 'node:assert/strict';
import { appBasePath, withAppBase, routeFromLocation } from '../src/router.mjs';

test('Studio base path is detected without affecting local routes',()=>{
  assert.equal(appBasePath({pathname:'/chat'}),'');
  assert.equal(appBasePath({pathname:'/studio/chat'}),'/studio');
  assert.equal(withAppBase('/work',{pathname:'/studio/chat'}),'/studio/work');
  assert.equal(withAppBase('/space',{pathname:'/chat'}),'/space');
  assert.equal(appBasePath('/studio'),'/studio');
  assert.equal(withAppBase('/space','/studio'),'/studio/space');
});

test('local and /studio primary routes resolve identically',()=>{
  for(const [path,expected] of [
    ['/chat',{kind:'mode',mode:'chat',domain:'chat'}],
    ['/work',{kind:'mode',mode:'work',domain:'work'}],
    ['/space',{kind:'mode',mode:'space',domain:'work'}],
  ]){
    assert.deepEqual(routeFromLocation({pathname:path}),expected);
    assert.deepEqual(routeFromLocation({pathname:`/studio${path}`}),expected);
  }
});

test('canonical contextual routes stay inside the Studio shell',()=>{
  const expected={
    projects:{kind:'surface',surface:'projects',domain:'work'},
    plugins:{kind:'surface',surface:'plugins',domain:'connect'},
    remote:{kind:'surface',surface:'remote',domain:'connect'},
    settings:{kind:'surface',surface:'settings',domain:'system'},
    billing:{kind:'surface',surface:'billing',domain:'work'},
  };
  for(const [surface,route] of Object.entries(expected)){
    assert.deepEqual(routeFromLocation({pathname:`/${surface}`}),route);
    assert.deepEqual(routeFromLocation({pathname:`/studio/${surface}`}),route);
  }
});

test('typed object deep links survive the Studio base prefix',()=>{
  assert.deepEqual(routeFromLocation({pathname:'/studio/d/CONTROL/o/approval/apr_42'}),{
    kind:'object',domain:'control',type:'approval',id:'apr_42',
  });
});
