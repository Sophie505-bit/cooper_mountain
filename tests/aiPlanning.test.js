import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CONFIG,POLICIES,simulate} from '../src/engine.js';
import {validateProposal,evaluateProposals} from '../src/aiPlanning.js';
import {createAiServer} from '../server/aiServer.mjs';
const proposal=(patch={})=>({policyId:'balanced',offset:0,starts:[],reason:'Проверка',...patch});
test('model cannot change staff, orders, machines or events through extra fields',()=>{
 const c=structuredClone(DEFAULT_CONFIG),reference=simulate(c);const result=validateProposal(c,proposal({staff:[99,99,99,99],events:2,maintenanceMachines:{'ТО-1':'press-5'}}),reference);
 assert.deepEqual(result.staff,c.staff);assert.deepEqual(result.orders,c.orders);assert.equal(result.events,c.events);assert.equal(result.maintenanceMachines,undefined);assert.deepEqual(c,DEFAULT_CONFIG);
});
test('invalid model work IDs, windows, policies, duplicates and frozen works are rejected',()=>{
 const c=structuredClone(DEFAULT_CONFIG),r=simulate(c);
 for(const p of [proposal({policyId:'invented'}),proposal({offset:121}),proposal({starts:[{id:'ТО-1',at:700}]}),proposal({starts:[{id:'x',at:0}]}),proposal({starts:[{id:'ТО-1',at:0},{id:'ТО-1',at:30}]})])assert.throws(()=>validateProposal(c,p,r));
 const incident={...c,events:1,baselinePolicy:'balanced',baselineOffset:0},ir=simulate(incident);assert.throws(()=>validateProposal(incident,proposal({starts:[{id:'ТО-1',at:120}]}),ir),/начатую/);
});
test('AI proposals use real simulation, deduplicate and cannot worsen ordinary search',()=>{
 const c={...structuredClone(DEFAULT_CONFIG),staff:[32,32,32,32]};const result=evaluateProposals(c,[proposal(),proposal(),proposal({policyId:'people',offset:120}),proposal({offset:999})]);
 assert.ok(result.accepted<=2);assert.ok(result.rejected.length>=1);assert.ok(result.best.feasible);const actual=simulate(result.best.config,result.best.policy);assert.equal(actual.total,result.best.total);assert.equal(actual.missed,result.best.missed);assert.equal(c.staff[0],32);
 if(!result.improved)assert.deepEqual(result.best.timeline,result.baseline.timeline);
});
test('replanning with AI cannot rewrite the executed prefix',()=>{
 const c={...structuredClone(DEFAULT_CONFIG),events:1,baselinePolicy:'balanced',baselineOffset:0};const r=evaluateProposals(c,[proposal({policyId:'people',offset:60,starts:[{id:'ТО-5',at:1500}]})]);
 const before=simulate(c,POLICIES[0]);for(const e of before.epochs.filter(e=>e.end<=120)){const match=r.best.epochs.find(x=>x.start===e.start);assert.deepEqual(match.final,e.final);}
});
async function serve(options,fn){const server=createAiServer(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{await fn('http://127.0.0.1:'+server.address().port);}finally{await new Promise(resolve=>server.close(resolve));}}
test('missing credentials are explicit and cross-origin requests are rejected',async()=>serve({env:{}},async base=>{
 assert.equal((await (await fetch(base+'/api/ai/status')).json()).connected,false);
 const r=await fetch(base+'/api/ai/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,503);
 assert.equal((await fetch(base+'/api/ai/status',{headers:{Origin:'https://unrelated.example'}})).status,403);
}));
test('provider adapter forwards scenario, hides credentials and returns structured proposals',async()=>{
 let sent;await serve({env:{AI_API_KEY:'test-only-secret',AI_MODEL:'test-model'},fetchImpl:async(url,init)=>{sent={url,body:JSON.parse(init.body)};assert.equal(init.headers.Authorization,'Bearer test-only-secret');return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({proposals:[proposal()]})}}]}));}},async base=>{
 const r=await fetch(base+'/api/ai/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({config:DEFAULT_CONFIG,goal:'Сохранить сроки'})});const body=await r.text();assert.equal(r.status,200);assert.ok(!body.includes('test-only-secret'));assert.equal(JSON.parse(body).proposals.length,1);assert.ok(sent.body.messages[1].content.includes('frozen'));assert.equal(sent.body.store,false);
 });
});
