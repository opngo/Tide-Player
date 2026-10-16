import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

export interface CRTWarpProps {
  color?: string;
  backgroundColor?: string;
  speed?: number;
  curvature?: number;
  scanlineStrength?: number;
  scanlineFrequency?: number;
  waveAmplitude?: number;
  waveFrequency?: number;
  bloom?: number;
  bloomRadius?: number;
  noise?: number;
  vignette?: number;
  brightness?: number;
  pixelation?: number;
  rgbShift?: number;
  mouseReact?: boolean;
  mouseStrength?: number;
  dpr?: number;
  fps?: number;
  paused?: boolean;
  reactivity?: 'off' | 'low' | 'high';
  className?: string;
  style?: React.CSSProperties;
}

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// Exact Fragment Shader from https://reactbits.dev/c/backgrounds/crt-warp
const FRAGMENT_SHADER = `
precision highp float;

varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uBackgroundColor;
uniform float uCurvature;
uniform float uScanlineStrength;
uniform float uScanlineFrequency;
uniform float uWaveAmplitude;
uniform float uWaveFrequency;
uniform float uBloom;
uniform float uBloomRadius;
uniform float uNoise;
uniform float uVignette;
uniform float uBrightness;
uniform float uPixelation;
uniform float uRgbShift;
uniform vec2 uPointer;
uniform float uMouseStrength;
uniform float uMouseReact;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 crtCurve(vec2 uv, float radius) {
  vec2 p = (uv - 0.5) * 2.0;
  float safeRadius = max(radius, 1.415);
  float cornerScale = safeRadius / sqrt(max(safeRadius * safeRadius - 2.0, 0.001));
  p = safeRadius * p / sqrt(max(safeRadius * safeRadius - dot(p, p), 0.001));
  p /= cornerScale;
  return p * 0.5 + 0.5;
}

float referencePlasma(vec2 uv, float t) {
  float frequencyScale = max(uWaveFrequency / 2.2, 0.001);
  uv = (uv - 0.5) * frequencyScale + 0.5;

  float scanline = 0.5 - 0.5 * cos(uv.y * 3.14159265 * uScanlineFrequency);
  scanline = mix(1.0, scanline, uScanlineStrength);

  uv *= vec2(80.0, 24.0);
  uv = ceil(uv);
  uv /= vec2(80.0, 24.0);

  float amplitude = uWaveAmplitude / 0.28;
  float field = 0.0;
  field += 0.7 * sin(0.5 * uv.x + t / 5.0);
  field += 3.0 * sin(1.6 * uv.y + t / 5.0);
  field += sin(10.0 * (uv.y * sin(t / 2.0) + uv.x * cos(t / 5.0)) + t / 2.0);

  float cx = uv.x + 0.5 * sin(t / 2.0);
  float cy = uv.y + 0.5 * cos(t / 4.0);
  field += 0.4 * sin(sqrt(100.0 * cx * cx + 100.0 * cy * cy + 1.0) + t);
  field += 0.9 * sin(sqrt(75.0 * cx * cx + 25.0 * cy * cy + 1.0) + t);
  field -= 1.4 * sin(sqrt(256.0 * cx * cx + 25.0 * cy * cy + 1.0) + t);
  field += 0.3 * sin(0.5 * uv.y + uv.x + sin(t));

  return scanline * floor(3.0 * (0.5 + 0.499 * sin(field * amplitude))) / 3.0;
}

void main() {
  vec2 uv = vUv;
  if (uPixelation > 1.001) {
    vec2 cells = max(uResolution / uPixelation, vec2(1.0));
    uv = (floor(uv * cells) + 0.5) / cells;
  }

  float curveRadius = 1.1 + 0.42 / max(uCurvature, 0.001);
  if (uMouseReact > 0.5) {
    curveRadius *= exp(-uPointer.y * uMouseStrength * 0.4);
  }
  vec2 curvedUv = crtCurve(uv, curveRadius);
  if (uMouseReact > 0.5) {
    curvedUv.x -= uPointer.x * uMouseStrength * 0.035;
  }

  float signal = referencePlasma(curvedUv, uTime);
  float radius = 0.01 * uBloomRadius;
  float glow = signal * 0.2;
  glow += referencePlasma(curvedUv + vec2(radius, 0.0), uTime) * 0.12;
  glow += referencePlasma(curvedUv - vec2(radius, 0.0), uTime) * 0.12;
  glow += referencePlasma(curvedUv + vec2(0.0, radius), uTime) * 0.12;
  glow += referencePlasma(curvedUv - vec2(0.0, radius), uTime) * 0.12;
  glow += referencePlasma(curvedUv + vec2(radius, radius), uTime) * 0.08;
  glow += referencePlasma(curvedUv - vec2(radius, radius), uTime) * 0.08;
  glow += referencePlasma(curvedUv + vec2(radius, -radius), uTime) * 0.08;
  glow += referencePlasma(curvedUv + vec2(-radius, radius), uTime) * 0.08;

  float redSignal = referencePlasma(curvedUv + vec2(uRgbShift, 0.0), uTime);
  float blueSignal = referencePlasma(curvedUv - vec2(uRgbShift, 0.0), uTime);
  vec3 channelSignal = vec3(redSignal, signal, blueSignal);
  vec3 waveColor = uColor * (0.3 + signal * 0.7 + glow * uBloom * 0.65);
  waveColor += (channelSignal - signal) * 0.42;

  float edge = clamp(1.0 - dot(vUv - 0.5, vUv - 0.5) * 2.0, 0.0, 1.0);
  float edgeFade = mix(1.0, smoothstep(0.0, 1.0, edge), uVignette);
  float waveMask = clamp(signal * 0.82 + glow * 0.52, 0.0, 1.0) * edgeFade;

  float grain = hash21(gl_FragCoord.xy + vec2(fract(uTime) * 173.0));
  waveColor = max(waveColor * uBrightness, vec3(0.0));
  vec3 color = mix(uBackgroundColor, waveColor, waveMask);
  color += (grain - 0.5) * uNoise;
  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
}
`;

