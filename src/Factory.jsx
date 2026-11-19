import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {MACHINES,TYPES} from './engine.js';

const COLORS={running:0x28b994,setup:0xe9ae49,maintenance:0x559ee1,repair:0xef6669,idle:0x9baeb4,waiting:0x9baeb4,break:0x9baeb4};
const LAYOUT={press:[-10,-5],heat:[-5,-5],print:[0,-5],laser:[3.8,-5],rewind:[8,-5],grind:[-10,1],wash:[-4.5,1],chrome:[0,1],tef:[5,1],lube:[9,1],wrap:[-6,7],pack:[5,7]};
export default function Factory({states,selected,onSelect,view}){
 const host=useRef(),world=useRef(),pick=useRef(onSelect);pick.current=onSelect; const [error,setError]=useState(false);
 useEffect(()=>{
  let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{setError(true);return;}
  const scene=new THREE.Scene();scene.background=new THREE.Color('#eaf0ef');scene.fog=new THREE.Fog('#eaf0ef',45,90);
  const camera=new THREE.PerspectiveCamera(36,1,.1,150);camera.position.set(20,22,24);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
  host.current.appendChild(renderer.domElement);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,1);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.46;controls.minDistance=18;controls.maxDistance=60;controls.enablePan=true;
  scene.add(new THREE.HemisphereLight(0xffffff,0x819c9b,2.6));const sun=new THREE.DirectionalLight(0xffffff,3.6);sun.position.set(-12,22,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-22;sun.shadow.camera.right=22;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;sun.shadow.normalBias=.04;scene.add(sun);
  const material=(color,metalness=.1)=>new THREE.MeshStandardMaterial({color,roughness:.6,metalness});
  const white=material(0xe7edec,.3),navy=material(0x314b58,.4),glass=material(0x2d6269,.4),metal=material(0xabbabc,.65);
  function box(parent,w,h,d,x,y,z,mat){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  const floor=box(scene,29,.3,19,0,-.28,1,material(0xd8e4e1));
  const grid=new THREE.GridHelper(29,29,0xb6c9c4,0xc8d7d2);grid.position.y=-.1;grid.scale.z=19/29;grid.position.z=1;scene.add(grid);
  // Deliberately schematic cells: no invented transport constraint or conveyor.
  const platforms={};for(const ty of TYPES){const [x,z]=LAYOUT[ty.id];const width=ty.id==='wrap'?11:ty.count>=5?4.8:ty.count>=3?3.7:3.1;platforms[ty.id]=box(scene,width,.08,ty.id==='wrap'?3.5:3.2,x,-.05,z,material(0xc6d9d3));}
  const meshes={},lights={},rings={},pickable=[];
  for(const m of MACHINES){
   const [lx,lz]=LAYOUT[m.type];let x=lx,z=lz;
   if(m.type==='wrap'){x+=((m.index%8)-3.5)*1.22;z+=(Math.floor(m.index/8)-.5)*1.45;}
   else {x+=((m.index%3)-Math.min(2,(TYPES.find(t=>t.id===m.type).count-1))/2)*1.35;z+=Math.floor(m.index/3)*1.42;}
   const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);g.userData.id=m.id;
   const small=m.type==='wrap',h=small?.75:m.type==='heat'?1.8:1.15,w=small?.82:1.02,d=small?.92:1.04;
   box(g,w,.17,d,0,.12,0,navy);box(g,w*.94,h,d*.88,0,h/2+.2,0,white);
   if(['grind','press','heat','pack'].includes(m.type)){box(g,w*.72,h*.48,.05,0,h*.6+.18,d*.45,glass);box(g,.19,.3,.08,w*.38,h*.75,d*.5,navy);box(g,.06,.08,.03,w*.38,h*.78,d*.55,material(0x4ee4b0));}
   else if(['wash','chrome','tef','lube'].includes(m.type)){const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,h*.65,20),metal);cylinder.position.set(0,h*.85,0);cylinder.castShadow=true;g.add(cylinder);box(g,.55,.12,.55,0,h*1.19,0,navy);}
   else {box(g,w*.85,.12,d*.65,0,h*.74+.2,d*.15,navy);const roll=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.5,20),metal);roll.rotation.z=Math.PI/2;roll.position.set(0,h+.34,0);g.add(roll);}
   const statusMat=material(COLORS.idle);const strip=box(g,w*.95,.075,.08,0,.25,d*.49,statusMat);lights[m.id]=statusMat;
   const ring=new THREE.Mesh(new THREE.RingGeometry(.65,.75,40),new THREE.MeshBasicMaterial({color:0x168e78,side:THREE.DoubleSide,transparent:true,opacity:.9}));ring.rotation.x=-Math.PI/2;ring.position.y=.035;ring.visible=false;g.add(ring);rings[m.id]=ring;
   const beacon=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),statusMat);beacon.position.set(w*.4,h+.3,0);g.add(beacon);
   const hit=box(g,w*1.15,h+1,d*1.1,0,(h+1)/2,0,new THREE.MeshBasicMaterial({visible:false}));hit.userData.id=m.id;pickable.push(hit);meshes[m.id]=g;
  }
  // Stage labels rendered as crisp, camera-facing sprites.
  for(const ty of TYPES){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=100;const ctx=canvas.getContext('2d');ctx.font='600 40px Arial';ctx.textAlign='center';ctx.fillStyle='#476059';ctx.fillText(`${ty.name} · ${ty.count}`,256,55);const tx=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true,depthTest:false}));const [x,z]=LAYOUT[ty.id];sprite.position.set(x,.1,z-2);sprite.scale.set(4,.78,1);scene.add(sprite);}
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
  const onDown=e=>{down=[e.clientX,e.clientY];};
  const onUp=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const h=ray.intersectObjects(pickable)[0];if(h)pick.current(h.object.userData.id);};
  renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp);
  const resize=()=>{if(!host.current)return;const w=host.current.clientWidth,h=host.current.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;const f=Math.max(1,1.45/camera.aspect);camera.position.set(20*f,22*f,24*f);camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(host.current);resize();
  let frame;const loop=()=>{frame=requestAnimationFrame(loop);controls.update();renderer.render(scene,camera);};loop();world.current={lights,rings,camera,controls};
  return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);scene.traverse(o=>{o.geometry?.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];for(const mat of ms){mat.map?.dispose();mat.dispose();}}});renderer.dispose();renderer.domElement.remove();world.current=null;};
 },[]);
 useEffect(()=>{if(!world.current)return;for(const m of MACHINES){world.current.lights[m.id].color.setHex(COLORS[states[m.id]?.status]||COLORS.idle);world.current.rings[m.id].visible=m.id===selected;}},[states,selected]);
 useEffect(()=>{const w=world.current;if(!w)return;const f=Math.max(1,1.45/w.camera.aspect);if(view==='top')w.camera.position.set(0,36*f,1.01);else w.camera.position.set(20*f,22*f,24*f);w.controls.target.set(0,0,1);w.controls.update();},[view]);
 return <div ref={host} className="factory-canvas" aria-label="Интерактивная 3D-схема 43 машин. Вращайте мышью, выберите машину нажатием.">{error&&<div className="webgl-fallback">3D недоступно в этом браузере. Выберите оборудование в списке справа; расчёты и расписание доступны.</div>}</div>;
}
