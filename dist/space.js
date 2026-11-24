export function initSpace(canvas,foreground) {
  const ctx=canvas.getContext('2d'), sky=document.createElement('canvas');
  const dust=foreground.getContext('2d');
  let seed=144351, width=0,height=0;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const field=Float32Array.from({length:65536},random);
  function noise(x,y) {
    const a=Math.floor(x),b=Math.floor(y);let s=x-a,t=y-b;s=s*s*(3-2*s);t=t*t*(3-2*t);
    const n=(x,y)=>field[(x&255)+256*(y&255)];
    return (n(a,b)*(1-s)+n(a+1,b)*s)*(1-t)+(n(a,b+1)*(1-s)+n(a+1,b+1)*s)*t;
  }
  function cloud(x,y){let v=0,amp=.55;for(let i=0;i<6;i++){v+=noise(x,y)*amp;x=x*2.05+15;y=y*2.05-3;amp*=.5}return v}
  function resize(){
    width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio,1.6);
    canvas.width=width*dpr;canvas.height=height*dpr;foreground.width=canvas.width;foreground.height=canvas.height;dust.setTransform(dpr,0,0,dpr,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);
    sky.width=640;sky.height=Math.max(180,Math.min(850,Math.round(640*height/width)));
    const sc=sky.getContext('2d'),img=sc.createImageData(sky.width,sky.height);
    for(let y=0;y<sky.height;y++)for(let x=0;x<sky.width;x++){
      const u=x/sky.width,v=y/sky.height,warp=noise(u*5+18,v*4);
      const d=v-(.91-u*.67+(warp-.5)*.32);
      const a=cloud(u*8+warp*2,v*7),b=cloud(u*18+a*3,v*18+a*4);
      const density=Math.exp(-d*d/.021)*Math.pow(Math.max(0,a*.7+b*.45-.32),2)*175;
      const k=(y*sky.width+x)*4;img.data[k]=7+density*1.25;img.data[k+1]=7+density*.84;img.data[k+2]=8+density*.63;img.data[k+3]=255;
    }
    sc.putImageData(img,0,0);
  }
  const stars=Array.from({length:1600},()=>({x:random(),y:random(),z:random(),w:random(),phase:random()*6}));
  const nearStars=stars.slice(0,210);
  return (p,time,titleTime=0,flyThrough=0,scrollSpeed=0)=>{
    if(innerWidth!==width||innerHeight!==height)resize();
    // Near stars cross the galaxy plane as the camera follows the departing ship.
    dust.clearRect(0,0,width,height);
    const speed=Math.max(0,Math.min(1,(p-.67)/.20));
    if(speed>0){
      const surge=titleTime>0?Math.exp(-Math.pow((titleTime-2.03)/.55,2)):0;
      const distance=speed*speed+titleTime*.12+flyThrough*2.1;
      dust.lineCap='round';
      for(const s of nearStars){
        const z=.16+(((s.z-distance*.85)%1+1)%1);
        const x=(s.x-.5)*width*.94/z,y=(s.y-.5)*height*.94/z;
        const px=width*.49+x,py=height*.46+y;
        if(px<0||px>width||py<0||py>height)continue;
        const streak=(.018*Math.sin(Math.PI*speed)+(titleTime>0?.009+.052*surge:0)+.072*scrollSpeed)/z;
        dust.strokeStyle='rgba(228,221,205,'+speed*(.13+.49*s.w)+')';
        dust.lineWidth=Math.min(2,(.36+s.w*.5)/z);
        dust.beginPath();dust.moveTo(px,py);dust.lineTo(px+x*streak+.15,py+y*streak+.15);dust.stroke();
      }
    }
    ctx.drawImage(sky,0,0,width,height);
    for(const s of stars){
      const depth=(s.z+3-p*.88-flyThrough*.55)%1;const scale=1/(.36+depth*1.15);
      const x=(.62+(s.x-.62)*scale)*width,y=(.48+(s.y-.48)*scale)*height;
      if(x<0||y<0||x>width||y>height)continue;
      const opacity=(.22+s.w*.65)*(.89+.11*Math.sin(time*.3+s.phase));
      const r=(.22+Math.pow(s.w,7)*.9)*Math.min(scale,1.8);
      ctx.fillStyle=s.phase>4?'rgba(248,205,165,'+opacity+')':'rgba(214,218,219,'+opacity+')';
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
      if(s.w>.993){const glow=ctx.createRadialGradient(x,y,0,x,y,r*6);glow.addColorStop(0,'#f0c49066');glow.addColorStop(1,'#e6a78100');ctx.fillStyle=glow;ctx.fillRect(x-r*6,y-r*6,r*12,r*12)}
      if(p>.45&&p<.92){const streak=Math.sin((p-.45)/.47*Math.PI)*.009;ctx.strokeStyle='rgba(222,206,190,'+opacity*.43+')';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(x-width*.62)*streak,y+(y-height*.48)*streak);ctx.stroke()}
    }
  }
}
