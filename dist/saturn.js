// Analytic ray intersections let both sides of the tilted ring plane occlude
// the atmosphere correctly as the camera moves through it.
const vertexSource = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0., 1.); }
`;

const fragmentSource = `
precision highp float;
uniform vec2 resolution;
uniform float progress;
uniform float seconds;
uniform sampler2D atmosphere;
uniform sampler2D rings;

const vec3 pole = vec3(0., .96639, .25708);
const vec3 sun = vec3(-.766, .527, .368);
const float shape = .162;
const float inf = 1.e5;

float sphere(vec3 o, vec3 d) {
    float od = dot(o,pole), dd = dot(d,pole);
    float a = 1. + shape*dd*dd;
    float b = dot(o,d) + shape*od*dd;
    float c = dot(o,o) + shape*od*od - 1.;
    float disc = b*b-a*c;
    if (disc < 0.) return inf;
    float h = (-b-sqrt(disc))/a;
    return h > .002 ? h : inf;
}
vec4 ringSample(float r) {
    if (r < 1.14 || r > 2.68) return vec4(0.);
    return texture2D(rings,vec2((r-1.14)/1.54,.5));
}
void main() {
    vec2 uv = gl_FragCoord.xy/resolution;
    float aspect = resolution.x/resolution.y;
    float compact = 1.-smoothstep(.83,1.35,aspect);
    float travel = clamp(progress/.38,0.,1.);
    float drive = travel*travel*(2.-travel);
    vec2 center = mix(vec2(.687,.505), vec2(.685,.59), compact);
    float radius = mix(.236, min(.22, aspect*.334),compact);
    vec2 q = (uv-center)*vec2(aspect,1.)/radius;
    float ang = mix(.31,.40,compact) + .072*drive;
    q = mat2(cos(ang),-sin(ang),sin(ang),cos(ang))*q;
    vec3 eye = vec3(-2.07*drive,.07*drive,7.2 - 8.4*drive);
    vec3 ray = normalize(vec3(q/7.2,-1.));
    float sphereT = sphere(eye,ray);
    float ringT = -dot(eye,pole)/dot(ray,pole);
    float alpha = 0.;
    vec3 color = vec3(0.);
    if (sphereT < inf) {
        vec3 p = eye + ray*sphereT;
        vec3 n = normalize(p+pole*shape*dot(p,pole));
        float latitude = asin(clamp(dot(normalize(p),pole),-1.,1.))/3.141593 + .5;
        float longitude = atan(dot(p,vec3(0.,-pole.z,pole.y)),p.x)/6.283185 + .5;
        vec3 albedo = texture2D(atmosphere,vec2(fract(longitude+.00048*seconds),latitude)).rgb;
        float diffuse = dot(n,sun);
        float incidence = max(diffuse,0.);
        float ringShadowT = -dot(p,pole)/dot(sun,pole);
        float sunVisibility = 1.;
        if (ringShadowT > .0) {
            vec3 hit = p+ringShadowT*sun;
            sunVisibility -= .69*ringSample(length(hit)).a;
        }
        float softLight = pow(max(diffuse+.075,0.)/1.075,.74)*sunVisibility;
        color = albedo*(vec3(.077,.080,.089)+softLight*vec3(1.47,1.28,1.06));
        float facing = max(dot(n,-ray),0.);
        float scatter = pow(1.-facing,4.2)*pow(max(diffuse+.34,0.),.63);
        color += vec3(.295,.201,.103)*scatter;
        alpha = 1.;
    }
    if (ringT > 0. && ringT < sphereT) {
        vec3 p = eye+ringT*ray;
        vec4 ring = ringSample(length(p));
        if (ring.a > .001) {
            vec3 along = p-sun*dot(p,sun);
            float shadow = 1.;
            if (dot(p,sun)<0.) shadow = mix(.16,1.,smoothstep(.92,1.085,length(along)));
            float sunSide = .88+.22*dot(normalize(p),sun);
            vec3 ringColor = ring.rgb*shadow*sunSide*vec3(1.35,1.23,1.08);
            float opacity = min(.991,1.-pow(1.-ring.a,.91/max(.12,abs(dot(ray,pole)))));
            color = ringColor*opacity + color*(1.-opacity);
            alpha = opacity + alpha*(1.-opacity);
        }
    }
    float fade = 1.-smoothstep(.275,.38,progress);
    gl_FragColor = vec4(color*fade,alpha*fade);
}
`;

function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

function loadTexture(gl, unit, file, color) {
    const texture = gl.createTexture();
    function bind() {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
    }
    bind();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(color));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const image = new Image();
    image.onload = () => {
        bind();
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    };
    image.src = new URL(file,import.meta.url).href;
}

export function initSaturn(canvas) {
    const gl = canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,premultipliedAlpha:true});
    if (!gl) return fallback(canvas);
    const program = gl.createProgram();
    gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,vertexSource));
    gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) return fallback(canvas);
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program,'aPosition');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    const location = name => gl.getUniformLocation(program,name);
    const uniforms = ['resolution','progress','seconds'].map(location);
    gl.uniform1i(location('atmosphere'),0);
    gl.uniform1i(location('rings'),1);
    loadTexture(gl,0,'./assets/saturn-atmosphere.webp',[175,145,110,255]);
    loadTexture(gl,1,'./assets/saturn-rings.png',[170,145,115,120]);
    let cleared = false;
    return (progress,seconds) => {
        if (progress >= .38) {
            if (!cleared) gl.clear(gl.COLOR_BUFFER_BIT);
            cleared = true;
            return;
        }
        cleared = false;
        const ratio = Math.min(window.devicePixelRatio || 1,1.65,2300/Math.max(1,canvas.clientWidth));
        const width = Math.max(1,Math.round(canvas.clientWidth*ratio));
        const height = Math.max(1,Math.round(canvas.clientHeight*ratio));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width=width;
            canvas.height=height;
            gl.viewport(0,0,width,height);
        }
        gl.uniform2f(uniforms[0],width,height);
        gl.uniform1f(uniforms[1],progress);
        gl.uniform1f(uniforms[2],seconds);
        gl.drawArrays(gl.TRIANGLES,0,3);
    };
}

function fallback(canvas) {
    const image = new Image();
    image.src = new URL('./assets/saturn-still.webp',import.meta.url).href;
    image.alt = '';
    Object.assign(image.style,{position:'absolute',pointerEvents:'none',maxWidth:'none',height:'auto'});
    canvas.after(image);
    return progress => {
        const aspect = canvas.clientWidth/Math.max(1,canvas.clientHeight);
        const compact = Math.min(1,Math.max(0,(1.35-aspect)/.52));
        const radius = (1-compact)*.236+compact*Math.min(.22,aspect*.334);
        image.style.width = (canvas.clientHeight*radius*5.7)+'px';
        image.style.left = (68.7+progress*46)+'%';
        image.style.top = (49.5-compact*8.5)+'%';
        image.style.transform = 'translate(-50%,-50%) scale('+(1+7*progress*progress)+')';
        image.style.opacity = Math.min(1,Math.max(0,(.38-progress)/.105));
    };
}
