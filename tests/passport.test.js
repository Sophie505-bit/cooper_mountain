import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate,DEFAULT_CONFIG,POLICIES,validateConfig,WORKS} from '../src/engine.js';
import {passport,previousPlan} from '../src/passport.js';
test('explicit maintenance respects machine, release and calendar',()=>{
 const c={...DEFAULT_CONFIG,workStarts:{'ТО-1':60},maintenanceMachines:{'ТО-1':'press-3'}};
 const report=passport(simulate(c),c);
 const work=report.works.find(w=>w.id==='ТО-1');
 assert.equal(work.machine,'press-3');assert.equal(work.intervals[0].start,60);
 assert.ok(Math.abs(work.intervals.reduce((sum,s)=>sum+s.end-s.start,0)-180)<1e-7);
 assert.throws(()=>validateConfig({...c,workStarts:{'ТО-1':600}}));
 assert.throws(()=>validateConfig({...c,maintenanceMachines:{'ТО-1':'pack-1'}}));
});
test('incident report reconstructs previous policy and does not reset work already started',()=>{
 const c={...DEFAULT_CONFIG,events:2,baselinePolicy:'balanced',baselineOffset:60,firstReplanPolicy:'people',firstReplanOffset:120,maintenanceOffset:0};
 const before=previousPlan(c),now=simulate(c,POLICIES[1]);
 assert.equal(before.policy.id,'people');assert.equal(now.maint[0].at,60);
 for(const job of now.maint)if(job.at<690)assert.equal(job.at,before.maint.find(j=>j.id===job.id).at);
 const r=passport(now,c);
 assert.equal(r.works.length,WORKS.length);
 assert.equal(r.shifts[1].available,c.staff[1]-2);
 for(const shift of r.shifts)assert.equal(shift.peak,shift.peakInterval.operators+shift.peakInterval.validation);
 for(const order of now.orderStats)assert.ok(Math.abs(r.shifts[3].deliveries.find(o=>o.id===order.id).packed-order.completed)<.001);
});
test('impossible deviations are reported instead of inventing a breakdown or missing personnel',()=>{
 const r=simulate({...DEFAULT_CONFIG,events:2,staff:[0,1,34,34]});
 assert.equal(r.repairMachine,null);
 assert.equal(r.incidentConflicts.length,2);
 assert.equal(r.feasible,false);
});
