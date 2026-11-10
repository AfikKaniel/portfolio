/* Afik Kaniel — portfolio. The liquid light: a WebGL light field behind the page.
   It takes each scene's color, and the mouse stirs it like a hand moving through water.
   Runs only with motion allowed (site.js sets window.Site) and WebGL available;
   otherwise the fixed gradient in site.css stands in. */
(() => {
  "use strict";

  const Site = window.Site;
  if (!Site) return;

  const root = document.documentElement;
  const canvas = document.createElement("canvas");
  canvas.className = "fx";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return;
  document.body.prepend(canvas);

  /* ---------- Shaders ---------- */

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  // Phone GPUs: the noise needs high precision, or the light turns blocky; mediump is only the fallback.
  const VERT = "attribute vec2 p; varying vec2 vUv; void main() { vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }";
  const program = (frag) => {
    const pr = gl.createProgram();
    gl.attachShader(pr, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(pr);
    const u = {};
    const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(pr, i).name;
      u[name] = gl.getUniformLocation(pr, name);
    }
    return { pr, u, p: gl.getAttribLocation(pr, "p") };
  };

  // Flow map: the mouse's motion is painted into a small texture that slowly fades,
  // and the light is pushed along it.
  const flow = program(`
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec2 vUv;
    uniform sampler2D uPrev;
    uniform vec2 uMouse;
    uniform vec2 uVel;
    uniform float uAspect;
    uniform float uRadius;
    uniform float uDecay;
    void main() {
      vec2 v = (texture2D(uPrev, vUv).rg - 0.5) * 2.0;
      v *= uDecay;
      v = sign(v) * max(abs(v) - 0.004, 0.0);
      vec2 d = vUv - uMouse;
      d.x *= uAspect;
      v += uVel * smoothstep(uRadius, 0.0, length(d));
      v = clamp(v, -1.0, 1.0);
      gl_FragColor = vec4(v * 0.5 + 0.5, 0.0, 1.0);
    }`);

  const light = program(`
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uScroll;
    uniform vec3 uA;
    uniform vec3 uB;
    uniform float uI;
    uniform sampler2D uFlow;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
      return v;
    }
    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 fl = (texture2D(uFlow, uv).rg - 0.5) * 2.0;
      float stir = length(fl);
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
      float t = uTime * 0.045;
      vec2 fp = p + vec2(0.0, uScroll) - fl * 0.55;
      vec2 q = vec2(fbm(fp * 1.3 + t), fbm(fp * 1.3 - t + 3.1));
      vec2 r = vec2(fbm(fp * 1.5 + 2.2 * q + vec2(1.7, 9.2) + t * 1.4 - fl * 0.6), fbm(fp * 1.5 + 2.2 * q + vec2(8.3, 2.8) - t));
      float f = fbm(fp * 1.15 + 2.6 * r);
      vec2 m = (uMouse - 0.5 * uRes) / uRes.y;
      float md = length(p - m);
      vec3 col = uA * smoothstep(0.42, 0.95, f) * 0.75;
      col += uB * smoothstep(0.5, 1.05, length(r)) * 0.5;
      col += mix(uA, vec3(1.0), 0.35) * exp(-md * md * 7.0) * 0.18;
      // Where the mouse has stirred, the light glows a little brighter for a moment.
      col += mix(uA, uB, 0.5 + 0.5 * fl.x) * smoothstep(0.0, 0.9, stir) * (0.08 + 0.62 * f * f);
      col *= uI * (0.5 + 0.5 * smoothstep(1.35, 0.15, length(p - vec2(0.25, 0.0))));
      col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.018;
      gl_FragColor = vec4(col + vec3(0.03, 0.03, 0.04), 1.0);
    }`);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const use = (prog) => {
    gl.useProgram(prog.pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(prog.p);
    gl.vertexAttribPointer(prog.p, 2, gl.FLOAT, false, 0, 0);
  };

  const FLOW = 128;
  const target = () => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const still = new Uint8Array(FLOW * FLOW * 4);
    for (let i = 0; i < still.length; i += 4) { still[i] = 128; still[i + 1] = 128; still[i + 3] = 255; }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, FLOW, FLOW, 0, gl.RGBA, gl.UNSIGNED_BYTE, still);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb };
  };
  let read = target();
  let write = target();

  /* ---------- Size: the light is soft, so half resolution is enough ---------- */

  let scale = 0.5;
  const resize = () => {
    canvas.width = Math.max(1, Math.round(Site.vw * scale));
    canvas.height = Math.max(1, Math.round(Site.vh * scale));
  };
  resize();
  window.addEventListener("resize", () => requestAnimationFrame(resize));

  /* ---------- Scene colors ---------- */

  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const SCENES = {
    hero: [hex("#4f5dff"), hex("#b05cff"), 1],
    about: [hex("#2b3a8f"), hex("#6a3fa0"), 0.7],
    apps: [
      [hex("#2fbf8f"), hex("#2a7bff"), 0.95], // Pin-Point
      [hex("#ff5a6e"), hex("#ff9a3c"), 0.95], // Five Stack
      [hex("#4c8dff"), hex("#38d6ff"), 0.95], // CoachLoop
      [hex("#9a6bff"), hex("#ff6bd5"), 0.95], // Gamifest
    ],
    pp: [hex("#2fbf8f"), hex("#1f8fff"), 0.9],
    time: [hex("#2fbf8f"), hex("#3a3a80"), 0.55],
    career: [hex("#3d4ba8"), hex("#2a6a8a"), 0.42],
    contact: [hex("#4f5dff"), hex("#b05cff"), 0.8],
  };
  const sceneNow = () => {
    const b = Site.box;
    const y = window.scrollY + Site.vh * 0.5;
    if (!b.aboutAll) return SCENES.hero;
    if (y < b.aboutAll.top) return SCENES.hero;
    if (y < b.apps.top) return SCENES.about;
    if (y < b.reach.top) return SCENES.apps[Site.apps.index] || SCENES.apps[0];
    if (y < b.time.top) return SCENES.pp;
    if (y < b.career.top) return SCENES.time;
    if (y < b.contact.top) return SCENES.career;
    return SCENES.contact;
  };

  const cA = SCENES.hero[0].slice();
  const cB = SCENES.hero[1].slice();
  let cI = 1;
  const glow = { x: Site.pointer.x, y: Site.pointer.y };
  const lastPointer = { x: Site.pointer.x, y: Site.pointer.y };
  const vel = { x: 0, y: 0 };

  /* ---------- Safety: give up on devices that can't keep up ---------- */

  let stopped = false;
  let slowFrames = 0;
  let sampled = 0;
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    stopped = true;
    root.classList.remove("has-light");
  });

  let shown = false;
  let lastMs = 0;
  Site.onFrame.push((dt, now) => {
    if (stopped) return;

    // Very slow frames: first draw fewer pixels, then switch to the still gradient.
    // Long gaps (a hidden tab, a throttled page) say nothing about the device, so they are skipped.
    const ms = performance.now();
    const gap = ms - lastMs;
    lastMs = ms;
    if (gap < 250 && sampled < 90) {
      sampled++;
      if (gap > 45) slowFrames++;
      if (sampled === 90 && slowFrames > 45) {
        if (scale > 0.34) { scale = 0.34; resize(); sampled = 0; slowFrames = 0; }
        else { stopped = true; root.classList.remove("has-light"); return; }
      }
    }

    // Ease toward the current scene's color.
    const [ta, tb, ti] = sceneNow();
    const k = 1 - Math.exp(-dt * 2.4);
    for (let i = 0; i < 3; i++) { cA[i] += (ta[i] - cA[i]) * k; cB[i] += (tb[i] - cB[i]) * k; }
    cI += (ti - cI) * k;

    // Mouse speed, smoothed. Only real movement paints into the flow.
    const px = Site.pointer.x;
    const py = Site.pointer.y;
    const step = Math.max(dt, 1 / 240);
    const vx = Site.pointer.moved ? (px - lastPointer.x) / step : 0;
    const vy = Site.pointer.moved ? (py - lastPointer.y) / step : 0;
    lastPointer.x = px;
    lastPointer.y = py;
    const kv = 1 - Math.exp(-dt * 18);
    vel.x += (vx - vel.x) * kv;
    vel.y += (vy - vel.y) * kv;
    const km = 1 - Math.exp(-dt * 3);
    glow.x += (px - glow.x) * km;
    glow.y += (py - glow.y) * km;

    // 1. Update the flow map.
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fb);
    gl.viewport(0, 0, FLOW, FLOW);
    use(flow);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.tex);
    gl.uniform1i(flow.u.uPrev, 0);
    gl.uniform2f(flow.u.uMouse, px / Site.vw, 1 - py / Site.vh);
    const s = 1 / 1400; // px per second → flow strength
    gl.uniform2f(flow.u.uVel, Math.max(-1, Math.min(1, vel.x * s)), Math.max(-1, Math.min(1, -vel.y * s)));
    gl.uniform1f(flow.u.uAspect, Site.vw / Site.vh);
    gl.uniform1f(flow.u.uRadius, 0.16);
    gl.uniform1f(flow.u.uDecay, Math.pow(0.965, dt * 60));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [read, write] = [write, read];

    // 2. Draw the light, pushed along the flow.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    use(light);
    gl.bindTexture(gl.TEXTURE_2D, read.tex);
    gl.uniform1i(light.u.uFlow, 0);
    gl.uniform2f(light.u.uRes, canvas.width, canvas.height);
    gl.uniform1f(light.u.uTime, now);
    gl.uniform2f(light.u.uMouse, glow.x * scale, (Site.vh - glow.y) * scale);
    gl.uniform1f(light.u.uScroll, (window.scrollY / Site.vh) * 0.12);
    gl.uniform3fv(light.u.uA, cA);
    gl.uniform3fv(light.u.uB, cB);
    gl.uniform1f(light.u.uI, cI);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!shown) { shown = true; root.classList.add("has-light"); }
  });
})();
