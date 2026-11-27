import React,{useMemo} from 'react';
import {Button} from './components/ui/button';
import {Choice} from './components/Controls';
import {Table,TableHeader,TableRow,TableHead,TableBody,TableCell} from './components/ui/table';
import {fmtTime,workMinutes,WORKS,MACHINES,incidentTime,workIsFrozen} from './engine';
import {passport,previousPlan,compareIncident,exportScenario,intervalLabel} from './passport';
import {Pilot} from './Agreement';

const n=v=>Math.round(v).toLocaleString('ru-RU');
function Grid({labels,rows}){
  return <div className="table-scroll"><Table><TableHeader><TableRow>{labels.map(l=><TableHead key={l}>{l}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row,i)=><TableRow key={i}>{row.map((v,j)=><TableCell key={j}>{v}</TableCell>)}</TableRow>)}</TableBody></Table></div>;
}
export function Placement({config,result,update}){
  const cutoff=incidentTime(config);
  return <details className="inventory-details"><summary>Назначения по каждой машине</summary><p>Выберите машину и самое раннее начало. Начатые и выполненные работы до события защищены; будущие работы можно перенести. Для одной группы валидаций выбирайте разные машины.</p>
    <Grid labels={['Работа','Машина','Не раньше','Состояние']} rows={WORKS.map(job=>{
     const frozen=workIsFrozen(config,result,job.id),key=job.product?'validationMachines':'maintenanceMachines';
     const current=result[job.product?'vals':'maint'].find(w=>w.id===job.id);
     return [
      job.id+' · '+job.duration+' мин',<Choice aria-label={'Машина '+job.id} disabled={frozen} value={frozen?current.machine:config[key]?.[job.id]??job.machine} onChange={e=>update({[key]:{...config[key],[job.id]:e.target.value}})}>{MACHINES.filter(m=>m.type===job.machine.split('-')[0]).map(m=><option key={m.id} value={m.id} disabled={job.product&&WORKS.some(other=>other.id!==job.id&&other.product&&other.id.slice(0,5)===job.id.slice(0,5)&&(config.validationMachines?.[other.id]??other.machine)===m.id)}>{m.name}</option>)}</Choice>,
      <Choice aria-label={'Начало '+job.id} disabled={frozen} value={String(config.workStarts?.[job.id]??'auto')} onChange={e=>{
        const workStarts={...config.workStarts};if(e.target.value==='auto')delete workStarts[job.id];else workStarts[job.id]=Number(e.target.value);
        update({workStarts});
      }}><option value="auto">По стратегии</option>{Array.from({length:(job.deadline-job.first)/30},(_,i)=>job.first+i*30).filter(t=>workMinutes(t,job.deadline)>=job.duration).map(t=><option key={t} value={String(t)} disabled={!frozen&&t<cutoff}>{fmtTime(t)}</option>)}</Choice>,
      current.interruptionReason??(frozen?'Зафиксирована':'Можно изменить')];
    })}/></details>;
}

