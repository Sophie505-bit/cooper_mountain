import {Button} from "./components/ui/button";
import {Input} from "./components/ui/input";
import React,{useEffect,useRef,useState} from 'react';
import {Search,ChevronRight} from 'lucide-react';

export default function CommandMenu({actions}){
  const dialog=useRef(null);
  const [query,setQuery]=useState('');
  const matches=actions.filter(([name])=>name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  function open(){
    setQuery('');
    if(!dialog.current.open)dialog.current.showModal();
    dialog.current.querySelector('input').focus();
  }
  useEffect(()=>{
    const shortcut=e=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
        e.preventDefault();
        if(dialog.current.open)dialog.current.close();else open();
      }
    };
    window.addEventListener('keydown',shortcut);
    return ()=>window.removeEventListener('keydown',shortcut);
  },[]);
  function run(action){dialog.current.close();action();}
  return <><Button className="command-trigger" onClick={open}><Search size={15}/>Поиск команд <kbd>Ctrl K</kbd></Button>
    <dialog ref={dialog} className="command-menu" aria-label="Поиск команд" onClick={e=>{if(e.target===dialog.current)dialog.current.close();}}>
      <div><label><Search size={17}/><Input aria-label="Найти команду" placeholder="Найти раздел или действие…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&matches.length)run(matches[0][1]);}}/></label>
      {matches.map(([name,action])=><Button key={name} onClick={()=>run(action)}>{name}<ChevronRight size={14}/></Button>)}
      {!matches.length&&<p>Команды не найдены</p>}</div>
    </dialog></>;
}
