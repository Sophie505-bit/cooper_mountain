import test from 'node:test';
import assert from 'node:assert/strict';
import {decisionStage,decisionBlock} from '../src/decisions.js';
import {DEFAULT_CONFIG,POLICIES,simulate} from '../src/engine.js';
test('handoff survives staffing changes; approval follows the exact plan',()=>{
 const config=structuredClone(DEFAULT_CONFIG),policy=POLICIES[0];
 const entry={stage:3,fingerprint:JSON.stringify([config,policy.id,true])};
 assert.equal(decisionStage(entry,config,policy,true),3);
 config.staff[3]++;
 assert.equal(decisionStage(entry,config,policy,true),1);
 config.orders[0].quantity+=1000;
 assert.equal(decisionStage(entry,config,policy,true),0);
});
test('a proposal requires the supervisor, a locked request and completed mandatory work',()=>{
 const ok={remainingWorks:[]};
 assert.ok(decisionBlock(1,'Планер',true,ok));
 assert.ok(decisionBlock(1,'Начальник участка',false,ok));
 assert.ok(decisionBlock(1,'Начальник участка',true,{remainingWorks:[{id:'ТО-1'}]}));
 assert.equal(decisionBlock(1,'Начальник участка',true,ok),'');
});
test('used and unused person-hours exhaust actual shift capacity after both incidents',()=>{
 const c={...DEFAULT_CONFIG,events:2};
 simulate(c).shiftStats.forEach((s,i)=>assert.ok(Math.abs(s.labor+s.idle-Math.max(0,c.staff[i]-(i===1?2:0))*10.5)<.001));
});