function IncidentDetails({before,after}){
 const difference=useMemo(()=>compareIncident(before,after),[before,after]);
 const format=(value,digits=0)=>value.toLocaleString('ru-RU',{maximumFractionDigits:digits,signDisplay:'exceptZero'});
 const times=segments=>segments.map(v=>fmtTime(v.start)+' — '+fmtTime(v.end)).join('; ')||'Не выполнялась';
 return <details className="inventory-details"><summary>Изменения по сменам и затронутые работы</summary>
   <Grid labels={['Смена','Δ выпуска, лезвий','Δ НЗП, лезвий','Δ занятости, чел·ч','Δ пика, чел.']} rows={difference.shifts.map(s=>[s.number,format(s.output),format(s.stock),format(s.hours,2),format(s.peak)])}/>
   {difference.works.length?<Grid labels={['Работа','Машина','До','После']} rows={difference.works.map(w=>[w.id,w.machine,times(w.prev),times(w.next)])}/>:<p>Интервалы всех плановых ТО и валидаций сохранены.</p>}
 </details>;
}
export function ScenarioReport({config,result,store}){
 const data=useMemo(()=>passport(result,config),[result,config]);
 const before=useMemo(()=>previousPlan(config),[config]);
 const baseline=useMemo(()=>config.events===2?previousPlan({...config,events:1}):null,[config]);
 const history=useMemo(()=>{try{return JSON.parse(store.getItem('epoch-decisions')||'[]');}catch{return [];}},[config,result,store.getItem('epoch-decisions')]);
 function download(){
   const file=exportScenario(config,result,history);
   const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;a.download='epoch-passport.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="logic-content"><h2>Паспорт и решения</h2><Button className="button" onClick={download}>Скачать паспорт JSON</Button>
 <h3>Пиковая нагрузка смен</h3><p>{config.reserveNote||"Обоснование резерва не внесено"}</p><Grid labels={['Смена','Интервал пика','Операторы','Валидация','Доступно','Резерв на пике']} rows={data.shifts.map(s=>[s.number,intervalLabel(s.peakInterval.start,s.peakInterval.end),s.peakInterval.operators,s.peakInterval.validation,s.available,s.available-s.peak])}/>
 {result.validationConflicts?.length>0&&<div role="alert" className="inline-notice"><div><strong>Валидации прерваны — план требует пересмотра</strong>{result.validationConflicts.map(v=><p key={v.id}>{v.id} · {v.machine.toUpperCase()} · {fmtTime(v.at)}: {v.reason}. Остаток не засчитывается в другой производственной кампании.</p>)}</div></div>}
 <details className="inventory-details"><summary>Выполнение каждого заказа к концу смены</summary><Grid labels={['Смена','Заказ','Упаковано накопительно','Дефицит в срок этой смены']} rows={data.shifts.flatMap(s=>s.deliveries.map(o=>[s.number,o.id,n(o.packed),n(o.lateAtDeadline)]))}/></details>
 <details className="inventory-details"><summary>Фактические интервалы ТО и валидации</summary><Grid labels={['Работа','Машина','Разрешённое окно','Рабочие интервалы','Осталось, мин']} rows={data.works.map(w=>[w.id,w.machine,fmtTime(w.first)+' — '+fmtTime(w.deadline),w.intervals.map(x=>fmtTime(x.start)+' — '+fmtTime(x.end)).join('; ')||'Не начата',n(w.left)])}/></details>
 {before&&<><h3>{config.events===1?'Последствия ремонта':'Последствия невыхода в смену 2'}</h3><p>{config.events===1?(result.repairMachine?result.repairMachine.toUpperCase()+' · 10:00–13:00, потеря 150 рабочих минут':'На момент события нет работающего GRIND. Потеря мощности не применена.'):'Сообщение в 19:30 · заявка '+config.staff[1]+' · фактически '+data.shifts[1].available}</p><Grid labels={['Показатель','До события','После перепланирования']} rows={[[ 'Выпуск, лезвий',n(before.total),n(result.total)],['Занято, чел·ч',n(before.labor),n(result.labor)],['Незавершённые работы',before.remainingWorks.length,result.remainingWorks.length],...result.orderStats.map((o,i)=>[o.id+' · к сроку',n(before.orderStats[i].onTime),n(o.onTime)])]}/><IncidentDetails before={before} after={result}/></>}
 {baseline&&<details className="inventory-details"><summary>Первое отклонение · ремонт до невыхода</summary><Grid labels={['Показатель','Базовый план','После ремонта']} rows={[[ 'Выпуск, лезвий',n(baseline.total),n(before.total)],['Не к сроку',n(baseline.missed),n(before.missed)],['Занято, чел·ч',n(baseline.labor),n(before.labor)]]}/><IncidentDetails before={baseline} after={before}/></details>}
 <details className="inventory-details"><summary>Журнал решений и версий</summary>{history.length?<Grid labels={['Когда','Версия','Роль','Действие','Решение по отклонению']} rows={history.slice().reverse().map(h=>[new Date(h.at).toLocaleString('ru-RU'),h.versionId?.slice(0,8)||'Ранее',h.role,h.action==='incident'?'Применено событие':h.action==='returned'?'Возвращено на доработку':h.action==='reset'?'Восстановлен кейс':['','Переданы заказы','Предложен план','План согласован'][h.stage],h.note||'—'])}/>:<p>Решений пока нет. Первую запись создаёт планер при передаче заказов.</p>}</details>
 <details className="inventory-details"><summary>Пилот и оценка пользы</summary><Pilot/></details>
 </section>;
}
