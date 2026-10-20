"use client";

import { useEffect, useRef } from "react";
import { GLASS_PALETTE, type Period } from "@/lib/timeOfDay";

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
    vec2 sp = gl_FragCoord.xy / 6.;
    vec2 cell = floor(sp);
    float rnd = h(cell);
    if (rnd > .988) {
      vec2 at = vec2(h(cell + 1.3), h(cell + 7.1)) - .5;
      float d = length(fract(sp) - .5 - at * .5);
      float twinkle = .3 + .7 * (.5 + .5 * sin(t * 28. + rnd * 90.));
      col += vec3(.86, .9, 1.) * smoothstep(.42, 0., d) * twinkle * STARS * .85;
    }
  }
  gl_FragColor = vec4(col, 1.);
}`;

const currentPeriod = (): Period => (document.documentElement.dataset.period as Period) || "midday";

export function LiquidGlass({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) {
      canvas.style.background = GLASS_PALETTE[currentPeriod()].fallback;
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
      canvas.style.background = GLASS_PALETTE[currentPeriod()].fallback;
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
    const applyPalette = () => {
      const c = GLASS_PALETTE[currentPeriod()];
      gl.uniform3fv(gl.getUniformLocation(prog, "SHADOW"), c.shadow);
      gl.uniform3fv(gl.getUniformLocation(prog, "LIGHT"), c.light);
      gl.uniform3fv(gl.getUniformLocation(prog, "SHEEN"), c.sheen);
      gl.uniform3fv(gl.getUniformLocation(prog, "LILAC"), c.accent);
      gl.uniform1f(gl.getUniformLocation(prog, "STARS"), currentPeriod() === "night" ? 1 : 0);
    };
    applyPalette();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    // Repaint in the new colors when the time of day changes.
    const periodWatch = new MutationObserver(() => {
      applyPalette();
      draw(last);
    });
    periodWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-period"] });
    resize();
    draw(0);

    if (!reduceMotion) {
      const loop = (ms: number) => {
        if (visible && !document.hidden && ms - last > 33) {
          last = ms;
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
      periodWatch.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`block h-full w-full ${className}`} />;
}
