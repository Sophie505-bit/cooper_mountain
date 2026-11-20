import {MACHINES,ROUTES} from './engine.js';

// Identical running machines share their stage rate equally. The buffer absorbs the difference.
export function describeFlows(states,rates){
  const links=[], machineRates={};
  for(const [product,route] of Object.entries(ROUTES)){
    const stages=route.map(type=>{
      const machines=MACHINES.filter(m=>m.type===type && states[m.id]?.status==='running' && states[m.id].product===product);
      const rate=rates[product][type]||0;
      for(const m of machines)machineRates[m.id]=rate/machines.length;
      return machines.map(m=>({id:m.id,name:m.name,rate:machineRates[m.id]}));
    });
    for(let i=1;i<route.length;i++){
      const supply=stages[i-1].map(m=>({...m})), demand=stages[i].map(m=>({...m}));
      const balance=(rates[product][route[i-1]]||0)-(rates[product][route[i]]||0);
      const buffer={id:null,name:'Запас после '+route[i-1].toUpperCase(),rate:Math.abs(balance)};
      if(balance>0)demand.push(buffer);
      if(balance<0)supply.push(buffer);
      let a=0,b=0;
      while(a<supply.length && b<demand.length){
        const from=supply[a],to=demand[b],rate=Math.min(from.rate,to.rate);
        if(rate>1e-7)links.push({bufferStage:route[i-1],product,from:from.name,to:to.name,source:from.id,target:to.id,rate});
        from.rate-=rate;to.rate-=rate;
        if(from.rate<1e-7)a++;
        if(to.rate<1e-7)b++;
      }
    }
  }
  return {links,machineRates};
}
