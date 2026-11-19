// All quantities are blades, all timestamps are calendar minutes since D+1 08:00.
export const PRODUCTS = ['А', 'Б', 'В'];
export const TYPES = [
  ['press','Пресс',5,900,1,5],['heat','Термолиния',3,1540,1,1],
  ['print','Печать',2,1300,1,2],['laser','Лазер',1,1500,1,1],
  ['rewind','Перемотка',2,2500,1,1],['grind','GRIND',5,800,1,1],
  ['wash','WASH',1,7680,1,1],['chrome','CHROME',2,2680,1,2],
  ['tef','TEF',2,3385,2,1],['lube','Смазка',1,7680,1,1],
  ['wrap','WRAP',16,285,1,3],['pack','PACK',3,1350,2,1]
].map(([id,name,count,speed,operators,group])=>({id,name,count,speed,operators,group}));
export const ROUTES = Object.fromEntries(PRODUCTS.map(p=>[p,TYPES.map(x=>x.id).filter(x=>x!==(p==='В'?'print':'laser') && !(p==='Б'&&x==='chrome'))]));
export const DEFAULT_ORDERS = [
  {id:'ORD-1',product:'А',quantity:1400000,due:720,priority:3},
  {id:'ORD-2',product:'Б',quantity:1000000,due:1440,priority:2},
  {id:'ORD-3',product:'В',quantity:1000000,due:1440,priority:3},
  {id:'ORD-4',product:'А',quantity:1500000,due:2160,priority:3},
  {id:'ORD-5',product:'Б',quantity:1000000,due:2880,priority:1},
  {id:'ORD-6',product:'В',quantity:1100000,due:2880,priority:2}
];
export const DEFAULT_CONFIG={staff:[34,34,34,34],orders:DEFAULT_ORDERS,events:0,maintenanceOffset:0};
const INITIAL={А:{print:200000,grind:250000,lube:300000},Б:{print:100000,grind:150000,lube:100000},В:{laser:150000}};
const INITIAL_SETTINGS={press:[3,2,0],heat:[2,1,0],print:[1,1,0],laser:[0,0,1],rewind:[1,1,0],grind:[3,2,0],wash:[1,0,0],chrome:[2,0,0],tef:[2,0,0],lube:[1,0,0],wrap:[10,6,0],pack:[2,1,0]};
export const MACHINES=TYPES.flatMap(type=>Array.from({length:type.count},(_,i)=>({id:`${type.id}-${i+1}`,type:type.id,index:i,name:`${type.name} ${String(i+1).padStart(2,'0')}`,initial:PRODUCTS[INITIAL_SETTINGS[type.id].findIndex((_,p)=>i<INITIAL_SETTINGS[type.id].slice(0,p+1).reduce((a,b)=>a+b,0))]})));
export const POLICIES=[
 {id:'balanced',name:'По срокам',description:'Срочные заказы первыми',order:[0,1,2,3,4,5],validationParallel:true},
 {id:'priority',name:'По приоритету',description:'Продукт В перед Б',order:[0,2,1,3,5,4],validationParallel:true},
 {id:'lean',name:'Меньше переналадок',description:'Объединить заказы продукта А',order:[0,3,1,4,2,5],validationParallel:false},
 {id:'people',name:'Ровнее по людям',description:'Последовательные валидации',order:[0,1,2,3,5,4],validationParallel:false}
];
const TYPE_MAP=Object.fromEntries(TYPES.map((t,i)=>[t.id,{...t,rank:i}]));
const cloneStocks=stocks=>Object.fromEntries(PRODUCTS.map(p=>[p,{...stocks[p]}]));
export function calendar(t){
 const m=((t%720)+720)%720;
 const breaks=[[240,270],[480,510],[690,720]];
 for(const [a,b] of breaks) if(m>=a&&m<b) return {working:false,next:t-m+b};
 return {working:true,next:t-m+(breaks.find(([a])=>a>m)?.[0]??720)};
}
export function workMinutes(a,b){let sum=0;while(a<b-1e-8){const c=calendar(a);const e=Math.min(b,c.next);if(c.working)sum+=e-a;a=e;}return sum;}
export const setupTime=(a,b)=>a===b?0:({АБ:20,БА:20,АВ:30,ВА:30,БВ:25,ВБ:25}[a+b]);
export function fmtTime(t){const n=Math.round(t)+480;return `D+${1+Math.floor(n/1440)} ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
export function validateConfig(c){
 if(!c||!Array.isArray(c.staff)||c.staff.length!==4||c.staff.some(n=>!Number.isInteger(n)||n<0||n>100))throw Error('Персонал: четыре целых значения от 0 до 100.');
 if(!Array.isArray(c.orders)||c.orders.length!==6)throw Error('Нужно шесть заказов.');
 const ids=new Set(); for(const o of c.orders){if(!o.id||ids.has(o.id)||!PRODUCTS.includes(o.product)||!Number.isFinite(o.quantity)||o.quantity<=0||o.quantity>1e8||![720,1440,2160,2880].includes(o.due)||![1,2,3].includes(o.priority))throw Error('Проверьте ID, продукт, объём, срок и приоритет заказов.');ids.add(o.id);}
 if(!Number.isInteger(c.events)||c.events<0||c.events>2||!Number.isFinite(c.maintenanceOffset)||c.maintenanceOffset<0||c.maintenanceOffset>120)throw Error('Некорректные события или смещение ТО.');
 for(const key of ['baselinePolicy','firstReplanPolicy'])if(c[key]!==undefined&&!POLICIES.some(p=>p.id===c[key]))throw Error('Неизвестная стратегия в истории плана.');
 for(const key of ['baselineOffset','firstReplanOffset'])if(c[key]!==undefined&&(!Number.isFinite(c[key])||c[key]<0||c[key]>120))throw Error('Некорректное размещение ТО в истории.');
 return structuredClone(c);
}
export function createGraph(orders,policy=POLICIES[0]){
 // Technological arcs form a DAG. Resource-order arcs orient disjunctive choices.
 const nodes=[],technological=[],resource=[];
 for(const o of orders){const r=ROUTES[o.product];r.forEach((type,i)=>{const id=`${o.id}:${type}`;nodes.push({id,type,order:o.id});if(i)technological.push([`${o.id}:${r[i-1]}`,id]);});}
 for(const type of TYPES){const tasks=policy.order.map(i=>orders[i]).filter(o=>ROUTES[o.product].includes(type.id));for(let i=1;i<tasks.length;i++)resource.push([`${tasks[i-1].id}:${type.id}`,`${tasks[i].id}:${type.id}`]);}
 return {nodes,technological,resource};
}
export function isAcyclic(graph){const adj=new Map(graph.nodes.map(n=>[n.id,[]])),degree=new Map(graph.nodes.map(n=>[n.id,0]));for(const [a,b]of [...graph.technological,...graph.resource]){adj.get(a).push(b);degree.set(b,degree.get(b)+1);}const q=[...degree].filter(([,d])=>!d).map(([n])=>n);let n=0;while(q.length){const a=q.pop();n++;for(const b of adj.get(a)){degree.set(b,degree.get(b)-1);if(!degree.get(b))q.push(b);}}return n===graph.nodes.length;}
const eps=1e-5;
export function simulate(raw,policy=POLICIES[0]){
 const start=performance.now(),c=validateConfig(raw),machines=MACHINES.map(m=>({...m,product:m.initial,setup:0}));
 const stocks={},produced={},final={},finished={},timeline=Object.fromEntries(machines.map(m=>[m.id,[]]));
 for(const p of PRODUCTS){stocks[p]={};produced[p]={};final[p]=0;for(const s of ROUTES[p]){stocks[p][s]=INITIAL[p][s]||0;produced[p][s]=0;}}
 const offsetAt=at=>c.events&&at<120?(c.baselineOffset??0):c.events===2&&at<690?(c.firstReplanOffset??0):c.maintenanceOffset;
 const maint=[['ТО-1','press-1',180,0,720],['ТО-2','grind-1',240,270,1440],['ТО-3','heat-1',180,1440,2880],['ТО-4','chrome-1',240,510,2880],['ТО-5','pack-1',180,1440,2880]].map(([id,machine,duration,at,deadline])=>({id,machine,duration,left:duration,at:at+offsetAt(at),deadline}));
 const vals=[['ВАЛ-1','tef-1','А',240,0,1440],['ВАЛ-2a','grind-4','Б',180,0,2880],['ВАЛ-2b','grind-5','Б',180,0,2880],['ВАЛ-3','laser-1','В',240,1440,2880],...['wrap-1','wrap-2','wrap-3'].map((id,i)=>[`ВАЛ-4${i+1}`,id,'А',180,1440,2880])].map(([id,machine,product,duration,at,deadline])=>({id,machine,product,duration,left:duration,at,deadline}));
 const maintByMachine=Object.fromEntries(maint.map(m=>[m.machine,m])),valByMachine=Object.fromEntries(vals.map(v=>[v.machine,v]));
 const dispatch=[...machines].sort((a,b)=>TYPE_MAP[b.type].rank-TYPE_MAP[a.type].rank||a.index-b.index);
 const makeTasks=pol=>{const cumulative=Object.fromEntries(PRODUCTS.map(p=>[p,0]));return pol.order.map(i=>{const o=c.orders[i],r=ROUTES[o.product];cumulative[o.product]+=o.quantity;return {...o,targets:Object.fromEntries(r.map((s,j)=>[s,Math.max(0,cumulative[o.product]-r.slice(j).reduce((a,k)=>a+(INITIAL[o.product][k]||0),0))]))};});};
 const basePolicy=POLICIES.find(p=>p.id===c.baselinePolicy)||POLICIES[0],firstPolicy=POLICIES.find(p=>p.id===c.firstReplanPolicy)||basePolicy;
 const baseTasks=makeTasks(basePolicy),firstTasks=makeTasks(firstPolicy),tasks=makeTasks(policy);
 const shiftStats=Array.from({length:4},()=>({output:0,peak:0,labor:0,setup:0,idle:0,stocks:null,products:{А:0,Б:0,В:0}}));
 let t=0,iterations=0,repairMachine='grind-2',setupMinutes=0; const epochs=[];const atDue={};
 while(t<2880-eps && iterations++<25000){
  const finalStart={...final};
  const cal=calendar(t),shift=Math.min(3,Math.floor(t/720)),available=Math.max(0,c.staff[shift]-(c.events>=2&&shift===1?2:0));
  // Until the incident, all alternatives share the base decisions (no clairvoyance).
  const reaction=c.events===2?690:c.events===1?120:0,epochPolicy=c.events&&t<120-eps?basePolicy:c.events===2&&t<690-eps?firstPolicy:policy,activeTasks=c.events&&t<120-eps?baseTasks:c.events===2&&t<690-eps?firstTasks:tasks;
  const chosen={};for(const type of TYPES)chosen[type.id]=activeTasks.find(o=>o.targets[type.id]!==undefined&&produced[o.product][type.id]<o.targets[type.id]-eps);
  const allocations=[],states={},groupCounts={},activeCounts={},validationFamilies=new Set();let used=0;
  function cost(m){const ty=TYPE_MAP[m.type],n=groupCounts[m.type]||0;return ty.operators*(Math.ceil((n+1)/ty.group)-Math.ceil(n/ty.group));}
  // Downstream-first dispatch avoids assigning all operators to feeding buffers.
  for(const m of dispatch){
   const maybeMt=maintByMachine[m.id],mt=maybeMt&&maybeMt.left>eps&&t>=maybeMt.at-eps&&t<maybeMt.deadline-eps?maybeMt:null;
   if(c.events>=1&&m.id===repairMachine&&t>=120-eps&&t<300-eps){states[m.id]={status:'repair',product:m.product};continue;}
   if(mt){states[m.id]={status:cal.working?'maintenance':'break',product:m.product,job:mt.id};continue;}
   if(!cal.working){states[m.id]={status:'break',product:m.product};continue;}
   const task=chosen[m.type]; if(!task){states[m.id]={status:'idle',reason:'План этапа выполнен',product:m.product};continue;}
   const r=ROUTES[task.product],j=r.indexOf(m.type),input=j?stocks[task.product][r[j-1]]:Infinity;
   const prev=j?r[j-1]:null,feedPossible=!prev||Boolean(chosen[prev]?.product===task.product);
   if(input<eps&&!feedPossible&&m.setup<eps){states[m.id]={status:'waiting',reason:'Нет полуфабриката',product:task.product};continue;}
   // Do not preempt an already started setup.
   if(m.setup<eps&&m.product!==task.product){m.setup=setupTime(m.product,task.product);m.nextProduct=task.product;}
   const maybeV=valByMachine[m.id],v=maybeV&&maybeV.left>eps&&t>=maybeV.at-eps&&t<maybeV.deadline-eps&&maybeV.product===task.product?maybeV:null;
   const parallel=epochPolicy.validationParallel;
   const family=v?.id.slice(0,5),otherVal=v&&validationFamilies.has(family);
   const doVal=v&&m.setup<eps&&(parallel||!otherVal);
   const need=cost(m)+(doVal?1:0);
   if(used+need>available){states[m.id]={status:'waiting',reason:'Не хватает операторов',product:m.product};continue;}
   used+=need;groupCounts[m.type]=(groupCounts[m.type]||0)+1;
   if(m.setup>eps){allocations.push({m,setup:true});states[m.id]={status:'setup',product:m.nextProduct};}
   else {allocations.push({m,task,validation:doVal?v:null});if(doVal)validationFamilies.add(family);activeCounts[m.type]=(activeCounts[m.type]||0)+1;states[m.id]={status:'running',product:task.product,validation:doVal?v.id:null};}
  }
  const rates=Object.fromEntries(PRODUCTS.map(p=>[p,{}]));
  for(const p of PRODUCTS){const r=ROUTES[p];for(let j=0;j<r.length;j++){const s=r[j],ty=TYPE_MAP[s];let rate=(chosen[s]?.product===p?(activeCounts[s]||0):0)*ty.speed*.85;
    if(j&&stocks[p][r[j-1]]<eps)rate=Math.min(rate,rates[p][r[j-1]]||0);rates[p][s]=rate;
  }}
  for(const a of allocations)if(!a.setup&&(rates[a.task.product][a.m.type]||0)<eps){states[a.m.id]={status:'waiting',product:a.task.product,reason:'Нет подачи с предыдущего этапа'};}
  // Epoch ends at the next boundary, job completion, buffer depletion or target hit.
  let end=Math.min(2880,cal.next,(shift+1)*720);
  const boundaries=[120,300,690,1440,...maint.map(x=>x.at),...vals.map(x=>x.at),...maint.map(x=>x.deadline),...vals.map(x=>x.deadline)];
  for(const b of boundaries)if(b>t+eps)end=Math.min(end,b);
  if(cal.working){
   for(const a of allocations){if(a.setup)end=Math.min(end,t+a.m.setup);if(a.validation&&states[a.m.id].status==='running')end=Math.min(end,t+a.validation.left);}
   for(const mt of maint)if(states[mt.machine]?.status==='maintenance'&&states[mt.machine]?.job===mt.id)end=Math.min(end,t+mt.left);
   for(const p of PRODUCTS){const r=ROUTES[p];for(let j=0;j<r.length;j++){const s=r[j],rate=rates[p][s],task=chosen[s];if(rate>eps&&task?.product===p)end=Math.min(end,t+(task.targets[s]-produced[p][s])/rate);
    const out=j<r.length-1?rates[p][r[j+1]]:0,net=rate-out;if(net<-eps&&stocks[p][s]>eps)end=Math.min(end,t+stocks[p][s]/-net);
   }}
  }
  if(end<=t+eps)end=Math.min(cal.next,t+.001);const dt=end-t;
  if(cal.working){
   shiftStats[shift].peak=Math.max(shiftStats[shift].peak,used);shiftStats[shift].labor+=used*dt/60;
   for(const mt of maint)if(states[mt.machine]?.status==='maintenance'&&states[mt.machine]?.job===mt.id)mt.left=Math.max(0,mt.left-dt);
   for(const a of allocations){if(a.setup){a.m.setup=Math.max(0,a.m.setup-dt);setupMinutes+=dt;shiftStats[shift].setup+=dt;if(a.m.setup<eps)a.m.product=a.m.nextProduct;}if(a.validation&&states[a.m.id].status==='running')a.validation.left=Math.max(0,a.validation.left-dt);}
   for(const p of PRODUCTS){const r=ROUTES[p];for(let j=0;j<r.length;j++){const s=r[j],q=rates[p][s]*dt;produced[p][s]+=q;stocks[p][s]+=q-(j<r.length-1?rates[p][r[j+1]]*dt:q);if(stocks[p][s]<eps)stocks[p][s]=0;}
    const q=rates[p].pack*dt;final[p]+=q;shiftStats[shift].output+=q;shiftStats[shift].products[p]+=q;
   }
  }
  for(const m of machines){const s=states[m.id],list=timeline[m.id],last=list.at(-1);if(last&&last.status===s.status&&last.product===s.product&&last.validation===s.validation&&last.reason===s.reason&&last.job===s.job)last.end=end;else list.push({start:t,end,...s});}
  // Allocate completed products to orders by deadline, independent of dispatch order.
  for(const p of PRODUCTS){let allocated=0;for(const o of c.orders.filter(o=>o.product===p).sort((a,b)=>a.due-b.due)){allocated+=o.quantity;if(!finished[o.id]&&final[p]>=allocated-eps)finished[o.id]=end;}}
  epochs.push({start:t,end,used,available,finalStart,final:{...final},stocks:cloneStocks(stocks)});
  t=end;
  if(Math.abs(t-(shift+1)*720)<eps){shiftStats[shift].stocks=cloneStocks(stocks);atDue[t]={...final};}
 }
 const orderStats=c.orders.map(o=>{let earlier=c.orders.filter(x=>x.product===o.product&&(x.due<o.due||(x.due===o.due&&c.orders.indexOf(x)<c.orders.indexOf(o)))).reduce((a,x)=>a+x.quantity,0);return {...o,completed:Math.max(0,Math.min(o.quantity,final[o.product]-earlier)),onTime:Math.max(0,Math.min(o.quantity,(atDue[o.due]?.[o.product]||0)-earlier)),finish:finished[o.id]??null};});
 const rawMissed=orderStats.reduce((s,o)=>s+o.quantity-o.onTime,0),missed=rawMissed<eps?0:rawMissed,remainingWorks=[...maint,...vals].filter(x=>x.left>eps),graph=createGraph(c.orders,policy);
 const result={policy,final,stocks,stageProduced:produced,epochs,timeline,orderStats,shiftStats,maint,vals,missed,remainingWorks,setupMinutes,graph,iterations,repairMachine,total:Object.values(final).reduce((a,b)=>a+b,0),labor:shiftStats.reduce((s,x)=>s+x.labor,0)};
 result.feasible=remainingWorks.length===0;result.ms=performance.now()-start;return result;
}
export function optimize(config){
 const start=performance.now();
 // Orient resource-order arcs; reject cycles before evaluating the candidate.
 const candidates=[];for(const policy of POLICIES)for(const offset of [0,60,120]){const graph=createGraph(config.orders,policy);if(isAcyclic(graph)){const result=simulate({...config,maintenanceOffset:offset},policy);candidates.push({...result,offset});}}
 // Hard work-window violations precede deadline deficit; never silently relax them.
 candidates.sort((a,b)=>a.remainingWorks.length-b.remainingWorks.length||a.missed-b.missed||a.labor-b.labor||a.setupMinutes-b.setupMinutes);
 return {candidates,best:candidates[0],ms:performance.now()-start};
}
export function stateAt(result,time){return Object.fromEntries(Object.entries(result.timeline).map(([id,items])=>[id,items.find(x=>time>=x.start-eps&&time<x.end-eps)||items.at(-1)]));}
