// A cutaway leaves the nucleus and the denser inner cloud visible from the camera.
export function initOort(canvas) {
  const ctx = canvas.getContext('2d');
  const layers = Array.from({length: 6}, () => []);
  const palette = ['#455464', '#728391', '#969fa5', '#c2cbd1', '#e5e4dc', '#d0ad80'];
  const titlePalette=['#ccb49a','#deccb3','#e9dbc7','#efe5d5','#fff4dc','#d7ad7f'];
  const rgb=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  const colors=palette.map((color,i)=>[rgb(color),rgb(titlePalette[i])]);
  let seed = 81372;
  const random = () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;
  let count=0;
  function particle(x,y,z,size,layer) {
    layers[layer].push({x,y,z,size,id:count++,driftX:random()*2-1,driftY:random()*2-1,delay:random()*.12});
  }
  for (let i=0;i<17800;i++) {
    const az = random()*Math.PI*2, y = 2*random()-1, horizontal = Math.sqrt(1-y*y);
    const x = horizontal*Math.cos(az), z = horizontal*Math.sin(az);
    if (z>0 && x<.15*z) continue;
    const radius = .66+.34*Math.pow(random(),.38);
    particle(x*radius,y*radius,z*radius,.35+random()**3*1.15,Math.floor(random()**1.7*5));
  }
  // Denser bands on the two radial faces describe the thickness of the shell.
  for(let i=0;i<3400;i++){
    const a=random()*Math.PI*2, r=.68+.32*random();
    const edge=random()<.5?Math.atan2(1,.15):Math.PI;
    const rim=Math.abs(Math.cos(a))*r;
    particle(rim*Math.cos(edge),r*Math.sin(a),rim*Math.sin(edge),.38+random()*.6,1+Math.floor(random()*3));
  }
  for(let i=0;i<3800;i++){
    const az=random()*2*Math.PI,r=.058+.65*random()**.74;
    particle(r*Math.cos(az),(random()-.5)*r*.135,r*Math.sin(az),.4+random()*.7,random()<.09?5:Math.floor(random()*5));
  }
  function ease(a,b,value){
    const u=Math.min(1,Math.max(0,(value-a)/(b-a)));
    return u*u*(3-2*u);
  }

  // Sample the actual display lettering once. Each cloud particle keeps one
  // destination for the entire sequence, including when scroll reverses.
  let maskWidth,maskHeight,titleSampleVersion=0;
  function sampleTitle(){
    const mask=document.createElement('canvas');
    const m=mask.getContext('2d',{willReadFrequently:true});
    const heading=document.querySelector('.finale h2');
    const font='900 expanded 120px '+getComputedStyle(heading).fontFamily;
    m.font=font;
    const text=heading.textContent, bounds=m.measureText(text);
    mask.width=Math.ceil(bounds.width)+8;
    mask.height=Math.ceil(bounds.actualBoundingBoxAscent+bounds.actualBoundingBoxDescent)+8;
    m.font=font;m.fillStyle='#fff';m.fillText(text,4,4+bounds.actualBoundingBoxAscent);
    const data=m.getImageData(0,0,mask.width,mask.height).data;
    const letterPixels=[];
    for(let pixel=0;pixel<data.length/4;pixel++){
      if(data[pixel*4+3]>160)letterPixels.push(pixel);
    }
    maskWidth=mask.width;maskHeight=mask.height;
    for(const layer of layers){
      for(const pt of layer){
        const pixel=letterPixels[Math.floor(((pt.id*.61803398875)%1)*letterPixels.length)];
        pt.letterX=pixel%maskWidth-maskWidth*.5;
        pt.letterY=Math.floor(pixel/maskWidth)-maskHeight*.5;
      }
    }
    titleSampleVersion++;
  }
  sampleTitle();
  if(document.fonts.status==='loading')document.fonts.ready.then(sampleTitle);
  let paintedTitleVersion=-1;

  return function render(progress,time,reduced) {
    const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,1.65);
    if(!w||!h)return;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);paintedTitleVersion=-1;
    }
    const settled=progress>=.981;
    if(settled&&paintedTitleVersion===titleSampleVersion)return;
    paintedTitleVersion=settled?titleSampleVersion:-1;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const narrow=w/h<1.05;
    const radius=Math.min(w*(narrow?.445:.285),h*(narrow?.285:.41))*(.89+.22*progress);
    const cx=w*(narrow?.51:.69),cy=h*(narrow?.36:.49);
    const angle=.28+progress*(reduced?.22:.9)+(reduced?0:.055*Math.sin(time*.14));
    const ca=Math.cos(angle),sa=Math.sin(angle),tilt=.15+.14*progress,ct=Math.cos(tilt),st=Math.sin(tilt);
    const titleWidth=Math.min(w*.91,1400,h*2.6);
    const titleScale=titleWidth/maskWidth,titleY=h*.47;
    const morph=ease(.63,.94,progress);
    for(let layer=0;layer<layers.length;layer++){
      const [start,end]=colors[layer];
      ctx.fillStyle='rgb('+start.map((v,i)=>Math.round(v+(end[i]-v)*morph)).join(',')+')';
      for(const pt of layers[layer]){
        const x=pt.x*ca-pt.z*sa,z=pt.x*sa+pt.z*ca;
        const y=pt.y*ct-z*st,depth=z*ct+pt.y*st;
        const perspective=3.8/(3.8-depth),s=Math.max(.45,pt.size*radius/285)*perspective;
        const gather=ease(pt.delay,.26+pt.delay,progress);
        let px=cx+x*radius*perspective+(1-gather)*pt.driftX*w*.91;
        let py=cy-y*radius*perspective+(1-gather)*pt.driftY*h*.91;
        const align=ease(.605+pt.delay,.86+pt.delay,progress);
        let dot=s;
        if(align>0){
          const tx=w*.5+pt.letterX*titleScale;
          const ty=titleY+pt.letterY*titleScale;
          const arc=4*align*(1-align)*(reduced?.035:.18);
          px+=(tx-px)*align+pt.driftY*arc*radius;
          py+=(ty-py)*align-pt.driftX*arc*radius;
          dot+=(Math.max(.65,titleWidth*.00125)-s)*align;
        }
        ctx.fillRect(px,py,dot,dot);
      }
    }
    ctx.globalAlpha=1-ease(.56,.74,progress);
    const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,radius*.16);
    glow.addColorStop(0,'#fff6d8');glow.addColorStop(.048,'#ffe6ac');
    glow.addColorStop(.16,'#e8aa64aa');glow.addColorStop(.55,'#db934323');glow.addColorStop(1,'#db934300');
    ctx.fillStyle=glow;ctx.fillRect(cx-radius*.16,cy-radius*.16,radius*.32,radius*.32);ctx.globalAlpha=1;
  };
}
