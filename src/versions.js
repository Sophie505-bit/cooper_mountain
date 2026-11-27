// Every action keeps the exact input snapshot; export retains the entire chain.
export function appendDecision(history,entry,config,policy,locked){
 const fingerprint=JSON.stringify([config,policy.id,locked]);
 const previous=history.at(-1);
 const same=previous?.fingerprint===fingerprint&&previous.snapshot;
 const snapshot=same?previous.snapshot:{id:crypto.randomUUID(),parentId:previous?.snapshot?.id??null,config:structuredClone(config),policyId:policy.id,locked,at:entry.at};
 return {...entry,fingerprint,snapshot,versionId:snapshot.id};
}
export function versionHistory(history){
 const versions=[];const ids=new Set();
 for(const entry of history){
  let snapshot=entry.snapshot;
  if(!snapshot&&entry.fingerprint){try{const [config,policyId,locked]=JSON.parse(entry.fingerprint);snapshot={id:'legacy-'+versions.length,parentId:versions.at(-1)?.id??null,config,policyId,locked,at:entry.at};}catch{}}
  if(snapshot&&!ids.has(snapshot.id)){ids.add(snapshot.id);versions.push(snapshot);}
 }
 return versions;
}
