import {Button} from "./components/ui/button";
import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {MACHINES,TYPES,ROUTES} from './engine.js';

const COLORS={running:0x29b894,setup:0xe9ae49,maintenance:0x559ee1,repair:0xec666d,idle:0x9baeb4,waiting:0x9baeb4,break:0x9baeb4};
const LAYOUT={press:[-10,-5],heat:[-5,-5],print:[0,-5],laser:[3.8,-5],rewind:[8,-5],grind:[-10,1],wash:[-4.5,1],chrome:[0,1],tef:[5,1],lube:[9,1],wrap:[-6,7],pack:[5,7]};
export default function Factory({flows,states,selected,onSelect,view}){

 const stateRef=useRef(states); stateRef.current=states;
 const [allFlows,setAllFlows]=useState(false);
 const host=useRef(),world=useRef(),pick=useRef(onSelect);pick.current=onSelect; const [error,setError]=useState(false);
 useEffect(()=>{
  let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{setError(true);return;}
  const scene=new THREE.Scene();renderer.setClearColor(0x000000,0);
  const camera=new THREE.PerspectiveCamera(36,1,.1,150);camera.position.set(20,22,24);
  const room=new RoomEnvironment(), pmrem=new THREE.PMREMGenerator(renderer), reflections=pmrem.fromScene(room,.04); scene.environment=reflections.texture; room.dispose(); pmrem.dispose(); renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
  host.current.appendChild(renderer.domElement);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,1);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.46;controls.minDistance=5;controls.maxDistance=60;controls.enablePan=true;
  scene.add(new THREE.HemisphereLight(0xffffff,0x888888,2.6));const sun=new THREE.DirectionalLight(0xffffff,3.6);sun.position.set(-12,22,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-22;sun.shadow.camera.right=22;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;sun.shadow.normalBias=.04;scene.add(sun);
  const material=(color,metalness=.1)=>new THREE.MeshStandardMaterial({color,roughness:.6,metalness});
  const white=material(0xe7e7e7,.3),navy=material(0x323234,.4),glass=material(0x282829,.4),metal=material(0xbbbbbb,.65);
  function box(parent,w,h,d,x,y,z,mat){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  const floorMaterial=new THREE.ShadowMaterial({opacity:.32});
  box(scene,180,.16,180,0,-.18,0,floorMaterial);
  const paint=material(0x444444), seam=material(0x171717);
  for(const z of [-2,4]) {
    box(scene,29,.012,.055,0,-.09,z,paint);
    box(scene,29,.012,.055,0,-.09,z+.65,paint);
  }
  for(let x=-30;x<=30;x+=5) box(scene,.018,.006,50,x,-.096,1,seam);
  const motion=[], reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const drumGeometry=new THREE.CylinderGeometry(1,1,1,24);
  function drum(parent,x,y,z,r,length,finish) {
    const shaft=new THREE.Mesh(drumGeometry,finish);
    shaft.scale.set(r,length,r);shaft.rotation.z=Math.PI/2;
    shaft.position.set(x,y,z);shaft.castShadow=true;parent.add(shaft);
    return shaft;
  }  const meshes={},lights={},rings={},pickable=[];
  for(const type of TYPES){const [x,z]=LAYOUT[type.id];const wrap=type.id==='wrap';const width=wrap?10.4:Math.min(type.count,3)*1.35+.32;const depth=wrap?3.2:type.count>3?3.2:1.8;box(scene,width,.1,depth,x,-.035,z+(!wrap&&type.count>3?.71:0),navy);}
  for(const m of MACHINES){
   const [lx,lz]=LAYOUT[m.type];let x=lx,z=lz;
   if(m.type==='wrap'){x+=((m.index%8)-3.5)*1.22;z+=(Math.floor(m.index/8)-.5)*1.45;}
   else {x+=((m.index%3)-Math.min(2,(TYPES.find(t=>t.id===m.type).count-1))/2)*1.35;z+=Math.floor(m.index/3)*1.42;}
   const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);g.userData.id=m.id;
   const small=m.type==='wrap',h=small?.75:m.type==='heat'?1.8:1.15,w=small?.82:1.02,d=small?.92:1.04;
   // Each cell is built around its working mechanism.
   box(g,w,.18,d,0,.12,0,navy);
   const roller=(y,z,r,length,finish)=>{
     const axle=new THREE.Group();
     axle.position.set(0,y,z);g.add(axle);
     drum(axle,0,0,0,r,length,finish);
     drum(axle,length/2,0,0,r*1.06,.028,metal);
     box(axle,.032,r*.15,r*1.65,length/2+.02,0,0,navy);
     motion.push({id:m.id,axle});
   };
   const post=(x,y,z,r,height,finish)=>{
     const column=drum(g,x,y,z,r,height,finish);
     column.rotation.z=0;
   };
   if(m.type==='press'){
     box(g,.92,.34,.84,0,.41,0,white);
     for(const x of [-.36,.36]) for(const z of [-.27,.27]) post(x,1,z,.055,.88,metal);
     box(g,.98,.25,.82,0,1.49,0,white);
     post(0,1.68,0,.19,.25,navy);
     const ram=box(g,.7,.15,.54,0,.97,0,metal);
     motion.push({id:m.id,ram,rest:ram.position.y});
   }else if(m.type==='heat'){
     box(g,.96,1.14,1.16,0,.8,0,white);
     box(g,.76,.62,.06,0,.76,.59,navy);
     for(const x of [-.28,0,.28]) box(g,.032,.55,.045,x,.76,.63,metal);
     post(-.25,1.62,-.3,.1,.65,metal);
     post(-.25,1.96,-.3,.15,.05,navy);
   }else if(['chrome','wash','tef','lube'].includes(m.type)){
     const radius=m.type==='lube'?.22:.36;
     post(0,.77,0,radius,1.02,metal);
     for(const y of [.35,.92,1.27]) post(0,y,0,radius+.026,.045,navy);
     post(0,1.36,0,.14,.15,white);
     post(.42,.73,0,.045,.95,metal);
     drum(g,.27,1.2,0,.045,.31,metal);
   }else if(m.type==='grind'){
     box(g,.96,.48,.98,0,.48,0,white);
     box(g,.9,.66,.32,0,1,-.29,navy);
     roller(.97,.08,.27,.24,metal);
     box(g,.79,.08,.36,0,.77,.31,metal);
     box(g,.86,.065,.65,0,1.38,-.05,white);
   }else if(['laser','pack'].includes(m.type)){
     box(g,.94,.44,.96,0,.43,0,white);
     for(const x of [-.4,.4])box(g,.09,.68,.74,x,.99,0,white);
     box(g,.88,.59,.045,0,1,.35,glass);
     box(g,.98,.13,.86,0,1.37,0,white);
     if(m.type==='laser') post(0,1.56,-.18,.12,.28,metal);
     else box(g,.66,.12,.54,0,.69,.52,navy);
   }else{
     box(g,w*.91,.38,d*.91,0,.41,0,white);
     for(const x of [-1,1]) box(g,.065,.5,.65,x*w*.38,.78,0,navy);
     roller(.89,-.18,m.type==='rewind'?.31:.19,w*.72,metal);
     roller(.78,.29,.095,w*.72,white);
     if(m.type==='print') box(g,.9,.15,.4,0,1.19,.2,white);
   }
   // Functional fittings differ by process, even on shared machine frames.
   if(m.type==='wash') {
     for(const z of [-.23,.23]) drum(g,0,1.32,z,.047,.77,metal);
   } else if(m.type==='chrome'){
     for(const x of [-.24,0,.24]) box(g,.037,.12,.68,x,1.3,0,metal);
   } else if(m.type==='tef'){
     for(const y of [.55,.68,.81]) post(0,y,0,.37,.038,white);
   } else if(m.type==='lube'){
     drum(g,.26,.42,.19,.14,.32,navy);
     post(.38,.67,.19,.036,.42,metal);
   } else if(m.type==='laser'){
     box(g,.68,.1,.13,0,1.16,0,metal);
     post(.08,1.02,0,.07,.21,navy);
   } else if(m.type==='pack'||m.type==='wrap'){
     for(const z of [.43,.54,.65]) drum(g,0,.665,z,.045,.62,metal);
   } else if(m.type==='press'){
     post(-.25,1.72,-.18,.086,.27,metal);
   } else if(m.type==='heat'){
     for(const y of [.45,.61,.77,.93]) box(g,.035,.05,.69,.49,y,0,navy);
   } else if(m.type==='grind'){
     post(-.34,.94,.24,.035,.39,metal);
     drum(g,-.23,1.13,.24,.035,.24,metal);
   } else if(m.type==='print'){
     drum(g,0,1.04,.1,.09,.59,navy);
   } else if(m.type==='rewind'){
     drum(g,-.34,.88,-.18,.34,.04,metal);
   }
   // Service-side drive cassette, visible through its inspection guard.
   const guard=new THREE.MeshPhysicalMaterial({color:0xdde2e4,metalness:.05,roughness:.16,transparent:true,opacity:.18,depthWrite:false});
   const driveSide=w*.52, driveY=m.type==='heat'?.85:.42;
   const sheave=(y,z,r)=>{
     drum(g,driveSide,y,z,r,.085,navy);
     drum(g,driveSide+.05,y,z,r*.79,.022,metal);
     drum(g,driveSide+.08,y,z,r*.33,.06,navy);
   };
   sheave(driveY,-.21,.14);
   sheave(driveY,.18,.14);
   for(const offset of [-.14,.14]) box(g,.056,.025,.39,driveSide,driveY+offset,-.015,navy);
   box(g,.022,.44,.79,driveSide+.13,driveY,0,guard);
   for(const z of [-.34,.34]) for(const sign of [-1,1])
     drum(g,driveSide+.15,driveY+sign*.184,z,.025,.032,metal);
   for(const x of [-1,1]) for(const z of [-1,1])
     post(x*w*.37,.044,z*d*.37,.079,.07,metal);
   box(g,.2,.22,.09,w*.37,.67,.48,navy);
   box(g,.14,.09,.012,w*.37,.71,.532,glass);   const statusMat=material(COLORS.idle);statusMat.emissiveIntensity=.85;const strip=box(g,w*.95,.075,.08,0,.25,d*.49,statusMat);lights[m.id]=statusMat;
   const ring=new THREE.Mesh(new THREE.RingGeometry(.65,.75,40),new THREE.MeshBasicMaterial({color:0x52ffdc,toneMapped:false,side:THREE.DoubleSide,transparent:true,opacity:.9}));ring.rotation.x=-Math.PI/2;ring.position.y=.035;ring.visible=false;g.add(ring);rings[m.id]=ring;
   const beacon=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),statusMat);beacon.position.set(w*.4,h+.3,0);g.add(beacon);
   const hit=box(g,w*1.15,h+1,d*1.1,0,(h+1)/2,0,new THREE.MeshBasicMaterial({visible:false}));hit.userData.id=m.id;pickable.push(hit);meshes[m.id]=g;
  }
  // Stage labels rendered as crisp, camera-facing sprites.
  for(const ty of TYPES){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=100;const ctx=canvas.getContext('2d');ctx.font='600 40px Arial';ctx.textAlign='center';ctx.fillStyle='#eeeeea';ctx.fillText(`${ty.name} · ${ty.count}`,256,55);const tx=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true,depthTest:false}));const [x,z]=LAYOUT[ty.id];sprite.position.set(x,.1,z-2);sprite.scale.set(4,.78,1);scene.add(sprite);}
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
  const onDown=e=>{down=[e.clientX,e.clientY];};
  const onUp=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const h=ray.intersectObjects(pickable)[0];if(h)pick.current(h.object.userData.id);};
  renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp);
  const resize=()=>{if(!host.current)return;const w=host.current.clientWidth,h=host.current.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;const f=Math.max(1,1.45/camera.aspect);camera.position.set(13*f,15*f,18*f);camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(host.current);resize();
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=96;
  const ctx=canvas.getContext('2d');
  const fade=ctx.createRadialGradient(48,48,0,48,48,48);
  fade.addColorStop(0,'rgba(160,255,238,1)');
  fade.addColorStop(.18,'rgba(72,255,219,.8)');
  fade.addColorStop(1,'rgba(42,248,212,0)');
  ctx.fillStyle=fade;ctx.fillRect(0,0,96,96);
  const halo=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  const selection=new THREE.Sprite(halo);
  selection.scale.setScalar(1.1);
  scene.add(selection);
  const routes=new Map();

  function createPulse(from,to){
    const a=from.position.clone().setY(1.25),b=to.position.clone().setY(1.25);
    const mid=a.clone().lerp(b,.5);mid.y+=Math.min(4,a.distanceTo(b)*.23);
    const curve=new THREE.QuadraticBezierCurve3(a,mid,b);
    const geometry=new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
    const trail=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0x76ffe0,transparent:true,toneMapped:false}));
    const pulse=new THREE.Sprite(halo);
    trail.visible=pulse.visible=false;
    scene.add(trail,pulse);
    return {curve,trail,pulse,started:performance.now()};
  }
  function removePulse({trail,pulse}){
    scene.remove(trail,pulse);
    trail.geometry.dispose();trail.material.dispose();
  }
  function animatePulse({curve,trail,pulse},age){
    const t=age/1150;
    pulse.visible=trail.visible=t<1 && !reduced.matches;
    if(!pulse.visible)return;
    const progress=Math.min(1,t/.74);
    const tail=Math.max(0,Math.floor((t/.74-.34)*64));
    trail.geometry.setDrawRange(tail,Math.max(0,1+Math.floor(64*progress)-tail));
    curve.getPoint(progress,pulse.position);
    trail.material.opacity=Math.min(1,(1-t)/.26);
    pulse.scale.setScalar(.85*trail.material.opacity);
  }  const colors={'А':0x65edd0,'Б':0x82b5ff,'В':0xffc274};
  const buffers=new Map();
  function bufferFor(stage,product){
    const key=stage+product;
    if(!buffers.has(key)){
      const [x,z]=LAYOUT[stage];
      const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.25),new THREE.MeshBasicMaterial({color:colors[product],wireframe:true}));
      marker.position.set(x+Object.keys(colors).indexOf(product)*.6-.6,1.25,z-1.3);
      scene.add(marker);buffers.set(key,marker);
    }
    const marker=buffers.get(key);marker.visible=true;return marker;
  }
  let detailed=false, currentKey=null, started=0;
  function syncRoutes(flows,showAll){
    if(detailed!==showAll){currentKey=null;started=0;} detailed=showAll;
    const needed=new Set();
    for(const marker of buffers.values())marker.visible=false;
    for(const link of flows.links){
      if(!detailed && (!link.source || !link.target))continue;
      const key=[link.product,link.from,link.to].join('/');
      needed.add(key);
      const from=meshes[link.source]||bufferFor(link.bufferStage,link.product);
      const to=meshes[link.target]||bufferFor(link.bufferStage,link.product);
      if(!routes.has(key)){
        const route=createPulse(from,to);
        route.trail.material.color.setHex(colors[link.product]);
        route.trail.material.opacity=.44;
        route.trail.visible=true;
        route.pulse.material=new THREE.SpriteMaterial({map:halo.map,color:colors[link.product],transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
        route.pulse.visible=true;
        route.phase=(routes.size*.618)%1;
        routes.set(key,route);
      }
      const entry=routes.get(key);
      entry.retired=false;
      entry.rate=link.rate;
      entry.trail.material.color.setHex(detailed?colors[link.product]:0x76ffe0);
      entry.pulse.material.color.setHex(detailed?colors[link.product]:0xffffff);
      entry.trail.visible=entry.pulse.visible=detailed;
      if(detailed){entry.trail.geometry.setDrawRange(0,65);entry.trail.material.opacity=.44;}
    }
    for(const [key,entry] of routes)if(!needed.has(key)){
      if(!detailed && key===currentKey){entry.retired=true;continue;}
      entry.pulse.material.dispose();removePulse(entry);routes.delete(key);
    }
  }
  let previousFrame=performance.now();
  function drawFlows(now){
    const dt=Math.min(.1,(now-previousFrame)/1000);previousFrame=now;
    if(!detailed){
      if(!routes.size)return;
      if(!routes.has(currentKey)||now-started>=1350){
        const keys=Array.from(routes.keys()),previous=routes.get(currentKey);
        const next=keys[(keys.indexOf(currentKey)+1)%keys.length];
        if(previous){
          previous.trail.visible=previous.pulse.visible=false;
          if(previous.retired){previous.pulse.material.dispose();removePulse(previous);routes.delete(currentKey);}
        }
        currentKey=next;started=now;
      }
      const active=routes.get(currentKey);
      if(active)animatePulse(active,now-started);
      return;
    }
    for(const entry of routes.values()){
      const strength=Math.min(1,Math.sqrt(entry.rate/2000));
      if(!reduced.matches)entry.phase=(entry.phase+dt*(.28+.55*strength))%1;
      entry.curve.getPoint(entry.phase,entry.pulse.position);
      entry.pulse.scale.setScalar(.45+.6*strength);
    }
  }
  let flight=null;
  const cancelFlight=()=>{flight=null;};
  controls.addEventListener('start',cancelFlight);
  function approach(machine){
    const target=machine.position.clone().setY(.8);
    const offset=camera.position.clone().sub(controls.target).normalize().multiplyScalar(6);
    flight={started:performance.now(),from:camera.position.clone(),aim:controls.target.clone(),target,end:target.clone().add(offset)};
  }
  function updateCamera(now){
    if(!flight)return;
    const t=reduced.matches?1:Math.min(1,(now-flight.started)/920);
    const eased=t*t*(3-2*t);
    camera.position.lerpVectors(flight.from,flight.end,eased);
    controls.target.lerpVectors(flight.aim,flight.target,eased);
    if(t===1)flight=null;
  }  let lastId; const transitions=new Set();
  function selectMachine(id){
    if(id===lastId || !meshes[id])return;
    const from=meshes[lastId],to=meshes[id];
    lastId=id; if(from)approach(to);
    selection.position.copy(to.position);selection.position.y=1.6;
    if(!from||reduced.matches)return;

    transitions.add(createPulse(from,to));
  }
  function drawTransition(now){
    drawFlows(now);
    for(const transition of transitions){animatePulse(transition,now-transition.started);if(!transition.pulse.visible){removePulse(transition);transitions.delete(transition);}}
  }let frame,last=performance.now();const loop=()=>{const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;updateCamera(now);drawTransition(now);for(const part of motion){if(reduced.matches || stateRef.current[part.id]?.status!=='running')continue;if(part.axle)part.axle.rotation.x+=dt*2.4;else {part.phase=(part.phase||0)+dt*4;part.ram.position.y=part.rest+.09*Math.sin(part.phase);}}frame=requestAnimationFrame(loop);controls.update();renderer.render(scene,camera);};loop();world.current={lights,rings,camera,controls,selectMachine,syncRoutes,cancelFlight};
  return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);scene.traverse(o=>{o.geometry?.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];for(const mat of ms){mat.map?.dispose();mat.dispose();}}});reflections.dispose();renderer.dispose();renderer.domElement.remove();world.current=null;};
 },[]);
 useEffect(()=>{if(!world.current)return;world.current.selectMachine(selected);world.current.syncRoutes(flows,allFlows);for(const m of MACHINES){world.current.lights[m.id].color.setHex(COLORS[states[m.id]?.status]||COLORS.idle);world.current.lights[m.id].emissive.copy(world.current.lights[m.id].color);world.current.rings[m.id].visible=m.id===selected;}},[states,selected,flows,allFlows]);
 useEffect(()=>{const w=world.current;if(!w)return;w.cancelFlight();const f=Math.max(1,1.45/w.camera.aspect);if(view==='top')w.camera.position.set(0,36*f,1.01);else w.camera.position.set(13*f,15*f,18*f);w.controls.target.set(0,0,1);w.controls.update();},[view]);
 return <div ref={host} className="factory-canvas" aria-label="Интерактивная 3D-схема 43 машин. Вращайте мышью, выберите машину нажатием."><div className="flow-caption" style={{pointerEvents:"auto"}}><Button type="button" aria-pressed={allFlows} onClick={()=>setAllFlows(value=>!value)} style={{background:allFlows?"#275648":"#272729",color:"white",border:"1px solid #555",borderRadius:4,padding:"4px 8px"}}>{allFlows?"✓ Все потоки":"Все потоки"}</Button>{allFlows && <> Потоки · <span style={{color:"#65edd0"}}>А</span> / <span style={{color:"#82b5ff"}}>Б</span> / <span style={{color:"#ffc274"}}>В</span> · ◇ запас</>}</div>{error&&<div className="webgl-fallback">3D недоступно в этом браузере. Выберите оборудование в списке справа; расчёты и расписание доступны.</div>}</div>;
}
