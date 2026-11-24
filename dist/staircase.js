// The indexed tread and balustrade geometry comes from the Perspective Loop GLB.
const vertex = `
attribute vec3 position, normal;
uniform float aspect, pitch, yaw, distance, targetY, framing;
uniform vec2 anchor;
varying vec3 worldPos, surfaceNormal;
varying float depth;
void main(){
  worldPos=position; surfaceNormal=normal;
  vec3 p=position-vec3(0.,targetY,0.);
  float lateral=cos(yaw)*p.x-sin(yaw)*p.z;
  float radial=sin(yaw)*p.x+cos(yaw)*p.z;
  float vertical=cos(pitch)*p.y+sin(pitch)*radial;
  depth=distance-(-sin(pitch)*p.y+cos(pitch)*radial);
  gl_Position=vec4(vec2(lateral/aspect,vertical)*framing+anchor*depth, depth*1.0004-.16,depth);
}`;
const fragment = `
precision highp float;
varying vec3 worldPos, surfaceNormal;
varying float depth;
void main(){
  vec3 n=normalize(surfaceNormal);
  vec3 sun=normalize(vec3(-.56,.76,.33));
  float key=max(dot(n,sun),0.);
  float side=max(dot(n,normalize(vec3(.64,.18,-.62))),0.);
  vec3 brass=mix(vec3(.40,.235,.115),vec3(.97,.79,.54),key*.78);
  float grooves=.96+.04*sin(worldPos.y*3.65+.5*sin(worldPos.x*1.7));
  float occlusion=mix(.55,1.,smoothstep(-1.,52.,worldPos.y));
  vec3 light=brass*(.24+key*.94+side*.20)*grooves*occlusion;
  light+=pow(max(dot(n,normalize(sun+vec3(.12,.9,.22))),0.),30.)*vec3(.28,.22,.14);
  gl_FragColor=vec4(light,1.);
}`;
const smooth=(a,b,p)=>{const v=Math.min(1,Math.max(0,(p-a)/(b-a)));return v*v*(3-2*v)};
function makeProgram(gl){
  const program=gl.createProgram();
  for(const [kind,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
    const shader=gl.createShader(kind);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program,shader);gl.deleteShader(shader);
  }
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  return program;
}
export async function initStairs(canvas){
  const gl=canvas.getContext('webgl',{alpha:true,antialias:true});
  if(!gl)return;
  const response=await fetch(new URL('assets/staircase.mesh',import.meta.url));
  if(!response.ok)throw Error('Staircase mesh unavailable');
  const mesh=await response.arrayBuffer(),[count,indexCount]=new Uint32Array(mesh,0,2);
  function bind(){
    const prog=makeProgram(gl);gl.useProgram(prog);
    for(const [i,name] of ['position','normal'].entries()){
      gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh,8+i*count*12,count*3),gl.STATIC_DRAW);
      const loc=gl.getAttribLocation(prog,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(mesh,8+count*24,indexCount),gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);return Object.fromEntries(['aspect','distance','pitch','yaw','targetY','anchor','framing'].map(k=>[k,gl.getUniformLocation(prog,k)]));
  }
  let u=bind();
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();u=null;canvas.classList.remove('ready')});
  canvas.addEventListener('webglcontextrestored',()=>{u=bind()});
  return (p,t)=>{
    if(!u)return;
    const a=smooth(0,.24,p),dive=smooth(.045,.35,p);
    const dpr=Math.min(devicePixelRatio,1.6),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);
    if(!w||!h)return;
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
    gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(u.aspect,w/h);gl.uniform1f(u.framing,Math.min(2.24,1.95*w/h));
    gl.uniform1f(u.pitch,-.80-.77*a);gl.uniform1f(u.yaw,.50+.52*dive+.024*Math.sin(t*.19));
    gl.uniform1f(u.targetY,32-31*dive);gl.uniform1f(u.distance,111-113*dive);
    const mobile=w/h<.86;gl.uniform2f(u.anchor,(mobile?.17:.39)*(1-a), (mobile?.35:.07)*(1-a)+.10*a);
    gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_SHORT,0);
    canvas.classList.add('ready');
  };
}
