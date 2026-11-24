import {initStairs} from './staircase.js';
import {initFlight,titleCut} from './flight.js';
import {initSpace} from './space.js';
const $=s=>document.querySelector(s), clamp=x=>Math.max(0,Math.min(1,x));
const scenes=[
  {at:0, name:'Spiral staircase',location:'Perspective loop',title:['The Spiral','Staircase.'],copy:'Follow the steps inward. A golden spiral<br>traces the way into the stars.'},
  {at:.32,name:'Spiral echo',location:'φ ≈ 1.618',title:['A Spiral','Echo.'],copy:'A quarter turn grows the golden spiral by φ.<br>Its curve echoes the sweep of a galactic arm.'},
  {at:.58,name:'Galaxy approach',location:'Whirlpool galaxy',title:['Galaxy','Approach.'],copy:'Follow the Eldridge as it gathers speed<br>and turns toward the galactic core.'},
  {at:titleCut,name:'Title reveal'}
];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const maxScroll=()=>document.documentElement.scrollHeight-innerHeight;
function go(i){if(i===3&&current===3)revealTime=0;window.scrollTo({top:Math.ceil(scenes[i].at*maxScroll()),behavior:reduced.matches?'instant':'smooth'})}
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
let revealTime=0;
const lettering=finale.querySelector('h2'),credit=finale.querySelector('.coming');
const titleDuration=2.5;
function drawTitle(elapsed){
  const u=clamp(elapsed/titleDuration);
  // Perspective makes the lettering accelerate as it approaches the camera.
  const distance=Math.pow(1-u,1.65)*28;
  const arrival=1/(1+distance);
  const idle=reduced.matches?0:Math.max(0,elapsed-titleDuration);
  const scale=arrival*(1+.017*Math.sin(idle*.7));
  lettering.style.transform='perspective(850px) translateY('+((1-arrival)*-19+2*Math.sin(idle*.6))+'px) rotateZ('+(-5*(1-arrival))+'deg) scale('+scale+')';
  lettering.style.filter='brightness('+(1+.95*(1-arrival))+')';
  const glow=12+24*(1-arrival)+4*Math.sin(idle*.9);
  lettering.style.textShadow='0 0 '+glow+'px rgba(255,203,139,.55),0 2px 18px #150e09';
  credit.style.opacity=clamp((elapsed-titleDuration+.16)/.67);
}
$('#explore').onclick=()=>go(Math.min(current+1,3));
function frame(ms){
  requestAnimationFrame(frame);
  if(ms-last<23)return;
  const previousProgress=p;
  const dt=Math.min(100,ms-last)/1000;last=ms;const target=clamp(scrollY/maxScroll());p+= (target-p)*(reduced.matches?1:1-Math.exp(-dt*12));if(Math.abs(p-target)<.0001)p=target;
  const t=reduced.matches?0:ms*.001;
  const inTitle=p>=titleCut;
  if(inTitle&&current!==3)revealTime=0;
  if(inTitle&&!document.hidden)revealTime+=dt;
  if(inTitle)drawTitle(revealTime);
  const flyThrough=clamp((p-titleCut)/(1-titleCut));
  const previousFlight=clamp((previousProgress-titleCut)/(1-titleCut));
  const motion=reduced.matches?.28:1;
  renderSpace(p,t,inTitle&&!reduced.matches?revealTime:0,flyThrough*motion,
    Math.min(1,Math.abs(flyThrough-previousFlight)/dt)*motion);
  const stairs=$('#stairs'),poster=$('#stair-poster');
  const opacity=1-clamp((p-.262)/.079);
  stairs.hidden=p>=.345;stairs.style.opacity=opacity;
  if(renderStairs&&!stairs.hidden)renderStairs(p,t);
  poster.style.opacity=stairs.classList.contains('ready')?0:opacity;
  poster.style.scale=String(1+24*p*p);
  const flight=$('#flight');flight.hidden=p<=.06;
  if(renderFlight&&!flight.hidden)renderFlight(p,t);
  const i=p>=titleCut?3:p>=.54?2:p>=.27?1:0;
  if(i!==current){
    current=i;
    if(i<3){const s=scenes[i];$('#chapter').textContent='CHAPTER 0'+(i+1);$('#location').textContent=s.location;$('#headline').innerHTML=s.title[0]+'<br><em>'+s.title[1]+'</em>';$('#description').innerHTML=s.copy;$('#explore span:last-child').textContent=i?'Continue journey':'Scroll to explore'}
    story.inert=i===3;finale.setAttribute('aria-hidden',String(i!==3));
  }
  let alpha=1;
  for(const cut of [.27,.54,titleCut])alpha=Math.min(alpha,clamp(Math.abs(p-cut)/.043));
  const clearFrame=clamp((.67-p)/.075);
  story.inert=i===3||clearFrame===0;story.style.opacity=i<3?alpha*clearFrame:0;story.style.visibility=i<3?'visible':'hidden';finale.style.opacity=i===3?1:0;
}
requestAnimationFrame(frame);
