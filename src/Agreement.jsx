import {decisionBlock} from './decisions';
import {Button} from "./components/ui/button";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "./components/ui/table";
import React, {useState} from 'react';

const stages = [
  ['Планер', 'Передать заказы'],
  ['Начальник участка', 'Передать план на согласование'],
  ['Планер', 'Согласовать план']
];

export function Agreement({config,policy,locked,role,setRole,result,stage,onDecision}){
  const [reason,setReason]=useState('');
  const [returning,setReturning]=useState(false);
  const next=stages[stage];
  const shortage=Math.round(result.missed);
  const needsReason=stage===2 && shortage>0;
  const blocked=decisionBlock(stage,role,locked,result);
  function advance(){
    if(!next || blocked || (needsReason&&!reason.trim()))return;
    onDecision({fingerprint:JSON.stringify([config,policy.id,locked]),stage:stage+1,role,at:new Date().toISOString(),
      note:needsReason?reason.trim():'',outcome:{output:result.total,late:result.missed,labor:result.labor,orders:result.orderStats.map(o=>({id:o.id,onTime:o.onTime,finish:o.finish}))}});
    setReason('');
  }
  function returnPlan(){
    if(role!=='Планер'||stage!==2||!reason.trim())return;
    onDecision({fingerprint:JSON.stringify([config,policy.id,locked]),action:'returned',stage:1,role,at:new Date().toISOString(),note:reason.trim()});
    setReason('');setReturning(false);
  }
  return <div className="approval-bar"><Button className="role-switch" aria-label="Сменить роль" onClick={()=>setRole(role==="Планер"?"Начальник участка":"Планер")}>{role}</Button><span>{blocked || (stage===3?'План согласован':next[0]+' · '+(locked?'заявка зафиксирована':'черновик заявки'))}</span>
    {(needsReason||returning) && stage===2 && <label>{returning?'Что нужно изменить':('Отклонение: '+shortage.toLocaleString('ru-RU')+' лезвий')} <input aria-label="Основание согласования просрочки" placeholder="Основание решения" value={reason} onChange={e=>setReason(e.target.value)}/></label>}
    {stage===2&&role==='Планер'&&<Button onClick={()=>setReturning(!returning)}>{returning?'Отмена':'На доработку'}</Button>}
    {returning&&stage===2?<Button disabled={!reason.trim()} onClick={returnPlan}>Вернуть с замечанием</Button>:next&&<Button disabled={Boolean(blocked)||(needsReason&&!reason.trim())} onClick={advance}>{next[1]}</Button>}</div>;
}

export function Pilot() {
  return <section><h3>Проверка на пилоте</h3>
    <p>Планер и начальник участка сначала фиксируют исходные значения по сменным отчётам. Затем составляют план вручную и в прототипе для одинаковых заказов, остатков и двух последовательных сбоев.</p>
    <Table><TableHeader><TableRow><TableHead>Показатель</TableHead><TableHead>Расчёт и источник</TableHead><TableHead>Цель</TableHead></TableRow></TableHeader><TableBody>
    {[
      ['Выпуск к сроку','Выпущено после PACK к сроку / заказано, по заказам','Выше'],
      ['Дефицит персонала','Минуты пересечения назначений сверх доступного штата, по интервалам','Ноль'],
      ['Обязательные работы','Завершено в окне / назначено, по журналу работ','100 %'],
      ['Время решения','От сообщения о сбое до согласования, по журналу пилота','Меньше'],
      ['Трудоёмкость','Человеко-часы / миллион выпущенных лезвий, по паспорту смен','Меньше при том же выполнении заказов']
    ].map(row => <TableRow key={row[0]}>{row.map(cell => <TableCell key={cell}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table>
    <p>Перед пилотом начальник сверяет стартовые остатки, настройки и календарь. Планер проверяет сроки по заказам. При расхождении баланса или нарушении окна работ версию возвращают на пересчёт. Результат пилота принимают после сверки паспорта с фактом и проверки, что обе роли воспроизводят решение.</p>
  </section>;
}
