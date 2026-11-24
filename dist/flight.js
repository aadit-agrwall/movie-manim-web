const asset = name => new URL('./assets/' + name, import.meta.url).href;
const clamp = v => Math.min(1, Math.max(0, v));
function smooth(a, b, value) {
  const t = clamp((value - a) / (b - a));
  return t * t * (3 - 2 * t);
}
export const titleCut=.85;
function galaxyDistance(p){
  return 69-54*Math.pow(clamp((p-.30)/(titleCut-.30)),2);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image failed to load: ' + file));
    image.src = asset(file);
  });
}
function frame(canvas, progress) {
  const opacity = progress>=titleCut ? 0 : smooth(.065,.155,progress);
  canvas.style.opacity = String(opacity);
  if (opacity < .001) return false;
  const dpr = Math.min(devicePixelRatio || 1, 1.6);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (w !== canvas.width || h !== canvas.height) {
    canvas.width = w;
    canvas.height = h;
  }
  return w && h;
}
const common = `
  precision highp float;
  uniform float aspect, travel, chase, shotTime, mobile, progress;
  mat2 rotate(float a){return mat2(cos(a),sin(a),-sin(a),cos(a));}
  vec3 galaxyPoint(vec2 point){
    vec3 pos=vec3(point.x*30.,point.y*16.,0.);
    pos.yz=rotate(-.36+.18*chase)*pos.yz;
    pos.xy=rotate(.28+.12*chase)*pos.xy;
    pos*=mix(1.,.70,mobile);
    pos+=vec3(mix(6.,1.1,mobile)*(1.-chase),2.8*(1.-chase),-69.+travel);
    return pos;
  }
  vec4 project(vec3 p){
    p.xy = rotate(-.035-.085*chase)*p.xy;
    float d = -p.z;
    return vec4(p.x*2.25/aspect, p.y*2.25, d*1.00004-0.12, d);
  }`;
const galaxyVertex = `attribute vec2 corner; varying vec2 uv;` + common + `
  void main(){
    uv=corner*.5+.5;
    vec3 pos=galaxyPoint(corner);
    gl_Position=project(pos);
  }`;
const galaxyFragment = `precision highp float;
  varying vec2 uv;uniform sampler2D galaxy, guide; uniform float progress;
  void main(){
    vec3 c=texture2D(galaxy,uv).rgb;
    vec2 edge=min(uv,1.-uv);
    float feather=smoothstep(.0,.13,min(edge.x,edge.y));
    c=pow(c,vec3(1.09))*vec3(1.12,1.03,1.1)*feather;
    vec4 pattern=texture2D(guide,uv);
    float reveal=1.-smoothstep(.46,.56,progress);
    c*=smoothstep(.218,.338,progress);
    c=mix(c,pattern.rgb,pattern.a*reveal*.96);
    gl_FragColor=vec4(c, max(c.r,max(c.g,c.b)));
  }`;
const shipVertex = `attribute vec4 modelVertex; varying vec3 surface; varying float material;` + common + `
  void main(){
    vec3 pos=modelVertex.xyz/1500.;
    material=modelVertex.w;
    pos.z-=3.3;
    float shipScale=mix(.12,.085,mobile);
    float turn=smoothstep(.58,.705,progress);
    float launch=smoothstep(.713,.858,progress);
    pos*=shipScale;
    pos.xz=rotate(mix(-1.94-.90*chase,-3.14159,turn))*pos.xz;
    pos.yz=rotate(mix(-.37+.17*chase,-.038,turn))*pos.yz;
    pos.xy=rotate((.1+.15*sin(chase*3.)+.02*sin(shotTime*.32))*(1.-turn))*pos.xy;
    vec3 side=vec3(mix(-.92,.0,mobile)*(1.-chase)+.55*chase,
      -.78+.14*sin(shotTime*.39)-.1*chase,-5.1+1.4*sin(chase*3.14)-18.*pow(chase,4.));
    // Clear the stern while filling the frame, then close the gap to M51.
    float clearance=shipScale*min(4.8,6.0/aspect);
    vec3 closeup=vec3(0.,-.025,-15.41*shipScale-clearance);
    vec3 nucleus=galaxyPoint(vec2(2.*790./2048.-1.,1.-2.*524./1024.));
    // Continue along the sightline to M51 until the hull is a pinprick.
    vec3 destination=nucleus*(980./-nucleus.z);
    pos+=mix(mix(side,closeup,turn),destination,launch*launch*launch);
    surface=pos;gl_Position=project(pos);
  }`;