function hexToRgbNormalized(hex: string): [number, number, number] {
  const clean = (hex || '#c755f7').replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0');
  const num = parseInt(full.slice(0, 6), 16) || 0xc755f7;
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

export const CRTWarpBackground: React.FC<CRTWarpProps> = ({
  color = '#c755f7',
  backgroundColor = '#05010a',
  speed = 0.5,
  curvature = 0.25,
  scanlineStrength = 0.25,
  scanlineFrequency = 200,
  waveAmplitude = 0.3,
  waveFrequency = 2.5,
  bloom = 1.5,
  bloomRadius = 1.0,
  noise = 0.1,
  vignette = 0.0,
  brightness = 1.25,
  pixelation = 1.0,
  rgbShift = 0.015,
  mouseReact = true,
  mouseStrength = 0.5,
  dpr = 1.25,
  fps = 60,
  paused = false,
  reactivity = 'low',
  className = '',
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({
    color,
    backgroundColor,
    speed,
    curvature,
    scanlineStrength,
    scanlineFrequency,
    waveAmplitude,
    waveFrequency,
    bloom,
    bloomRadius,
    noise,
    vignette,
    brightness,
    pixelation,
    rgbShift,
    mouseReact,
    mouseStrength,
    dpr,
    fps,
    paused,
    reactivity,
  });

  useEffect(() => {
    propsRef.current = {
      color,
      backgroundColor,
      speed,
      curvature,
      scanlineStrength,
      scanlineFrequency,
      waveAmplitude,
      waveFrequency,
      bloom,
      bloomRadius,
      noise,
      vignette,
      brightness,
      pixelation,
      rgbShift,
      mouseReact,
      mouseStrength,
      dpr,
      fps,
      paused,
      reactivity,
    };
  }, [
    color,
    backgroundColor,
    speed,
    curvature,
    scanlineStrength,
    scanlineFrequency,
    waveAmplitude,
    waveFrequency,
    bloom,
    bloomRadius,
    noise,
    vignette,
    brightness,
    pixelation,
    rgbShift,
    mouseReact,
    mouseStrength,
    dpr,
    fps,
    paused,
    reactivity,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext('webgl', { antialias: false, alpha: false }) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return;

    const compileShader = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const quadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const loc = {
      uResolution: gl.getUniformLocation(program, 'uResolution'),
      uTime: gl.getUniformLocation(program, 'uTime'),
      uColor: gl.getUniformLocation(program, 'uColor'),
      uBackgroundColor: gl.getUniformLocation(program, 'uBackgroundColor'),
      uCurvature: gl.getUniformLocation(program, 'uCurvature'),
      uScanlineStrength: gl.getUniformLocation(program, 'uScanlineStrength'),
      uScanlineFrequency: gl.getUniformLocation(program, 'uScanlineFrequency'),
      uWaveAmplitude: gl.getUniformLocation(program, 'uWaveAmplitude'),
      uWaveFrequency: gl.getUniformLocation(program, 'uWaveFrequency'),
      uBloom: gl.getUniformLocation(program, 'uBloom'),
      uBloomRadius: gl.getUniformLocation(program, 'uBloomRadius'),
      uNoise: gl.getUniformLocation(program, 'uNoise'),
      uVignette: gl.getUniformLocation(program, 'uVignette'),
      uBrightness: gl.getUniformLocation(program, 'uBrightness'),
      uPixelation: gl.getUniformLocation(program, 'uPixelation'),
      uRgbShift: gl.getUniformLocation(program, 'uRgbShift'),
      uPointer: gl.getUniformLocation(program, 'uPointer'),
      uMouseStrength: gl.getUniformLocation(program, 'uMouseStrength'),
      uMouseReact: gl.getUniformLocation(program, 'uMouseReact'),
    };

    const targetPointer = { x: 0, y: 0 };
    const currentPointer = { x: 0, y: 0 };

    const handlePointerMove = (e: PointerEvent) => {
      const w = Math.max(window.innerWidth, 1);
      const h = Math.max(window.innerHeight, 1);
      targetPointer.x = (e.clientX / w) * 2 - 1;
      targetPointer.y = -((e.clientY / h) * 2 - 1);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    let animId = 0;
    let lastTime = performance.now();
    let lastFrameTime = 0;
    let uTimeValue = 0;

    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      const p = propsRef.current;

      const frameInterval = 1000 / Math.max(1, p.fps);
      if (now - lastFrameTime < frameInterval) return;
      lastFrameTime = now - ((now - lastFrameTime) % frameInterval);

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const rms = audioEngine.getRmsEnergy();
      const audioBoost =
        p.reactivity === 'high' ? rms * 0.45 : p.reactivity === 'low' ? rms * 0.18 : 0;

      if (!p.paused) {
        uTimeValue += dt * p.speed * (1 + audioBoost * 0.8);
      }

      currentPointer.x += (targetPointer.x - currentPointer.x) * 0.08;
      currentPointer.y += (targetPointer.y - currentPointer.y) * 0.08;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, p.dpr);
      const w = Math.max(1, Math.floor(window.innerWidth * pixelRatio));
      const h = Math.max(1, Math.floor(window.innerHeight * pixelRatio));

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }

      const [cr, cg, cb] = hexToRgbNormalized(p.color);
      const [br, bg, bb] = hexToRgbNormalized(p.backgroundColor);

      gl.uniform2f(loc.uResolution, w, h);
      gl.uniform1f(loc.uTime, uTimeValue);
      gl.uniform3f(loc.uColor, cr, cg, cb);
      gl.uniform3f(loc.uBackgroundColor, br, bg, bb);
      gl.uniform1f(loc.uCurvature, p.curvature);
      gl.uniform1f(loc.uScanlineStrength, p.scanlineStrength);
      gl.uniform1f(loc.uScanlineFrequency, p.scanlineFrequency);
      gl.uniform1f(loc.uWaveAmplitude, p.waveAmplitude + audioBoost * 0.12);
      gl.uniform1f(loc.uWaveFrequency, p.waveFrequency);
      gl.uniform1f(loc.uBloom, p.bloom + audioBoost * 0.6);
      gl.uniform1f(loc.uBloomRadius, p.bloomRadius);
      gl.uniform1f(loc.uNoise, p.noise);
      gl.uniform1f(loc.uVignette, p.vignette);
      gl.uniform1f(loc.uBrightness, p.brightness);
      gl.uniform1f(loc.uPixelation, p.pixelation);
      gl.uniform1f(loc.uRgbShift, p.rgbShift);
      gl.uniform2f(loc.uPointer, currentPointer.x, currentPointer.y);
      gl.uniform1f(loc.uMouseStrength, p.mouseStrength);
      gl.uniform1f(loc.uMouseReact, p.mouseReact ? 1.0 : 0.0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('pointermove', handlePointerMove);
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 w-full h-full pointer-events-none z-0 ${className}`}
      style={style}
    />
  );
};
