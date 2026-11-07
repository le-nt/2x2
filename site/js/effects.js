/* 2x2 effects: no network dependencies. UI audio begins only after a user gesture. */
(() => {
  'use strict';
  const key = '2x2.experience.v1';
  const defaults = { sound: true, volume: 0.22, effects: true, motion: true };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch {}
  const prefs = { ...defaults };
  for (const name of ['sound','effects','motion']) if (typeof saved[name] === 'boolean') prefs[name] = saved[name];
  if (Number.isFinite(saved.volume)) prefs.volume = Math.max(0, Math.min(1, saved.volume));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let audio, unlocked = false, welcomed = false, lastHover = 0, lastClick = 0;
  const interactive = 'a[href],button,input[type=checkbox],input[type=radio],select,[role=tab]';
  function tone(freq, start, length, level, type = 'sine', endFreq = freq) {
    if (!audio || audio.state !== 'running') return;
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), start + length);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level * prefs.volume), start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(start); oscillator.stop(start + length + 0.015);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function sound(kind) {
    if (!prefs.sound || !unlocked || !audio || document.hidden) return;
    const t = audio.currentTime;
    if (kind === 'hover') tone(1450,t,.024,.09,'sine',1100);
    else if (kind === 'click') { tone(640,t,.045,.18,'triangle',420); tone(1550,t,.025,.055); }
    else if (kind === 'open') { tone(420,t,.08,.14,'triangle'); tone(630,t+.045,.1,.12,'triangle'); }
    else if (kind === 'notice') { tone(800,t,.1,.14); tone(1200,t+.1,.14,.12); }
    else if (kind === 'start') { tone(330,t,.12,.13,'triangle'); tone(440,t+.07,.12,.13,'triangle'); tone(660,t+.15,.2,.13,'triangle'); }
    else if (kind === 'error') { tone(220,t,.12,.12,'triangle',150); tone(180,t+.13,.12,.1,'triangle',130); }
  }
  async function unlock(event) {
    if (!event.isTrusted || !prefs.sound) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      audio ||= new Audio();
      if (audio.state !== 'running') await audio.resume();
      unlocked = audio.state === 'running';
      if (unlocked && !welcomed) { welcomed = true; sound('start'); }
    } catch { /* Browsers without audio keep the entire interface usable. */ }
  }
  document.addEventListener('pointerdown', unlock, { passive:true });
  document.addEventListener('keydown', unlock);
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch' || !unlocked) return;
    const target = event.target.closest(interactive);
    if (!target || target.disabled || target.contains(event.relatedTarget)) return;
    const now = performance.now();
    if (now - lastHover > 95) { lastHover = now; sound('hover'); }
  });
  document.addEventListener('click', event => {
    const target = event.target.closest(interactive);
    if (!target || target.disabled || target.matches('.SoundToggle')) return;
    const now=performance.now();
    if(now-lastClick<50)return;
    lastClick=now;
    sound(target.matches('.PlayButton,#AuthSubmit') ? 'start' : 'click');
  });

  const speaker = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 8c3 2 3 6 0 8"/><path class="SoundSlash" d="M3 3l18 18"/></svg>';
  function syncControls() {
    document.documentElement.dataset.effects = prefs.effects ? 'on' : 'off';
    document.documentElement.dataset.motion = prefs.motion && !reduced.matches ? 'on' : 'off';
    for (const button of document.querySelectorAll('.SoundToggle')) {
      button.setAttribute('aria-pressed', String(prefs.sound));
      const label = prefs.sound ? 'Mute interface sounds' : 'Enable interface sounds';
      button.title = label;
      button.setAttribute('aria-label', label);
      button.querySelector('.SoundSlash').style.display = prefs.sound ? 'none' : '';
    }
    for (const name of ['sound','effects','motion']) {
      const input = document.querySelector(`[data-experience="${name}"]`);
      if(input) input.checked = prefs[name];
    }
    const volume = document.querySelector('[data-experience="volume"]');
    if(volume) volume.value = Math.round(prefs.volume*100);
  }
  function update(next) {
    Object.assign(prefs,next);
    try { localStorage.setItem(key,JSON.stringify(prefs)); } catch {}
    syncControls();
    refreshAnimation();
  }
  function addControls() {
    const bar = document.querySelector('.TopBar');
    if (bar && !bar.querySelector('.SoundToggle')) {
      const button=document.createElement('button');
      button.type='button'; button.className='IconButton SoundToggle'; button.innerHTML=speaker;
      button.addEventListener('click',async event=>{update({sound:!prefs.sound});if(prefs.sound){await unlock(event);sound('notice');}});
      bar.append(button);
    }
    for(const element of document.querySelectorAll('[data-experience]:not([data-bound])')) {
      element.dataset.bound='true';
      element.addEventListener(element.type==='range'?'input':'change', event=>{
        const name=element.dataset.experience;
        update({[name]:name==='volume'?Number(element.value)/100:element.checked});
        if(name==='volume') { if(event.isTrusted) unlock(event); }
        else if(name==='sound' && prefs.sound) unlock(event);
      });
      if(element.type==='range')element.addEventListener('change',()=>sound('notice'));
    }
    syncControls();
  }

  // A small WebGL fragment shader: halftone nebula, warped horizon and an arcade grid.
  // It is deliberately confined to brand panels, at <=30fps and capped resolution.
  const vertex = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  // Per-host shaders, picked with data-shader="sky|studs|tunnel|nebula". Each has a canvas scale (soft ones render
  // at lower resolution and are stretched). They stay at <=30fps and are hidden by Settings -> shader backgrounds.
  const GLSL_HEAD = "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform vec2 u_res; uniform float u_time; uniform vec2 u_pointer;\n";
  const GLSL_NOISE = "float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\nfloat n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}\nfloat fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return v;}\n";
  const shaders = {
    sky:    { scale: .5,  src: GLSL_HEAD + GLSL_NOISE + "void main(){\n  vec2 uv=gl_FragCoord.xy/u_res; float asp=u_res.x/u_res.y; vec2 p=vec2(uv.x*asp,uv.y);\n  float t=mod(u_time,900.)*.03;\n  vec3 low=vec3(.80,.95,1.), mid=vec3(.50,.86,.99), top=vec3(.22,.67,.95);\n  vec3 col=mix(low,mid,smoothstep(0.,.5,uv.y)); col=mix(col,top,smoothstep(.45,1.,uv.y));\n  vec2 mp=vec2(u_pointer.x*asp,u_pointer.y);\n  vec2 q=vec2(p.x*1.5,p.y*2.6)+vec2(t,0.)+(u_pointer-.5)*.12;\n  float d=fbm(q+fbm(q*.7+t*.6));\n  vec2 q2=q+vec2(.05,.09);\n  float d2=fbm(q2+fbm(q2*.7+t*.6));\n  float dens=smoothstep(.36,.60,d)*mix(1.,.5,smoothstep(.6,1.,uv.y));\n  float shade=clamp((d-d2)*7.+.55,0.,1.);\n  vec3 cloud=mix(vec3(.74,.87,.96),vec3(1.),shade);\n  col=mix(col,cloud,dens*.92);\n  vec2 sun=vec2(asp*.86,1.04); vec2 sv=p-sun; float sd=length(sv);\n  float ang=atan(sv.y,sv.x);\n  float rays=pow(.5+.5*sin(ang*17.+t*7.+n(vec2(ang*3.,t))*3.),3.);\n  col+=vec3(1.,.96,.78)*exp(-sd*2.4)*.22;\n  col+=vec3(1.,.97,.85)*rays*exp(-sd*1.5)*.13*(1.-dens*.6);\n  col+=vec3(1.,.98,.9)*exp(-length(p-mp)*4.)*.10;\n  gl_FragColor=vec4(col,1.);\n}" },
    studs:  { scale: 1,   src: GLSL_HEAD + "void main(){\n  vec2 uv=gl_FragCoord.xy/u_res; float asp=u_res.x/u_res.y;\n  float t=mod(u_time,900.);\n  vec3 a=vec3(.18,.45,.72), b=vec3(.24,.55,.88);\n  vec3 col=mix(a,b,clamp(uv.x+.12*sin(t*.3+uv.y*3.),0.,1.));\n  vec2 g=vec2(uv.x*asp,uv.y)*5.; vec2 id=floor(g); vec2 f=fract(g)-.5;\n  vec2 c=(id+.5)/5.; vec2 mp=vec2(u_pointer.x*asp,u_pointer.y);\n  float wave=.5+.5*sin(id.x*.55-t*1.4+id.y*.8);\n  float rip=exp(-length(c-mp)*3.2)*(.5+.5*sin(length(c-mp)*22.-t*5.));\n  float r=.20+.07*wave+.12*rip;\n  float stud=smoothstep(r+.05,r-.03,length(f));\n  float rim=smoothstep(r+.07,r,length(f))-stud;\n  vec3 lit=vec3(.86,.95,1.);\n  col+=stud*(.05+.11*wave+.35*rip)*lit;\n  col+=rim*.05*lit;\n  float band=smoothstep(.14,0.,abs(uv.x*asp-(mod(t*.35,asp+1.6)-.4)+uv.y*.35));\n  col+=band*.10;\n  col+=exp(-length(vec2(uv.x*asp,uv.y)-mp)*3.)*.10;\n  gl_FragColor=vec4(col,1.);\n}" },
    tunnel: { scale: .6,  src: GLSL_HEAD + GLSL_NOISE + "void main(){\n  vec2 uv=gl_FragCoord.xy/u_res; float asp=u_res.x/u_res.y;\n  vec2 p=(uv-.5)*vec2(asp,1.); p+=(u_pointer-.5)*.06;\n  float t=mod(u_time,900.);\n  float r=length(p); float a=atan(p.y,p.x);\n  float z=1./(r+.06);\n  vec2 g=vec2(a*(12./6.2831853),z*.55-t*1.1);\n  vec2 f=fract(g); vec2 e=abs(f-.5);\n  float line=smoothstep(.44,.5,max(e.x,e.y));\n  float dots=1.-smoothstep(.10,.16,length(f-.5));\n  float rows=floor(g.y), cols=floor(g.x);\n  float tw=step(.82,h(vec2(cols,rows)));\n  vec3 base=mix(vec3(.07,.18,.34),vec3(.12,.32,.56),smoothstep(0.,.8,r));\n  vec3 col=base;\n  float fade=smoothstep(.04,.45,r);\n  col+=vec3(.25,.55,.85)*line*.22*fade;\n  col+=vec3(.55,.82,1.)*dots*.10*fade;\n  col+=vec3(.3,.8,.5)*tw*dots*.55*fade;\n  col*=.55+.45*smoothstep(.0,.35,r);\n  col*=1.-.35*smoothstep(.45,1.,r);\n  gl_FragColor=vec4(col,1.);\n}" },
    nebula: { scale: 1,   src: "precision mediump float;\n\n    uniform vec2 u_res; uniform float u_time; uniform vec2 u_pointer;\n    void main(){\n      vec2 uv=gl_FragCoord.xy/u_res;vec2 p=uv-.5;p.x*=u_res.x/u_res.y;\n      float t=u_time*.13;vec2 offset=(u_pointer-.5)*.06;\n      vec2 q=p+offset;\n      float flow=sin(q.x*4.+t)*cos(q.y*5.-t*.7);\n      float cloud=sin(q.x*3.3+q.y*2.+t)+cos(q.y*4.-q.x*2.-t*.8);\n      vec3 col=vec3(.055,.035,.15);\n      col+=vec3(.34,.025,.48)*exp(-length(q-vec2(.22,.18)) * 2.5)*(.65+.25*cloud);\n      col+=vec3(.02,.18,.40)*exp(-length(q-vec2(-.4,-.1))*3.0)*(.8+.2*flow);\n      float horizon=-.12+.025*sin(q.x*4.+t);\n      float ground=1.-smoothstep(horizon-.015,horizon+.04,q.y);\n      float depth=max(.045,horizon-q.y);\n      vec2 grid=vec2(q.x/depth*.8,1./depth*.35+t);\n      vec2 edge=abs(fract(grid)-.5);\n      float lines=smoothstep(.455,.497,max(edge.x,edge.y));\n      col+=vec3(.1,.52,.67)*lines*ground*.23*smoothstep(.0,.35,depth);\n      float glow=exp(-abs(q.y-horizon)*65.);\n      col+=vec3(.34,.06,.48)*glow*.55;\n      vec2 dots=fract(gl_FragCoord.xy/5.)-.5;\n      float halftone=1.-smoothstep(.14,.26,length(dots));\n      col+=vec3(.24,.07,.28)*halftone*.2*(.7+flow*.3);\n      float vignette=1.-smoothstep(.25,.95,length(p));\n      col*=.6+.4*vignette;\n      gl_FragColor=vec4(col,1.);\n    }" },
  };
  const renderers = new Set();
  let raf=0,lastFrame=-100,phase=0,lastTime=0;
  function attachShader(host) {
    if(host.dataset.shaderBound)return;
    host.dataset.shaderBound='true';
    const kind=shaders[host.dataset.shader]?host.dataset.shader:'studs';
    const canvas=document.createElement('canvas');canvas.className='ShaderCanvas';canvas.setAttribute('aria-hidden','true');host.prepend(canvas);
    let gl;
    try { gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,preserveDrawingBuffer:false,powerPreference:'low-power'}); } catch {}
    if(!gl){canvas.remove();return;}
    function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw new Error('Shader not available');}return shader;}
    let vs,fs,program,buffer;
    try {
      vs=compile(gl.VERTEX_SHADER,vertex);fs=compile(gl.FRAGMENT_SHADER,shaders[kind].src);
      program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader not available');
      gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const a=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
    } catch {canvas.remove();gl.getExtension('WEBGL_lose_context')?.loseContext();return;}
    const res=gl.getUniformLocation(program,'u_res'),time=gl.getUniformLocation(program,'u_time'),pointer=gl.getUniformLocation(program,'u_pointer');
    const state={host,canvas,gl,visible:true,lost:false,pointer:[.5,.5],draw(t){
      if(!host.isConnected||!this.visible||this.lost||!host.offsetWidth||host.getClientRects().length===0||host.closest('[hidden],.hidden'))return;
      const dpr=Math.min(devicePixelRatio||1,1.3)*shaders[kind].scale,w=Math.max(1,Math.round(host.clientWidth*dpr)),h=Math.max(1,Math.round(host.clientHeight*dpr));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
      gl.useProgram(program);gl.uniform2f(res,w,h);gl.uniform1f(time,t);gl.uniform2f(pointer,...this.pointer);gl.drawArrays(gl.TRIANGLES,0,6);
    }};
    host.addEventListener('pointermove',event=>{if(!prefs.motion||reduced.matches)return;const r=host.getBoundingClientRect();state.pointer=[(event.clientX-r.left)/r.width,1-(event.clientY-r.top)/r.height];},{passive:true});
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();state.lost=true;canvas.style.display='none';});
    canvas.addEventListener('webglcontextrestored',()=>{renderers.delete(state);canvas.remove();delete host.dataset.shaderBound;attachShader(host);});
    if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{state.visible=entries[0].isIntersecting;refreshAnimation();});observer.observe(host);}
    renderers.add(state);state.draw(phase);refreshAnimation();
  }
  function tick(now){
    raf=0;
    if(document.hidden||!prefs.effects)return;
    if(now-lastFrame>32){if(lastTime)phase+=Math.min((now-lastTime)/1000,.1);lastTime=now;lastFrame=now;for(const r of renderers)if(r.visible&&!r.lost)r.draw(phase);}
    if(prefs.motion&&!reduced.matches&&[...renderers].some(r=>r.visible&&!r.lost))raf=requestAnimationFrame(tick);
  }
  function refreshAnimation(){
    if(raf)cancelAnimationFrame(raf);raf=0;lastTime=0;
    if(!prefs.effects||document.hidden)return;
    for(const r of renderers)r.draw(phase);
    if(prefs.motion&&!reduced.matches&&[...renderers].some(r=>r.visible&&!r.lost))raf=requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange',()=>{refreshAnimation();if(document.hidden)audio?.suspend().catch(()=>{});else if(unlocked)audio?.resume().catch(()=>{});});
  reduced.addEventListener('change',()=>{syncControls();refreshAnimation();});
  window.addEventListener('resize',refreshAnimation,{passive:true});
  window.addEventListener('storage',event=>{if(event.key!==key)return;try{const data=JSON.parse(event.newValue||'{}');for(const name of ['sound','effects','motion'])if(typeof data[name]==='boolean')prefs[name]=data[name];if(Number.isFinite(data.volume))prefs.volume=Math.max(0,Math.min(1,data.volume));syncControls();refreshAnimation();}catch{}});
  let queued=false;
  function scan(){queued=false;addControls();for(const host of document.querySelectorAll('[data-shader]'))if(!host.dataset.shaderBound)attachShader(host);}
  const observer=new MutationObserver(records=>{
    let changed=false;
    for(const record of records)for(const node of record.addedNodes){
      if(node.nodeType!==1)continue;
      if(node.matches('.Toast'))sound('notice');
      if(node.matches('.Modal'))sound('open');
      if(node.matches('.Error')&&node.textContent.trim())sound('error');
      if(!node.matches('.ShaderCanvas,.SoundToggle,.SoundToggle *'))changed=true;
    }
    if(changed&&!queued){queued=true;queueMicrotask(scan);}
  });
  observer.observe(document.body,{childList:true,subtree:true});
  scan();
})();
