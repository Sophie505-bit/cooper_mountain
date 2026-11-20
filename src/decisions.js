export function decisionStage(entry,config,policy,locked){
  if(!entry || ![1,2,3].includes(entry.stage))return 0;
  const fingerprint=JSON.stringify([config,policy.id,locked]);
  if(entry.fingerprint===fingerprint)return entry.stage;
  try{
    const [previous]=JSON.parse(entry.fingerprint);
    return JSON.stringify(previous.orders)===JSON.stringify(config.orders)?1:0;
  }catch{return 0;}
}

export function decisionBlock(stage,role,locked,result){
  if(stage===3)return '';
  const owner=stage===1?'Начальник участка':'Планер';
  if(role!==owner)return 'Следующий шаг выполняет '+owner.toLowerCase();
  if(stage>0&&!locked)return 'Сначала зафиксируйте заявку на смены 1 и 2';
  if(stage>0&&result.incidentConflicts?.length)return result.incidentConflicts.join(' ');
  if(stage>0&&result.remainingWorks.length)return 'Не завершены обязательные работы: '+result.remainingWorks.map(w=>w.id).join(', ');
  return '';
}
