"use client";

import { useEffect, useRef } from "react";
import { currentSky, type Sky } from "@/lib/timeOfDay";

/**
 * Virm's signature "satin mirror": a matte, light-blue glass surface whose soft light drifts slowly.
 * A tiny WebGL program drawn at reduced resolution, at most ~30 fps, paused when off-screen or when the tab
 * is hidden, and frozen into a still frame for people who prefer reduced motion. Without WebGL it falls back
 * to a static gradient. Its colors follow the time of day. Use sparingly — the Home hero and the loading screen.
 */

const VERTEX = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

const FRAGMENT = `
precision mediump float;
uniform vec2 r; uniform float t;
// The palette follows the time of day (see lib/timeOfDay): morning peach, midday blue, afternoon gold, night violet.
uniform vec3 SHADOW; uniform vec3 LIGHT; uniform vec3 SHEEN; uniform vec3 LILAC;
uniform float STARS; // 1 at night: small stars that slowly twinkle
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.55; for(int i=0;i<3;i++){ v+=a*n(p); p=p*1.9+vec2(1.7,9.2); a*=.45; } return v; }
float field(vec2 p){
  vec2 q = vec2(fbm(p + vec2(0., t*.5)), fbm(p + vec2(5.2, 1.3) - t*.35));
  return fbm(p*.7 + 1.6*q + vec2(t*.2, -t*.12));
}
void main(){
  vec2 uv = gl_FragCoord.xy / r;
  vec2 p = (gl_FragCoord.xy - .5*r) / r.y * .85;
  float e = .006, f = field(p);
  vec3 nrm = normalize(vec3(field(p-vec2(e,0.)) - field(p+vec2(e,0.)), field(p-vec2(0.,e)) - field(p+vec2(0.,e)), .028));
  vec3 L = normalize(vec3(cos(t*.35)*.7, .55, .6));
  float diff = clamp(dot(nrm, L), 0., 1.);
  float k = .5 + .5*sin(t*.22 + f*3.);
  vec3 col = mix(SHADOW, LIGHT, smoothstep(.25, .9, f*.75 + diff*.6)) + SHEEN*.22*pow(diff, 4.);
  col = mix(col, LILAC, .22*k*smoothstep(.3, .9, f));
  col *= .92 + .12*smoothstep(1.2, .1, length(uv-.5));
  if (STARS > 0.) {
    // Glitter: stars of different sizes; about a third of them now and then flash with a four-point shine.
    // Each star keeps its own random schedule, and neighbouring cells are checked so shines can cross cells.
    vec2 sp = gl_FragCoord.xy / 6.;
    vec2 base = floor(sp);
    float light = 0.;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 cell = base + vec2(float(i), float(j));
        if (h(cell) < .984) continue;
        vec2 d = sp - (cell + .5 + (vec2(h(cell + 1.3), h(cell + 7.1)) - .5) * .5);
        float phase = fract(t * mix(1.08, 3.03, h(cell + 3.7)) + h(cell + 5.3));
        float flash = smoothstep(0., .05, phase) * smoothstep(.16, .06, phase);
        float size = mix(.16, .5, h(cell + 9.1));
        float shiny = step(.66, h(cell + 11.3));
        float core = smoothstep(size, 0., length(d)) * (.5 + .5 * flash);
        float rays = shiny * flash * (smoothstep(.12, 0., abs(d.y)) * smoothstep(1.7, 0., abs(d.x))
                                    + smoothstep(.12, 0., abs(d.x)) * smoothstep(1.7, 0., abs(d.y)));
        light += core + rays * .9;
      }
    }
    col += vec3(.88, .91, 1.) * light * STARS * .85;
  }
  gl_FragColor = vec4(col, 1.);
}`;

/** The sky the page is showing now (set by TimeOfDaySync), or worked out here if it hasn't run yet. */
const pageSky = (): Sky => (window as unknown as { __virmSky?: Sky }).__virmSky ?? currentSky();

const toCss = (c: number[]) => `rgb(${c.map((v) => Math.round(v * 255)).join(" ")})`;
const fallbackFor = (sky: Sky) =>
  `radial-gradient(120% 90% at 30% 25%, ${toCss(sky.glass.sheen)} 0%, ${toCss(sky.glass.light)} 45%, ${toCss(sky.glass.shadow)} 100%)`;

type GlassTones = { shadow: number[]; light: number[]; sheen: number[]; accent: number[]; stars: number };
const tonesOf = (sky: Sky): GlassTones => ({ ...sky.glass, stars: sky.stars });

export function LiquidGlass({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) {
      canvas.style.background = fallbackFor(pageSky());
      return;
    }
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      canvas.style.background = fallbackFor(pageSky());
      return;
    }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "r");
    const uTime = gl.getUniformLocation(prog, "t");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The tones on screen ease toward the sky's tones over a few seconds, so the glass never jumps.
    let shown = tonesOf(pageSky());
    let target = shown;
    const ease = (from: number[], to: number[], k: number) => from.map((v, i) => v + (to[i] - v) * k);
    const applyPalette = (k: number) => {
      shown = {
        shadow: ease(shown.shadow, target.shadow, k),
        light: ease(shown.light, target.light, k),
        sheen: ease(shown.sheen, target.sheen, k),
        accent: ease(shown.accent, target.accent, k),
        stars: shown.stars + (target.stars - shown.stars) * k,
      };
      gl.uniform3fv(gl.getUniformLocation(prog, "SHADOW"), shown.shadow);
      gl.uniform3fv(gl.getUniformLocation(prog, "LIGHT"), shown.light);
      gl.uniform3fv(gl.getUniformLocation(prog, "SHEEN"), shown.sheen);
      gl.uniform3fv(gl.getUniformLocation(prog, "LILAC"), shown.accent);
      gl.uniform1f(gl.getUniformLocation(prog, "STARS"), shown.stars);
    };
    applyPalette(1);

        let visible = true;
    let last = 0;
    let frame = 0;
    const resize = () => {
      const scale = Math.min(1.5, window.devicePixelRatio) * 0.6;
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    const draw = (ms: number) => {
      gl.uniform1f(uTime, ms * 0.000066 + 3.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw(last);
    });
    resizeObserver.observe(canvas);
    const visibility = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    visibility.observe(canvas);
    // When the sky changes (once a minute), aim for its tones; with reduced motion, switch straight to them.
    const onSky = () => {
      target = tonesOf(pageSky());
      if (reduceMotion) {
        applyPalette(1);
        draw(last);
      }
    };
    window.addEventListener("virm-sky", onSky);
    resize();
    draw(0);

    if (!reduceMotion) {
      const loop = (ms: number) => {
        if (visible && !document.hidden && ms - last > 33) {
          last = ms;
          // About 4 seconds to settle on a new sky at ~30 frames a second.
          if (shown !== target) applyPalette(0.04);
          draw(ms);
        }
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibility.disconnect();
      window.removeEventListener("virm-sky", onSky);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`block h-full w-full ${className}`} />;
}
