import {initOort} from './oort.js?v=cloud-release';
import {initStairs} from './staircase.js';
import {initFlight,galaxyCut} from './flight.js?v=cloud-arc';
import {initSpace} from './space.js';
const $=s=>document.querySelector(s), clamp=x=>Math.max(0,Math.min(1,x));
const scenes=[
  {at:0, name:'Spiral staircase',location:'Perspective loop',title:['The Spiral','Staircase.'],copy:'Look down the stairwell.<br>Now look up at the stars. Remember that curve.'},
  {at:.32,name:'Spiral echo',location:'φ ≈ 1.618',title:['A Spiral','Echo.'],copy:'A quarter turn. A little wider.<br>Out here, a galaxy echoes the curve of a stair.'},
  {at:.58,name:'Galaxy approach',location:'Whirlpool galaxy',title:['Galaxy','Approach.'],copy:'From the bridge, that light looks still.<br>Only the stars slipping past give us away.'},
  {name:'Beyond Space',cloud:.31},
  {name:'Particle title',cloud:.98}
];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const introRange=$('#intro-range'),oortRange=$('#oort-range');
const maxScroll=()=>introRange.offsetHeight-innerHeight;
const beyond=$('.beyond'),cloud=$('#oort-cloud');
let cloudRenderer,cloudProgress=0;
function cloudRange(){return maxScroll()*(1-galaxyCut)+oortRange.offsetHeight}
function go(i){
  const scene=scenes[i];
  const top=scene.cloud===undefined?scene.at*maxScroll():galaxyCut*maxScroll()+scene.cloud*cloudRange();
  window.scrollTo({top:Math.ceil(top),behavior:reduced.matches?'instant':'smooth'});
}
const menu=$('#menu'),dialog=$('dialog');
function chapterButton(s,i){
  const b=document.createElement('button'),n=String(i+1).padStart(2,'0');
  b.innerHTML='<small>'+n+'</small>'+s.name;
  b.onclick=()=>{if(dialog.open)dialog.close();go(i)};return b;
}
scenes.forEach((s,i)=>$('#menu-links').append(chapterButton(s,i)));
menu.onclick=()=>{dialog.showModal();menu.setAttribute('aria-expanded','true')};$('#close').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>menu.setAttribute('aria-expanded','false'));dialog.onclick=e=>{if(e.target===dialog&&e.clientX<dialog.getBoundingClientRect().left)dialog.close()};
$('.brand').onclick=e=>{e.preventDefault();go(0)};
const renderSpace=initSpace($('#space'),$('#flight-stars'));let renderStairs,renderFlight;
initStairs($('#stairs')).then(fn=>renderStairs=fn).catch(console.error);
initFlight($('#flight')).then(fn=>renderFlight=fn).catch(console.error);
let current=-1,p=clamp(scrollY/maxScroll()),last=0;const story=$('.story'),finale=$('.finale');
const credit=finale.querySelector('.coming');
$('#explore').onclick=()=>go(Math.min(current+1,3));
function frame(ms){
  requestAnimationFrame(frame);
  if(document.hidden){last=ms;return;}
  const previousProgress=p;
  const dt=Math.min(100,ms-last)/1000;last=ms;const target=clamp(scrollY/maxScroll());p+= (target-p)*(reduced.matches?1:1-Math.exp(-dt*12));if(Math.abs(p-target)<.0001)p=target;
  const cloudTarget=clamp((scrollY-maxScroll()*galaxyCut)/cloudRange());
  cloudProgress+=(cloudTarget-cloudProgress)*(reduced.matches?1:1-Math.exp(-dt*12));
  if(Math.abs(cloudTarget-cloudProgress)<.0001)cloudProgress=cloudTarget;
  const afterCut=p>=galaxyCut;
  const t=reduced.matches?0:ms*.001;
  cloud.hidden=!afterCut;
  if(!cloud.hidden){
    cloudRenderer??=initOort(cloud);
    cloudRenderer(cloudProgress,t,reduced.matches);
    cloud.style.opacity=1;
  }
  const copyOpacity=clamp((cloudProgress-.08)/.12)*(1-clamp((cloudProgress-.4)/.13));
  beyond.style.opacity=copyOpacity;
  beyond.inert=copyOpacity<.5;beyond.setAttribute('aria-hidden',String(beyond.inert));
  const inTitle=afterCut&&cloudProgress>=.85;
  renderSpace(p,t,0,cloudProgress*(reduced.matches?.2:1),Math.min(1,Math.abs(p-previousProgress)/Math.max(dt,.001)));
  const stairs=$('#stairs'),poster=$('#stair-poster');
  const opacity=1-clamp((p-.262)/.079);
  stairs.hidden=p>=.345;stairs.style.opacity=opacity;
  if(renderStairs&&!stairs.hidden)renderStairs(p,t);
  poster.style.opacity=stairs.classList.contains('ready')?0:opacity;
  poster.style.scale=String(1+24*p*p);
  const flight=$('#flight');flight.hidden=p<=.06;
  if(renderFlight&&!flight.hidden)renderFlight(p,t,afterCut?cloudProgress:-1);
  const i=inTitle?4:afterCut?3:p>=.54?2:p>=.27?1:0;
  if(i!==current){
    current=i;
    if(i<3){const s=scenes[i];$('#chapter').textContent='CHAPTER 0'+(i+1);$('#location').textContent=s.location;$('#headline').innerHTML=s.title[0]+'<br><em>'+s.title[1]+'</em>';$('#description').innerHTML=s.copy;$('#explore span:last-child').textContent=i?'Continue journey':'Scroll to explore'}
    story.inert=i===3;finale.setAttribute('aria-hidden',String(i!==3));
  }
  let alpha=1;
  for(const cut of [.27,.54,galaxyCut])alpha=Math.min(alpha,clamp(Math.abs(p-cut)/.043));
  const clearFrame=clamp((.67-p)/.075);
  story.inert=i===3||clearFrame===0;story.style.opacity=i<3?alpha*clearFrame:0;story.style.visibility=i<3?'visible':'hidden';finale.style.opacity=inTitle?1:0;credit.style.opacity=clamp((cloudProgress-.92)/.06);finale.setAttribute('aria-hidden',String(!inTitle));
}
requestAnimationFrame(frame);
