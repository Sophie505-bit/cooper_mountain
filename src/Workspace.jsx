import React,{useMemo,useState} from 'react';
import {Layers3,Copy,FolderPlus,ChevronRight,Check,ArrowUpRight} from 'lucide-react';
import {Button} from './components/ui/button';
import {Input} from './components/ui/input';
import {readPlan} from './scenarioStore.js';
import {decisionStage} from './decisions';
import {simulate} from './engine';

const phases=['Передать заказы','Подготовить план участка','Согласовать план','План согласован'];
const integer=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0});

export default function Workspace({index,manage,result,stage,go}){
 const current=index.items.find(i=>i.id===index.active);
 const [operation,setOperation]=useState(''),[name,setName]=useState(''),[error,setError]=useState('');
 const cards=useMemo(()=>index.items.map(item=>{
   const plan=readPlan(localStorage,item.id);
   const r=item.id===index.active?result:simulate(plan.config,plan.policy);
   return {...item,result:r,stage:item.id===index.active?stage:decisionStage(plan.decisions.at(-1),plan.config,plan.policy,plan.locked)};
 }),[index,result,stage]);
 const lateOrders=result.orderStats.filter(order=>order.quantity-order.onTime>=1);
 const attention=result.remainingWorks.length+lateOrders.length+result.incidentConflicts.length;
 function act(action,value){
   try{manage(action,value);setOperation('');setError('');}
   catch(e){setError(e.message);}
 }
 function form(action){
   setOperation(action);setName(action==='rename'?current.name:action==='copy'?current.name+' · копия':'');setError('');
 }
 return <div className="workspace-center"><header><Layers3 size={24}/><div><h2>Рабочее пространство</h2><p>Производственный участок · Gillette</p></div></header>
   <div className="workspace-actions"><Button className="button primary" onClick={()=>form('new')}><FolderPlus size={16}/>Новый сценарий</Button><Button className="button" onClick={()=>form('copy')}><Copy size={16}/>Копия текущего</Button><Button className="button" onClick={()=>form('rename')}>Переименовать</Button></div>
   {operation&&<form className="workspace-form" onSubmit={e=>{e.preventDefault();act(operation,name);}}><label>Название сценария<Input autoFocus maxLength={64} value={name} onChange={e=>setName(e.target.value)}/></label><Button type="submit" className="button primary">Сохранить</Button><Button type="button" className="button" onClick={()=>{setOperation('');setError('');}}>Отмена</Button>{operation==='copy'&&<small>Копируются параметры, события и заявка. Для копии начинается новое согласование.</small>}</form>}
   {error&&<p role="alert">{error}</p>}
   <div className="scenario-list">{cards.map(c=><article key={c.id} className={c.id===index.active?'current':''}><div><strong>{c.name}</strong><small>{phases[c.stage]}</small></div>
     <div className="scenario-output"><b>{integer.format(c.result.total)}</b><small>лезвий · не к сроку {integer.format(c.result.missed)}</small></div>
     {c.id===index.active?<span><Check size={15}/> Открыт</span>:<Button className="button" onClick={()=>act('open',c.id)}>Открыть <ChevronRight size={14}/></Button>}</article>)}</div>
   <details className="attention-list" open={attention>0}><summary>Требуют внимания · {attention}</summary>
     {!attention&&<p>Все заказы укладываются в срок, обязательные работы завершаются в своих окнах.</p>}
     {result.remainingWorks.map(w=><button key={w.id} onClick={()=>go('factory',Math.max(0,w.deadline-1),w.machine)}><span>{w.id} · {w.machine.toUpperCase()}</span><b>Осталось {integer.format(w.left)} мин</b><ChevronRight size={14}/></button>)}
     {lateOrders.map(o=><button key={o.id} onClick={()=>go('orders',undefined,undefined,o.id)}><span>{o.id} · продукт {o.product}</span><b>Не к сроку {integer.format(o.quantity-o.onTime)}</b><ChevronRight size={14}/></button>)}
     {result.incidentConflicts.map(text=><button key={text} onClick={()=>go('passport')}><span>{text}</span><ChevronRight size={14}/></button>)}
   </details>
   <h3>Загрузка смен · {current.name}</h3><p>Пиковая занятость относительно фактического штата. Выберите смену, чтобы увидеть участок в момент пика.</p>
   <div className="shift-load">{result.shiftStats.map((s,i)=>{const peak=result.epochs.find(e=>Math.floor(e.start/720)===i&&e.used===s.peak);return <button key={i} onClick={()=>go('factory',peak?.start??i*720)}><span>Смена {i+1}<ArrowUpRight size={14}/></span><strong>{s.peak} / {peak?.available??0} чел.</strong><progress value={s.peak} max={Math.max(1,peak?.available??0)}/></button>;})}</div>
   <div className="workspace-actions"><Button className="button" onClick={()=>go('orders')}>Проверить заказы</Button><Button className="button" onClick={()=>go('passport')}>Открыть паспорт</Button></div>
 </div>;
}
