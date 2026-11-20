import {DEFAULT_CONFIG,POLICIES,validateConfig} from './engine.js';

const indexKey='epoch-workspace-v1';
export function workspaceIndex(storage){
  const initial={active:'base',items:[{id:'base',name:'Основной план'}]};
  const value=storage.getItem(indexKey);
  if(!value)return initial;
  const index=JSON.parse(value);
  if(!Array.isArray(index.items)||!index.items.some(item=>item.id===index.active))throw Error('Не удалось прочитать список сценариев');
  return index;
}
export function scenarioStorage(storage,id){
  const key=name=>id==='base'?name:'epoch-scenario/'+id+'/'+name;
  return {getItem:name=>storage.getItem(key(name)),setItem:(name,value)=>storage.setItem(key(name),value)};
}
export function readPlan(storage,id){
  const store=scenarioStorage(storage,id);
  const raw=store.getItem('epoch-config');
  return {
    config:raw?validateConfig(JSON.parse(raw)):structuredClone(DEFAULT_CONFIG),
    policy:POLICIES.find(p=>p.id===store.getItem('epoch-policy'))||POLICIES[0],
    locked:store.getItem('epoch-locked')==='true',
    decisions:JSON.parse(store.getItem('epoch-decisions')||'[]')
  };
}
export function saveIndex(storage,index){storage.setItem(indexKey,JSON.stringify(index));return index;}
export function scenarioName(items,name,except){
  const title=name.trim();
  if(!title||title.length>64)throw Error('Введите название от 1 до 64 символов');
  if(items.some(item=>item.id!==except&&item.name.toLocaleLowerCase()===title.toLocaleLowerCase()))throw Error('Сценарий с таким названием уже есть');
  return title;
}
export function createScenario(storage,index,name,source){
  const title=scenarioName(index.items,name);
  const id=crypto.randomUUID();
  const store=scenarioStorage(storage,id);
  const plan=source?readPlan(storage,source):{config:DEFAULT_CONFIG,policy:POLICIES[0],locked:false};
  store.setItem('epoch-config',JSON.stringify(plan.config));
  store.setItem('epoch-policy',plan.policy.id);
  store.setItem('epoch-locked',String(plan.locked||plan.config.events>0));
  return saveIndex(storage,{active:id,items:[...index.items,{id,name:title}]});
}
