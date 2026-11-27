import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate,optimize,DEFAULT_CONFIG,WORKS,MACHINES,POLICIES,captureWorkPlan,workIsFrozen,stateAt,validateConfig,workMinutes} from '../src/engine.js';
import {appendDecision} from '../src/versions.js';
import {exportScenario,previousPlan,intervalLabel} from '../src/passport.js';
const base=()=>structuredClone(DEFAULT_CONFIG);
const near=(a,b)=>assert.ok(Math.abs(a-b)<.001,`${a} != ${b}`);
test('short peak intervals display seconds rather than two identical rounded minutes',()=>{
 assert.equal(intervalLabel(1559.686274509804,1559.824534942182),'D+2 09:59:41 — D+2 09:59:49');
});

test('validation cannot accumulate 180 minutes across B, V and A campaigns',()=>{
 const r=simulate({...base(),workStarts:{'ВАЛ-2b':600}});
 const v=r.vals.find(w=>w.id==='ВАЛ-2b');
 assert.equal(r.feasible,false);assert.ok(v.interruptedAt>600);assert.ok(v.left>100);
 assert.match(v.interruptionReason,/продукта/);
 const segments=r.timeline[v.machine].filter(s=>s.validation===v.id);
 assert.ok(segments.every(s=>s.end<=v.interruptedAt+.001));
 near(segments.reduce((sum,s)=>sum+workMinutes(s.start,s.end),0),v.duration-v.left);
});

test('completed validations remain continuous except for calendar breaks',()=>{
 for(const events of [0,1,2])for(const policy of POLICIES){
  const r=simulate({...base(),events},policy);
  for(const v of r.vals.filter(w=>w.left<.00001)){
   const segments=r.timeline[v.machine].filter(s=>s.validation===v.id);
   const first=segments[0].start,last=segments.at(-1).end;
   near(workMinutes(first,last),v.duration);
   for(const s of r.timeline[v.machine].filter(s=>s.start>=first&&s.end<=last&&s.status!=='break')){
    assert.equal(s.validation,v.id);assert.equal(s.product,v.product);assert.equal(s.status,'running');
   }
  }
 }
});

test('future maintenance and validation can move after a repair; past remains identical',()=>{
 const original=base(),before=simulate(original);
 const c={...original,events:1,baselinePolicy:'balanced',baselineOffset:0,...captureWorkPlan(original,'baseline'),workStarts:{'ТО-3':1800,'ВАЛ-3':1800},maintenanceMachines:{'ТО-3':'heat-3'}};
 const r=simulate(c);
 for(const t of [0,50,100,119])for(const m of MACHINES){const a=stateAt(before,t)[m.id],b=stateAt(r,t)[m.id];assert.equal(a.status,b.status);assert.equal(a.product,b.product);}
 const mt=r.maint.find(w=>w.id==='ТО-3');assert.equal(mt.at,1800);assert.equal(mt.machine,'heat-3');assert.equal(mt.startedAt,1800);
 assert.equal(workIsFrozen(c,r,'ТО-1'),true);assert.equal(workIsFrozen(c,r,'ТО-3'),false);
});

test('second event preserves the entire prefix of the first revised plan',()=>{
 const original=base();
 const first={...original,events:1,baselinePolicy:'balanced',baselineOffset:0,...captureWorkPlan(original,'baseline'),workStarts:{'ТО-2':420,'ТО-3':1800},maintenanceMachines:{'ТО-2':'grind-3'}};
 const before=simulate(first,POLICIES[1]);
 const second={...first,events:2,firstReplanPolicy:'priority',firstReplanOffset:0,...captureWorkPlan(first,'firstReplan'),workStarts:{...first.workStarts,'ТО-3':2160},maintenanceMachines:{...first.maintenanceMachines,'ТО-3':'heat-3'}};
 const after=simulate(second,POLICIES[0]);
 for(const t of [0,119,120,200,419,420,600,689])for(const m of MACHINES){const a=stateAt(before,t)[m.id],b=stateAt(after,t)[m.id];assert.equal(a.status,b.status,`${t} ${m.id}`);assert.equal(a.product,b.product);}
 assert.equal(after.maint.find(w=>w.id==='ТО-2').startedAt,420);
 assert.equal(after.maint.find(w=>w.id==='ТО-3').startedAt,2160);
 const previous=previousPlan(second);assert.equal(previous.maint.find(w=>w.id==='ТО-3').at,1800);
});

test('attempts to move already started work cannot rewrite executed time or machine',()=>{
 const original=base();
 const c={...original,events:1,baselinePolicy:'balanced',baselineOffset:0,...captureWorkPlan(original,'baseline'),workStarts:{'ТО-1':360},maintenanceMachines:{'ТО-1':'press-5'}};
 const r=simulate(c),w=r.maint.find(w=>w.id==='ТО-1');
 assert.equal(w.machine,'press-1');assert.equal(w.startedAt,0);assert.equal(w.at,0);near(w.left,0);
});

test('validation machines are selectable and distinct within a group',()=>{
 assert.throws(()=>validateConfig({...base(),validationMachines:{'ВАЛ-2b':'grind-4'}}),/разные машины/);
 assert.throws(()=>validateConfig({...base(),validationMachines:{'ВАЛ-2a':'heat-1'}}),/Неподходящая/);
 const r=simulate({...base(),validationMachines:{'ВАЛ-2a':'grind-2','ВАЛ-2b':'grind-3'}});
 assert.equal(r.vals.find(w=>w.id==='ВАЛ-2a').machine,'grind-2');
});

test('optimizer removes duplicate schedules when starts are fixed',()=>{
 const r=optimize({...base(),workStarts:Object.fromEntries(WORKS.filter(w=>!w.product).map(w=>[w.id,w.defaultAt]))});
 assert.equal(r.evaluated,12);assert.equal(r.candidates.length,4);
});

test('passport exports baseline, repair and absence decisions with immutable linked snapshots',()=>{
 const c0=base(),policy=POLICIES[0],history=[];
 history.push(appendDecision(history,{stage:3,role:'Планер',at:'2026-11-27T08:00:00Z',note:'Базовый план'},c0,policy,true));
 const c1={...c0,events:1,baselinePolicy:policy.id,baselineOffset:0,...captureWorkPlan(c0,'baseline')};
 history.push(appendDecision(history,{stage:1,action:'incident',role:'Начальник участка',at:'2026-11-27T08:01:00Z',note:'Ремонт'},c1,policy,true));
 const c2={...c1,events:2,firstReplanPolicy:policy.id,firstReplanOffset:0,...captureWorkPlan(c1,'firstReplan')};
 history.push(appendDecision(history,{stage:3,role:'Планер',at:'2026-11-27T08:02:00Z',note:'Два невыхода'},c2,policy,true));
 const output=exportScenario(c2,simulate(c2),history);
 assert.equal(output.versions.length,3);assert.equal(output.decisions.length,3);
 assert.deepEqual(output.versions.map(v=>v.config.events),[0,1,2]);
 assert.equal(output.versions[1].parentId,output.versions[0].id);
 assert.equal(output.versions[2].parentId,output.versions[1].id);
 assert.deepEqual(output.decisions.map(d=>d.note),['Базовый план','Ремонт','Два невыхода']);
 c0.staff[0]=0;assert.equal(output.versions[0].config.staff[0],34);
 assert.equal(output.beforeIncident.shifts[1].available,34);assert.equal(output.passport.shifts[1].available,32);
});
