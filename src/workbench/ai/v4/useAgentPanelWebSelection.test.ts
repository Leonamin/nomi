import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { describe, expect, it } from 'vitest'
import { createReactTestRenderer } from './testReactRenderer'
function deferred<T>() { let resolve!: (value:T)=>void; let reject!: (error:Error)=>void; const promise=new Promise<T>((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject} }
function fixture() {
  const settings: Array<ReturnType<typeof deferred<{engine:string;model:string}>>> = []
  const models: Array<{engine:unknown;request:ReturnType<typeof deferred<{models:string[]}>>}> = []
  const api={agentSettings:()=>{const d=deferred<{engine:string;model:string}>();settings.push(d);return d.promise},agentModels:(engine:unknown)=>{const request=deferred<{models:string[]}>();models.push({engine,request});return request.promise}}
  const source=readFileSync(new URL('./useAgentPanelV4Data.ts',import.meta.url),'utf8')
  const hooks=source.slice(source.indexOf('  const [webAgentSettings'),source.indexOf('  const skillLabel'))
  const context=vm.createContext({React,getDesktopBridge:()=>({web:api})})
  vm.runInContext(ts.transpileModule(`function Probe({snapshot,activeThreadId,onState}) {${hooks}\nonState({settings:webAgentSettings,models:webAgentModels,visibleModels:visibleWebAgentModels,providers:webAgentProviders,provider:webAgentProvider,select:applyWebAgentSelection,reload:loadWebAgentModels});return null;}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context)
  const renderer=createReactTestRenderer();let state!: {settings?:{engine:string;model:string};models:string[];visibleModels:string[];providers:string[];provider:string;select:(selection:{engine:string})=>void;reload:()=>void}
  const render=(workspace='A')=>{renderer.render(React.createElement(context.Probe,{snapshot:{workspaceId:workspace,active:{running:false}},activeThreadId:'thread',onState:(value:typeof state)=>{state=value}}));renderer.flushPassiveEffects()}
  const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();renderer.flushPassiveEffects()}
  return{settings,models,state:()=>state,render,settle,close:()=>renderer.close()}
}
describe('native model discovery identity in the actual panel hook',()=>{
  it('switches discovery to the returned engine and rejects late previous-engine results',async()=>{
    const f=fixture();f.render()
    try{
      f.settings[0].resolve({engine:'opencode',model:'provider/model'});await f.settle()
      const old=f.models[0];f.state().select({engine:'codex'});await f.settle()
      f.settings[1].resolve({engine:'codex',model:'gpt-current'});await f.settle()
      expect(f.models.at(-1)?.engine).toBe('codex')
      f.models.at(-1)!.request.resolve({models:['gpt-current']});await f.settle()
      old.request.resolve({models:['provider/old']});await f.settle()
      expect(f.state().models).toEqual(['gpt-current'])
      expect(f.state().settings?.engine).toBe('codex')
    }finally{f.close()}
  })
  it('does not settle an old workspace settings request into the replacement workspace',async()=>{
    const f=fixture();f.render('A');f.render('B')
    try{
      f.settings[1].resolve({engine:'codex',model:'gpt-new'});await f.settle()
      f.settings[0].resolve({engine:'opencode',model:'provider/old'});await f.settle()
      expect(f.state().settings?.engine).toBe('codex')
      expect(f.models.at(-1)?.engine).toBe('codex')
    }finally{f.close()}
  })
})

describe('model IDs without provider namespaces',()=>{
  it('keeps the selected native Codex model visible without inventing a provider namespace',async()=>{
    const f=fixture();f.render()
    try{
      f.settings[0].resolve({engine:'codex',model:'gpt-current'});await f.settle()
      f.models[0].request.resolve({models:['gpt-current','gpt-other']});await f.settle()
      expect(f.state().visibleModels).toEqual(['gpt-current','gpt-other'])
      expect(f.state().providers).toEqual([])
    }finally{f.close()}
  })
})

it('preserves qualified native model provider filtering after a selection settles',async()=>{
 const f=fixture();f.render();try{f.settings[0].resolve({engine:'opencode',model:'provider/current'});await f.settle();f.models[0].request.resolve({models:['provider/current','provider/other','another/model']});await f.settle();expect(f.state().visibleModels).toEqual(['provider/current','provider/other']);expect(f.state().providers).toEqual(['another','provider'])}finally{f.close()}
});
