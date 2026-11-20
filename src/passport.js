import {POLICIES,simulate} from './engine.js';

export function workIntervals(result,job){
  return result.timeline[job.machine].filter(s=>s.validation===job.id || (s.job===job.id&&s.status==='maintenance')).map(({start,end})=>({start,end}));
}

export function passport(result,config){
  return {
    incidentConflicts:result.incidentConflicts,strategy:result.policy.name,requestedStaff:config.staff,
    produced:result.total,late:result.missed,personHours:result.labor,
    orders:result.orderStats,
    shifts:result.shiftStats.map((shift,i)=>{
      const boundary=(i+1)*720;
      const epochs=result.epochs.filter(e=>e.start>=i*720 && e.start<boundary);
      const peak=epochs.find(e=>e.used===shift.peak);
      const packed=epochs.at(-1).final;
      const deliveries=config.orders.map((o,index)=>{
        const earlier=config.orders.filter((other,j)=>other.product===o.product && (other.due<o.due || (other.due===o.due&&j<index))).reduce((sum,other)=>sum+other.quantity,0);
        return {id:o.id,packed:Math.max(0,Math.min(o.quantity,packed[o.product]-earlier)),lateAtDeadline:o.due===boundary?Math.max(0,o.quantity-result.orderStats[index].onTime):0};
      });
      return {...shift,number:i+1,available:epochs[0].available,deliveries,peakInterval:{start:peak.start,end:peak.end,operators:peak.used-peak.validationStaff,validation:peak.validationStaff}};
    }),
    works:[...result.maint,...result.vals].map(job=>({...job,intervals:workIntervals(result,job)})),
    materialUnits:'лезвия',timeUnits:'минуты от D+1 08:00'
  };
}

export function previousPlan(config){
  if(!config.events)return null;
  const second=config.events===2;
  const strategy=POLICIES.find(p=>p.id===(second?config.firstReplanPolicy:config.baselinePolicy))||POLICIES[0];
  return simulate({...config,events:config.events-1,maintenanceOffset:(second?config.firstReplanOffset:config.baselineOffset)??0},strategy);
}

export function compareIncident(before,after){
  const stock=shift=>Object.values(shift.stocks).reduce((sum,stages)=>sum+Object.values(stages).reduce((a,v)=>a+v,0),0);
  const shifts=after.shiftStats.map((s,i)=>({
    number:i+1,output:s.output-before.shiftStats[i].output,stock:stock(s)-stock(before.shiftStats[i]),
    hours:s.labor-before.shiftStats[i].labor,peak:s.peak-before.shiftStats[i].peak
  }));
  const oldJobs=[...before.maint,...before.vals];
  const works=[];
  for(const job of [...after.maint,...after.vals]){
    const old=oldJobs.find(w=>w.id===job.id);
    const prev=workIntervals(before,old),next=workIntervals(after,job);
    // Timeline segmentation may change without changing the actual work.
    const same=prev.length===next.length&&prev.every((x,i)=>Math.abs(x.start-next[i].start)<1e-6 && Math.abs(x.end-next[i].end)<1e-6);
    if(!same || old.machine!==job.machine)works.push({id:job.id,machine:job.machine,prev,next});
  }
  return {shifts,works};
}
