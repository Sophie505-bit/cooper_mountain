import {POLICIES,WORKS,validateConfig,simulate,optimize,workIsFrozen,incidentTime} from './engine.js';

export const comparePlans=(a,b)=>a.incidentConflicts.length-b.incidentConflicts.length||a.remainingWorks.length-b.remainingWorks.length||a.missed-b.missed||a.labor-b.labor||a.setupMinutes-b.setupMinutes;
export function scenarioSnapshot(config){
 const baseline=optimize(config),reference=baseline.best;
 return {config,policies:POLICIES,works:WORKS.map(w=>({...w,frozen:workIsFrozen(config,reference,w.id)})),baseline:baseline.candidates.map(r=>({policyId:r.policy.id,offset:r.offset,total:r.total,missed:r.missed,labor:r.labor,setupMinutes:r.setupMinutes,remainingWorks:r.remainingWorks.map(w=>w.id)})),rules:'Staff, orders, events, historical snapshots and machines are fixed. Suggest only policyId, offset (0..120) and earliest workStarts in allowed windows. Frozen work starts cannot change. Output is computed exclusively by the simulator.'};
}
export function validateProposal(config,proposal,reference){
 if(!proposal||!POLICIES.some(p=>p.id===proposal.policyId))throw Error('Неизвестная стратегия ИИ');
 if(!Number.isInteger(proposal.offset)||proposal.offset<0||proposal.offset>120)throw Error('Недопустимое смещение ТО');
 if(!Array.isArray(proposal.starts)||proposal.starts.length>WORKS.length)throw Error('Некорректный список работ');
 const starts={...config.workStarts},seen=new Set();
 for(const item of proposal.starts){const job=WORKS.find(w=>w.id===item.id);if(!job||seen.has(item.id))throw Error('Неизвестная или повторная работа');seen.add(item.id);
  if(workIsFrozen(config,reference,item.id))throw Error('ИИ пытается изменить начатую работу');
  if(item.at<incidentTime(config))throw Error('ИИ пытается изменить прошлое');
  starts[item.id]=item.at;
 }
 return validateConfig({...config,maintenanceOffset:proposal.offset,workStarts:starts});
}
export function evaluateProposals(config,proposals){
 if(!Array.isArray(proposals)||!proposals.length||proposals.length>8)throw Error('Ожидается от 1 до 8 предложений ИИ');
 const baseline=optimize(config),reference=baseline.best,accepted=[],rejected=[];const seen=new Set();
 for(const [i,p] of proposals.entries())try{const c=validateProposal(config,p,reference),policy=POLICIES.find(x=>x.id===p.policyId),r=simulate(c,policy);if(!r.feasible)throw Error('Незавершённые работы или конфликт события');
  const key=JSON.stringify(r.timeline);if(seen.has(key))continue;seen.add(key);accepted.push({...r,offset:p.offset,aiReason:typeof p.reason==='string'?p.reason.slice(0,500):'',aiSource:true});
 }catch(e){rejected.push({index:i+1,reason:e.message});}
 accepted.sort(comparePlans);
 // Keep the baseline when the model finds no better feasible schedule.
 const candidate=accepted[0],improved=Boolean(candidate&&comparePlans(candidate,reference)<0),best=improved?candidate:reference;
 return {baseline:reference,best,improved,accepted:accepted.length,rejected,evaluated:proposals.length,proposal:candidate??null};
}