const shipFragment = `#extension GL_OES_standard_derivatives : enable
  precision highp float; uniform float progress; varying vec3 surface; varying float material;
  void main(){
    vec3 n=normalize(cross(dFdx(surface),dFdy(surface)));
    vec3 eye=normalize(-surface);
    if(dot(n,eye)<0.)n=-n;
    vec3 key=normalize(vec3(-.54,.73,.42));
    float warm=max(0.,dot(n,key)),cool=max(0.,dot(n,normalize(vec3(-.75,-.22,.30))));
    float rim=pow(1.-max(0.,dot(n,eye)),3.);
    float metal=material<.5?1.:.80;
    vec3 color=(vec3(.075,.085,.10)+warm*vec3(.70,.62,.53)+cool*vec3(.14,.22,.31))*metal;
    color+=rim*vec3(.08,.10,.15)+pow(max(0.,dot(reflect(-key,n),eye)),17.)*.16;
    float opacity=smoothstep(.23,.36,progress);gl_FragColor=vec4(color*opacity,opacity);
  }`;
function program(gl, vs, fs) {
  const result = gl.createProgram();
  for (const [kind, source] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const shader = gl.createShader(kind);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(result, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(result);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result));
  return result;
}
function setup(gl, mesh, image, pattern) {
  const galaxy = program(gl, galaxyVertex, galaxyFragment);
  const ship = program(gl, shipVertex, shipFragment);
  function buffer(type, value) {
    const b = gl.createBuffer();
    gl.bindBuffer(type, b);
    gl.bufferData(type, value, gl.STATIC_DRAW);
    return b;
  }
  const header = new Uint32Array(mesh, 0, 2);
  const vertices = buffer(gl.ARRAY_BUFFER, new Int16Array(mesh, 8, header[0] * 4));
  const indices = buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh, 8 + header[0] * 8, header[1]));
  const corners = buffer(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]));
  gl.useProgram(galaxy);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  for(const [unit,source] of [image,pattern].entries()){
    gl.activeTexture(gl.TEXTURE0+unit);
    gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.uniform1i(gl.getUniformLocation(galaxy,unit?'guide':'galaxy'),unit);
  }
  gl.clearColor(0,0,0,0);
  const attributes = [gl.getAttribLocation(galaxy, 'corner'), gl.getAttribLocation(ship, 'modelVertex')];
  const keys = ['aspect','travel','chase','shotTime','mobile','progress'];
  const programs = [galaxy,ship].map(prog => ({
    prog, locations: keys.map(key => gl.getUniformLocation(prog, key))
  }));
  return (p, t) => {
    const w=gl.drawingBufferWidth, h=gl.drawingBufferHeight;
    const chase=smooth(.36,.96,p);
    const travel=69-galaxyDistance(p);
    const values=[w/h, travel, chase, t, 1-smooth(.62,1.25,w/h),p];
    gl.viewport(0,0,w,h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for(let i=0;i<2;i++){
      if(i===1 && p<=.23)continue;
      gl.useProgram(programs[i].prog);
      programs[i].locations.forEach((loc,j)=>gl.uniform1f(loc,values[j]));
      const a=attributes[i];gl.enableVertexAttribArray(a);
      if(i===0){
        gl.disable(gl.DEPTH_TEST);
        gl.bindBuffer(gl.ARRAY_BUFFER,corners);
        gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      } else {
        gl.enable(gl.DEPTH_TEST);
        gl.bindBuffer(gl.ARRAY_BUFFER,vertices);
        gl.vertexAttribPointer(a,4,gl.SHORT,false,8,0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);
        gl.drawElements(gl.TRIANGLES,header[1],gl.UNSIGNED_SHORT,0);
      }
      gl.disableVertexAttribArray(a);
    }
  };
}
async function fallback(canvas, galaxyImage, pattern) {
  const [image,stern]=await Promise.all(['eldridge-profile.webp','eldridge-stern.webp'].map(loadImage));
  // A context already bound to WebGL cannot be rebound to a 2D context.
  const replacement = canvas.cloneNode(false);
  canvas.replaceWith(replacement);
  const g = replacement.getContext('2d');
  return (p,t) => {
    if(!frame(replacement,p))return;
    const w=replacement.width,h=replacement.height, chase=smooth(.36,.96,p);
    g.clearRect(0,0,w,h);
    g.save();g.translate(w*(.54-.02*chase),h*.43);g.rotate(-.24-.12*chase);
    const width=Math.min(w*1.4,h*1.1)*69/galaxyDistance(p);
    g.globalCompositeOperation='screen';g.globalAlpha=smooth(.218,.338,p);
    g.drawImage(galaxyImage,-width*.5,-width*.25,width,width*.5);
    g.globalAlpha=1-smooth(.46,.56,p);g.drawImage(pattern,-width*.5,-width*.25,width,width*.5);g.restore();
    const turn=smooth(.58,.705,p),launch=smooth(.713,.858,p)**2;
    const angle=-.24-.12*chase;
    const dx=(790/2048-.5)*width,dy=(524/1024-.5)*width*.5;
    const coreX=w*(.54-.02*chase)+dx*Math.cos(angle)-dy*Math.sin(angle);
    const coreY=h*.43+dx*Math.sin(angle)+dy*Math.cos(angle);
    const x=(1-turn)*w*(.42+.09*chase)+turn*w*.5;
    const y=(1-turn)*h*(.66+.006*Math.sin(t*.4))+turn*h*.5;
    g.save();g.translate(x+(coreX-x)*launch,y+(coreY-y)*launch);
    const sideWidth=Math.min(w*.8,h*.75)*(1-.80*chase*chase);
    const rearWidth=Math.max(w*1.16,h*stern.width/stern.height);
    const nearWidth=sideWidth+(rearWidth-sideWidth)*turn;
    const apparentWidth=nearWidth/(1+launch*launch*nearWidth/(2*devicePixelRatio));
    g.rotate((-.18-.32*chase)*(1-turn));g.scale(-1,1);
    g.globalAlpha=smooth(.23,.36,p)*(1-turn);
    g.drawImage(image,-apparentWidth/2,-apparentWidth*image.height/image.width/2,apparentWidth,apparentWidth*image.height/image.width);
    g.globalAlpha=turn;g.drawImage(stern,-apparentWidth/2,-apparentWidth*stern.height/stern.width/2,apparentWidth,apparentWidth*stern.height/stern.width);g.restore();
  };
}
export async function initFlight(canvas) {
  const [galaxyImage,pattern]=await Promise.all(['whirlpool.webp','whirlpool-guide.png'].map(loadImage));
  const gl = canvas.getContext('webgl', {alpha:true, antialias:true, premultipliedAlpha:true});
  if(!gl || !gl.getExtension('OES_standard_derivatives'))return fallback(canvas,galaxyImage,pattern);
  try {
    const response=await fetch(asset('eldridge.mesh'));
    if(!response.ok)throw new Error('Unable to load the ship mesh');
    const mesh=await response.arrayBuffer();
    let draw=setup(gl,mesh,galaxyImage,pattern);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();draw=null;});
    canvas.addEventListener('webglcontextrestored',()=>{gl.getExtension('OES_standard_derivatives');draw=setup(gl,mesh,galaxyImage,pattern);});
    return (progress,time)=>{if(frame(canvas,progress))draw?.(progress,time);};
  } catch(error) {
    console.warn('Using rendered flight assets.',error);
    return fallback(canvas,galaxyImage,pattern);
  }
}
