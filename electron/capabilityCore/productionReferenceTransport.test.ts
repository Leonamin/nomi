import { beforeEach, expect, it, vi } from 'vitest';
const fixture=vi.hoisted(()=>({strategy:'comfyui-upload',receipts:[] as unknown[],uploads:[] as string[],identity:{contentHash:'hash',version:1}}));
vi.mock('../catalog/catalogStore',()=>({readCatalog:()=>({vendors:[{key:'provider'}],models:[],apiKeysByVendor:{}})}));
vi.mock('../catalog/assetTransportRuntime',()=>({assetLocalizationOptions:()=>({}),assetIngestionResolver:()=>()=>[{ingestion:{strategy:fixture.strategy,endpoint:'http://127.0.0.1:8188/base/upload/image',accepts:['image'],urlPath:'url',visibility:'public-provider',ttlSeconds:86400},uploadApiKey:''}]}));
vi.mock('../assets/localAssetFile',()=>({readNomiLocalAsset:(url:string)=>({bytes:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'),contentType:'image/png',fileName:url.split('/').at(-1)}),postMultipartForAssetUpload:async(_url:string,_headers:unknown,_bytes:unknown,name:string)=>{fixture.uploads.push(name);return fixture.receipts.shift()},postJsonForAssetUpload:vi.fn(),putBinaryForAssetUpload:vi.fn()}));
vi.mock('./pendingSpendReferences',()=>({projectSpendReferenceAssets:{list:()=>['first','last'].map(id=>({id,data:{url:`nomi-local://asset/p/${id}.png`,contentType:'image/png'}})),identity:()=>fixture.identity}}));
import {resolveProductionReferenceUrls} from './productionReferenceUrls';
import {spendReferenceKey} from '../shared/contracts/pendingSpendConfirm';
const reference=(assetId='first',role:'first_frame'|'last_frame'='first_frame')=>({assetId,contentHash:'hash',version:1,kind:'image' as const,role});
const resolve=(references=[reference()])=>resolveProductionReferenceUrls({projectId:'p',providerId:'provider',references,assertCurrent(){}});
beforeEach(()=>{fixture.strategy='comfyui-upload';fixture.receipts=[];fixture.uploads=[];fixture.identity={contentHash:'hash',version:1}});
it('seals same-asset first/last frames with one actual upload and two role identities',async()=>{
 fixture.receipts=[{name:'uploaded.png',subfolder:'refs',type:'input'}];const refs=[reference(),reference('first','last_frame')];const result=await resolve(refs);
 expect(fixture.uploads).toEqual([expect.stringMatching(/^nomi-reference-[a-f0-9]{64}\.png$/)]);expect(result[spendReferenceKey(refs[0])]).toBe('http://127.0.0.1:8188/base/view?filename=uploaded.png&subfolder=refs&type=input');expect(result[spendReferenceKey(refs[1])]).toBe(result[spendReferenceKey(refs[0])]);
});
it('keeps distinct uploaded first/last asset receipts separate',async()=>{
 fixture.receipts=[{name:'first.png',subfolder:'',type:'input'},{name:'last.png',subfolder:'',type:'input'}];const refs=[reference(),reference('last','last_frame')];const result=await resolve(refs);expect(fixture.uploads).toHaveLength(2);expect(new URL(result[spendReferenceKey(refs[0])]).searchParams.get('filename')).toBe('first.png');expect(new URL(result[spendReferenceKey(refs[1])]).searchParams.get('filename')).toBe('last.png');
});
it('preserves generic provider HTTP transport outputs',async()=>{fixture.strategy='upload-multipart';fixture.receipts=[{url:'https://cdn.example/reference.png'}];expect(await resolve()).toEqual({[spendReferenceKey(reference())]:'https://cdn.example/reference.png'})});
it.each([{name:'../escape.png',subfolder:'',type:'input'},{name:'ref.png',subfolder:'../escape',type:'input'},{name:'ref.png',subfolder:'',type:'output'}])('rejects malformed or wrong-scope input upload receipts before sealing',async receipt=>{fixture.receipts=[receipt];await expect(resolve()).rejects.toThrow()});

it('keeps benign double dots in an uploaded basename while rejecting path segments',async()=>{fixture.receipts=[{name:'image..png',subfolder:'refs',type:'input'}];const result=await resolve();expect(new URL(result[spendReferenceKey(reference())]).searchParams.get('filename')).toBe('image..png')});
