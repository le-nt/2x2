// RBSky: a small WebGL fragment shader that paints the 2x2 sky.
// Procedural clouds (domain-warped fbm noise, lit from the upper right so the undersides go purple),
// pushed around by the cursor, with shockwave ripples on click. Falls back silently to the CSS clouds.
// Usage: RBSky.mount(hostElement, { mode: "banner" | "landing" })  ->  { ripple(x, y) }  (x, y in client px)
const RBSky = (() => {
  const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform vec3 uRip;
uniform vec3 uTop; uniform vec3 uBot; uniform vec2 uGlow; uniform float uScale; uniform float uCover;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= .5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
  vec2 q = vec2(uv.x * asp, uv.y);

  // cursor: clouds swirl away from the pointer
  vec2 m = vec2(uMouse.x * asp, uMouse.y), d = q - m;
  float inf = exp(-dot(d, d) * 5.) * step(0., uMouse.x);
  q += vec2(-d.y, d.x) * inf * .4 - d * inf * .12;

  // click / landing shockwave: a ring that travels outward and fades
  float ring = 0.;
  if (uRip.z >= 0.) {
    float rt = uTime - uRip.z;
    vec2 rd = q - vec2(uRip.x * asp, uRip.y);
    float rl = length(rd), x = (rl - rt * .85) * 8.;
    ring = exp(-x * x) * exp(-rt * 1.3);
    q += rd / (rl + .001) * ring * .07;
  }

  vec2 p = q * uScale + vec2(uTime * .03, 0.);
  p += .35 * vec2(fbm(p + uTime * .02), fbm(p + 5.2 - uTime * .015));
  float n = fbm(p);
  float dens = smoothstep(.38, .70, n) * uCover;
  float lit = clamp((n - fbm(p + vec2(.12, .16))) * 3.2 + .55, 0., 1.);

  vec3 sky = mix(uBot, uTop, uv.y);
  vec2 g = (uv - uGlow) * vec2(asp, 1.);
  sky += vec3(.88, .1, .85) * .30 * exp(-dot(g, g) * 7.);

  vec3 cloud = mix(vec3(.50, .44, .84), vec3(1.), lit);
  cloud = mix(cloud, vec3(1., .86, 1.), smoothstep(.7, 1., lit) * .35);
  vec3 col = mix(sky, cloud, dens);
  col += ring * vec3(1., .72, 1.) * .38;
  col += inf * vec3(.95, .55, 1.) * .10;
  col += (hash(gl_FragCoord.xy + uTime) - .5) / 128.;
  gl_FragColor = vec4(col, 1.);
}`;
  const MODES = {
    banner:  { top: [.81, .82, 1.], bot: [.54, .55, .88], glow: [.12, .5], scale: 2.4, cover: .8,  res: 1 },
    landing: { top: [.56, .57, .93], bot: [.91, .92, 1.], glow: [.2, .3],  scale: 2.0, cover: .92, res: .6 },
  };

  function mount(host, { mode = "banner" } = {}) {
    if (host._sky) return host._sky;
    const cfg = MODES[mode] || MODES.banner;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cv = document.createElement("canvas");
    cv.className = "SkyCanvas"; cv.setAttribute("aria-hidden", "true");
    const gl = cv.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; for (const k of ["uRes", "uTime", "uMouse", "uRip", "uTop", "uBot", "uGlow", "uScale", "uCover"]) U[k] = gl.getUniformLocation(prog, k);
    gl.uniform3fv(U.uTop, cfg.top); gl.uniform3fv(U.uBot, cfg.bot); gl.uniform2fv(U.uGlow, cfg.glow);
    gl.uniform1f(U.uScale, cfg.scale); gl.uniform1f(U.uCover, cfg.cover);

    host.insertBefore(cv, host.firstChild);
    host.classList.add("has-sky");

    let w = 1, h = 1, visible = true, raf = 0, t0 = performance.now();
    let mx = -1, my = -1, tx = -1, ty = -1, rip = [0, 0, -1];
    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5) * cfg.res;
      w = Math.max(2, Math.round(host.clientWidth * dpr)); h = Math.max(2, Math.round(host.clientHeight * dpr));
      cv.width = w; cv.height = h; gl.viewport(0, 0, w, h);
    };
    const frame = (now) => {
      raf = 0;
      const t = reduce ? 20 : (now - t0) / 1000;
      if (tx < 0) mx = my = -1; else { mx = mx < 0 ? tx : mx + (tx - mx) * .15; my = my < 0 ? ty : my + (ty - my) * .15; }
      gl.uniform2f(U.uRes, w, h); gl.uniform1f(U.uTime, t);
      gl.uniform2f(U.uMouse, mx, my); gl.uniform3f(U.uRip, rip[0], rip[1], rip[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

    const ripple = (cx, cy) => {
      const r = host.getBoundingClientRect();
      rip = [(cx - r.left) / r.width, 1 - (cy - r.top) / r.height, reduce ? 20 : (performance.now() - t0) / 1000];
      kick();
    };
    host.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = host.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width; ty = 1 - (e.clientY - r.top) / r.height;
      if (reduce) return; kick();
    });
    host.addEventListener("pointerleave", () => { tx = -1; });
    host.addEventListener("pointerdown", (e) => { if (!reduce) ripple(e.clientX, e.clientY); });
    new ResizeObserver(() => { size(); kick(); }).observe(host);
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) kick(); }).observe(host);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
    // If the GPU context is lost, drop the canvas and let the CSS clouds show again.
    cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); cv.remove(); host.classList.remove("has-sky"); host._sky = null; });

    size(); kick();
    return (host._sky = { ripple });
  }
  return { mount };
})();
window.RBSky = RBSky;
