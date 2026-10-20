import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { audioEngine } from '../services/audioEngine';

function hexToRgbNorm(hex: string): [number, number, number] {
  const clean = (hex || '#c755f7').replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16) || 0xc755f7;
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

// ============================================================================
// 1. React Bits: ClickSpark (from ClickSpark-CV2-Lusx.js)
// ============================================================================
export interface ClickSparkProps {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

interface SparkBurst {
  x: number;
  y: number;
  start: number;
  angles: number[];
  scales: number[];
  color: string;
}

export const ReactBitsClickSpark: React.FC<ClickSparkProps> = ({
  sparkColor = '#38bdf8',
  sparkSize = 12,
  sparkRadius = 26,
  sparkCount = 8,
  duration = 420,
  disabled = false,
  children,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const burstsRef = useRef<SparkBurst[]>([]);
  const rafRef = useRef<number>(0);

  const drawLoop = useCallback(
    (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (
        canvas.width !== Math.floor(window.innerWidth * dpr) ||
        canvas.height !== Math.floor(window.innerHeight * dpr)
      ) {
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      burstsRef.current = burstsRef.current.filter((b) => {
        const t = (now - b.start) / duration;
        if (t >= 1) return false;
        const ease = 1 - Math.pow(1 - t, 3);
        const alpha = Math.max(0, 1 - t);
        const dist = sparkRadius * ease;
        const lineLen = sparkSize * Math.pow(1 - t, 1.5);

        ctx.strokeStyle = b.color;
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = alpha * 0.85;

        b.angles.forEach((ang, idx) => {
          const r1 = dist * b.scales[idx];
          const r2 = r1 + lineLen * b.scales[idx];
          ctx.beginPath();
          ctx.moveTo(b.x + Math.cos(ang) * r1, b.y + Math.sin(ang) * r1);
          ctx.lineTo(b.x + Math.cos(ang) * r2, b.y + Math.sin(ang) * r2);
          ctx.stroke();
        });
        return true;
      });

      ctx.restore();

      if (burstsRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(drawLoop);
      } else {
        rafRef.current = 0;
      }
    },
    [duration, sparkRadius, sparkSize]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    const angles = Array.from({ length: sparkCount }, (_, i) => {
      const base = (Math.PI * 2 * i) / sparkCount;
      return base + (Math.random() - 0.5) * 0.22;
    });
    const scales = Array.from(
      { length: sparkCount },
      () => 0.8 + Math.random() * 0.4
    );
    burstsRef.current.push({
      x: e.clientX,
      y: e.clientY,
      start: performance.now(),
      angles,
      scales,
      color: sparkColor,
    });
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(drawLoop);
    }
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      onPointerDown={handlePointerDown}
      className={`relative w-full h-full ${className}`}
    >
      {children}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none z-[9998]"
      />
    </div>
  );
};

// ============================================================================
// 2. React Bits: SpotlightCard (interactive cursor spotlight card, no borders)
// ============================================================================
export interface SpotlightCardProps {
  children: React.ReactNode;
  spotlightColor?: string;
  className?: string;
  onClick?: () => void;
}

export const ReactBitsSpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  spotlightColor = 'rgba(56, 189, 248, 0.16)',
  className = '',
  onClick,
}) => {
  const divRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  return (
    <div
      ref={divRef}
      onClick={onClick}
      onMouseMove={(e) => {
        if (!divRef.current) return;
        const rect = divRef.current.getBoundingClientRect();
        setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300"
          style={{
            opacity,
            background: `radial-gradient(420px circle at ${pos.x}px ${pos.y}px, ${spotlightColor}, transparent 70%)`,
          }}
        />
      </div>
      <div className="relative z-10 flex flex-col gap-5">{children}</div>
    </div>
  );
};

// ============================================================================
// 3. React Bits: DecryptedText (character cipher reveal on change/hover)
// ============================================================================
export const ReactBitsDecryptedText: React.FC<{
  text: string;
  speed?: number;
  className?: string;
}> = ({ text, speed = 26, className = '' }) => {
  const [display, setDisplay] = useState(text);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·•◦';

  useEffect(() => {
    let iteration = 0;
    const interval = window.setInterval(() => {
      setDisplay(
        text
          .split('')
          .map((ch, idx) => {
            if (ch === ' ') return ' ';
            if (idx < iteration) return text[idx];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('')
      );
      iteration += 1 / 2;
      if (iteration >= text.length) {
        setDisplay(text);
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return <span className={className}>{display}</span>;
};

// ============================================================================
// 4. React Bits: PreviewColorPickerCustom (Exact Popover from PreviewColorPickerCustom-D4eTxjrx.js)
// ============================================================================
function hsvToHexRB(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (a: number) =>
    Math.round((a + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsvRB(hex: string): { h: number; s: number; v: number } {
  const clean = (hex || '#a855f7').replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255 || 0;
  const g = parseInt(full.slice(2, 4), 16) / 255 || 0;
  const b = parseInt(full.slice(4, 6), 16) / 255 || 0;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

const RB_SWATCHES = [
  '#A855F7',
  '#7C3AED',
  '#6366F1',
  '#3B82F6',
  '#06B6D4',
  '#10B981',
  '#84CC16',
  '#EAB308',
  '#F97316',
  '#EF4444',
  '#EC4899',
  '#F43F5E',
  '#ffffff',
  '#94a3b8',
  '#000000',
];

export const ReactBitsColorPickerPopover: React.FC<{
  title: string;
  color: string;
  onChange: (hex: string) => void;
}> = ({ title, color, onChange }) => {
  const [hsv, setHsv] = useState(() => hexToHsvRB(color));
  const [textVal, setTextVal] = useState(color);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const svRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (color && color.length >= 7) {
      setHsv(hexToHsvRB(color));
      setTextVal(color);
    }
  }, [color]);

  useEffect(() => {
    if (!open) return;
    const updateRect = () => {
      if (triggerRef.current) {
        setAnchorRect(triggerRef.current.getBoundingClientRect());
      }
    };
    updateRect();
    const onOutside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (
        !triggerRef.current?.contains(t) &&
        !popoverRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    document.addEventListener('pointerdown', onOutside);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      document.removeEventListener('pointerdown', onOutside);
    };
  }, [open]);

  const emitColor = useCallback(
    (h: number, s: number, v: number) => {
      const hex = hsvToHexRB(h, s, v);
      setTextVal(hex);
      onChange(hex);
    },
    [onChange]
  );

  const handleSvDrag = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      if (!svRef.current) return;
      const rect = svRef.current.getBoundingClientRect();
      const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const v = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      setHsv((prev) => {
        const next = { ...prev, s, v };
        emitColor(next.h, next.s, next.v);
        return next;
      });
    },
    [emitColor]
  );

  const handleHueDrag = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      if (!hueRef.current) return;
      const rect = hueRef.current.getBoundingClientRect();
      const h =
        Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 360;
      setHsv((prev) => {
        const next = { ...prev, h };
        emitColor(next.h, next.s, next.v);
        return next;
      });
    },
    [emitColor]
  );

  const currentHex = hsvToHexRB(hsv.h, hsv.s, hsv.v);
  const pureHue = hsvToHexRB(hsv.h, 1, 1);

  return (
    <div ref={triggerRef} className="relative">
      <div
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] cursor-pointer transition-all"
      >
        <span className="text-xs text-white/65">{title}</span>
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded-md shadow-inner"
            style={{ backgroundColor: currentHex }}
          />
          <input
            type="text"
            value={textVal}
            maxLength={7}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = e.target.value;
              setTextVal(v);
              if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                setHsv(hexToHsvRB(v));
                onChange(v);
              }
            }}
            className="w-16 bg-transparent font-mono text-[11px] text-white/85 uppercase"
          />
        </div>
      </div>

      {open &&
        anchorRect &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: Math.min(anchorRect.bottom + 6, window.innerHeight - 260),
              left: Math.min(
                Math.max(8, anchorRect.left),
                window.innerWidth - 252
              ),
              width: 240,
              zIndex: 9999,
            }}
            className="p-3 rounded-2xl bg-zinc-950/95 backdrop-blur-2xl shadow-2xl space-y-2.5 select-none"
          >
            <div
              ref={svRef}
              onPointerDown={(e) => {
                e.preventDefault();
                handleSvDrag(e);
                const move = (ev: PointerEvent) => handleSvDrag(ev);
                const up = () => {
                  document.removeEventListener('pointermove', move);
                  document.removeEventListener('pointerup', up);
                };
                document.addEventListener('pointermove', move);
                document.addEventListener('pointerup', up);
              }}
              style={{
                position: 'relative',
                width: '100%',
                height: 145,
                borderRadius: 10,
                cursor: 'crosshair',
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHue})`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: currentHex,
                  boxShadow: '0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,0.65)',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                }}
              />
            </div>

            <div
              ref={hueRef}
              onPointerDown={(e) => {
                e.preventDefault();
                handleHueDrag(e);
                const move = (ev: PointerEvent) => handleHueDrag(ev);
                const up = () => {
                  document.removeEventListener('pointermove', move);
                  document.removeEventListener('pointerup', up);
                };
                document.addEventListener('pointermove', move);
                document.addEventListener('pointerup', up);
              }}
              style={{
                position: 'relative',
                width: '100%',
                height: 14,
                borderRadius: 7,
                cursor: 'pointer',
                background:
                  'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: `${(hsv.h / 360) * 100}%`,
                  top: '50%',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: pureHue,
                  boxShadow: '0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,0.65)',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                }}
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {RB_SWATCHES.map((sw) => (
                <button
                  key={sw}
                  type="button"
                  onClick={() => {
                    setHsv(hexToHsvRB(sw));
                    setTextVal(sw);
                    onChange(sw);
                  }}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    backgroundColor: sw,
                    boxShadow:
                      currentHex.toLowerCase() === sw.toLowerCase()
                        ? '0 0 0 2px #fff'
                        : undefined,
                  }}
                />
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

// ============================================================================
// 5. React Bits: WebGL Balatro Swirl Shader (from Balatro-DfNL1Oc7.js)
// ============================================================================
const BALATRO_VERT = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const BALATRO_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float iTime;
uniform vec2 iResolution;
uniform float uSpinRotation;
uniform float uSpinSpeed;
uniform vec4 uColor1;
uniform vec4 uColor2;
uniform vec4 uColor3;
uniform float uContrast;
uniform float uLighting;
uniform float uSpinAmount;
uniform float uPixelFilter;
uniform vec2 uMouse;

vec4 effect(vec2 screenSize, vec2 screen_coords) {
  float pixel_size = length(screenSize.xy) / uPixelFilter;
  vec2 uv = (floor(screen_coords.xy * (1.0 / pixel_size)) * pixel_size - 0.5 * screenSize.xy) / length(screenSize.xy);
  float uv_len = length(uv);
  float speed = iTime * uSpinRotation * 0.2 + 302.2 + (uMouse.x * 2.0 - 1.0) * 0.1;
  float new_pixel_angle = atan(uv.y, uv.x) + speed - 20.0 * (uSpinAmount * uv_len + (1.0 - uSpinAmount));
  vec2 mid = (screenSize.xy / length(screenSize.xy)) / 2.0;
  uv = (vec2(uv_len * cos(new_pixel_angle) + mid.x, uv_len * sin(new_pixel_angle) + mid.y) - mid);
  uv *= 30.0;
  speed = iTime * uSpinSpeed + (uMouse.x * 2.0 - 1.0) * 2.0;
  vec2 uv2 = vec2(uv.x + uv.y);
  for (int i = 0; i < 5; i++) {
    uv2 += sin(max(uv.x, uv.y)) + uv;
    uv += 0.5 * vec2(
      cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121),
      sin(uv2.x - 0.113 * speed)
    );
    uv -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y);
  }
  float contrast_mod = (0.25 * uContrast + 0.5 * uSpinAmount + 1.2);
  float paint_res = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod));
  float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res));
  float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res));
  float c3p = 1.0 - min(1.0, c1p + c2p);
  float light = (uLighting - 0.2) * max(c1p * 5.0 - 4.0, 0.0) + uLighting * max(c2p * 5.0 - 4.0, 0.0);
  return (0.3 / uContrast) * uColor1 + (1.0 - 0.3 / uContrast) * (uColor1 * c1p + uColor2 * c2p + vec4(c3p * uColor3.rgb, c3p * uColor1.a)) + light;
}

void main() {
  gl_FragColor = effect(iResolution.xy, vUv * iResolution.xy);
}
`;

// ============================================================================
// 6. React Bits: WebGL Iridescence, Silk, Aurora, Dither, Mesh, Ripple, Particles
// ============================================================================
const IRIDESCENCE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 uColor;
uniform vec2 uMouse;
uniform float uScale;
uniform float uWarp;
uniform float uBrightness;

void main() {
  float mr = min(iResolution.x, iResolution.y);
  vec2 uv = (vUv * 2.0 - 1.0) * (iResolution / mr) / max(0.2, uScale);
  uv += (uMouse - vec2(0.5)) * 0.25;
  float d = -iTime * 0.5;
  float a = 0.0;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    a += cos(fi - d - a * uv.x * uWarp);
    d += sin(uv.y * fi + a);
  }
  d += iTime * 0.5;
  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor * uBrightness;
  gl_FragColor = vec4(col, 1.0);
}
`;

// React Bits Silk Shader (from Silk-CeuBV3Xo.js)
const SILK_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uScale;
uniform float uBrightness;
uniform vec2 uMouse;

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c) * uv;
}

void main() {
  vec2 uv = rotateUvs(vUv - 0.5, 0.32) * (1.8 / max(0.25, uScale)) + 0.5;
  vec2 p = uv * 4.5 + (uMouse - 0.5) * 0.4;
  float t = iTime * 0.85;
  for (int i = 1; i < 6; i++) {
    float fi = float(i);
    p.x += 0.42 / fi * sin(fi * 2.2 * p.y + t + 0.3 * fi);
    p.y += 0.38 / fi * cos(fi * 1.9 * p.x + t * 0.8 + 0.5 * fi);
  }
  float silk = 0.5 + 0.5 * sin(p.x * 2.4 + p.y * 1.8 + t * 0.5);
  float sheen = pow(max(0.0, sin(p.x * 3.5 - p.y * 2.5 + t)), 3.0);
  vec3 col = mix(uColor3, uColor2, silk * 0.85);
  col = mix(col, uColor1, sheen * 0.75 + silk * 0.35);
  gl_FragColor = vec4(col * uBrightness, 1.0);
}
`;

// React Bits Aurora Curtains Shader (from Aurora-CQIB4XiX.js)
const AURORA_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uScale;
uniform float uBrightness;
uniform vec2 uMouse;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2d(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise2d(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  float aspect = iResolution.x / max(1.0, iResolution.y);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) / max(0.3, uScale);
  float t = iTime * 0.45;
  float n1 = fbm(vec2(p.x * 2.2 + t * 0.6, p.y * 1.4 - t * 0.3));
  float n2 = fbm(vec2(p.x * 3.1 - t * 0.4 + n1 * 1.4, p.y * 2.0 + t * 0.25));
  float curtain1 = smoothstep(0.15, 0.85, 1.0 - abs(uv.y - (0.35 + (n1 - 0.5) * 0.55)));
  float curtain2 = smoothstep(0.2, 0.9, 1.0 - abs(uv.y - (0.62 + (n2 - 0.5) * 0.5)));
  vec3 col = uColor3 * 0.55;
  col += uColor1 * pow(curtain1, 1.6) * 0.95;
  col += uColor2 * pow(curtain2, 1.8) * 0.85;
  col += mix(uColor1, uColor2, n2) * 0.28;
  gl_FragColor = vec4(col * uBrightness, 1.0);
}
`;

// React Bits Ordered Bayer Dither Shader (from Dither-B-5KVqZg.js)
const DITHER_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uScale;
uniform float uBrightness;
uniform vec2 uMouse;

float bayer4(vec2 p) {
  vec2 m = floor(mod(p, 4.0));
  int idx = int(m.y * 4.0 + m.x);
  if (idx == 0) return 0.0 / 16.0;
  if (idx == 1) return 8.0 / 16.0;
  if (idx == 2) return 2.0 / 16.0;
  if (idx == 3) return 10.0 / 16.0;
  if (idx == 4) return 12.0 / 16.0;
  if (idx == 5) return 4.0 / 16.0;
  if (idx == 6) return 14.0 / 16.0;
  if (idx == 7) return 6.0 / 16.0;
  if (idx == 8) return 3.0 / 16.0;
  if (idx == 9) return 11.0 / 16.0;
  if (idx == 10) return 1.0 / 16.0;
  if (idx == 11) return 9.0 / 16.0;
  if (idx == 12) return 15.0 / 16.0;
  if (idx == 13) return 7.0 / 16.0;
  if (idx == 14) return 13.0 / 16.0;
  return 5.0 / 16.0;
}

void main() {
  float cellSize = max(2.0, floor(4.5 / max(0.4, uScale)));
  vec2 gridCoord = floor(gl_FragCoord.xy / cellSize);
  vec2 uv = (gridCoord * cellSize) / iResolution.xy;
  float t = iTime * 0.65;
  vec2 p = (uv - 0.5) * 3.0;
  float wave = 0.5 + 0.5 * sin(p.x * 2.4 + t + sin(p.y * 2.8 - t * 0.8));
  float mouseGlow = max(0.0, 1.0 - length(uv - uMouse) * 2.2) * 0.45;
  float field = clamp(wave * 0.78 + mouseGlow, 0.0, 1.0);
  float threshold = bayer4(gridCoord);
  float ditherBit = step(threshold, field);
  vec3 litCol = mix(uColor2, uColor1, uv.y * 0.7 + wave * 0.3);
  vec3 col = mix(uColor3 * 0.5, litCol * uBrightness, ditherBit);
  gl_FragColor = vec4(col, 1.0);
}
`;

// React Bits Volumetric Mesh / Plasma Shader (from Plasma-Oc__W4E2.js)
const MESH_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uScale;
uniform float uBrightness;
uniform vec2 uMouse;

void main() {
  vec2 uv = vUv;
  float t = iTime * 0.55;
  vec2 c1 = vec2(0.3 + 0.25 * sin(t * 0.9), 0.35 + 0.25 * cos(t * 0.7));
  vec2 c2 = vec2(0.7 + 0.22 * cos(t * 0.8), 0.65 + 0.24 * sin(t * 0.6));
  vec2 c3 = uMouse;
  float rScale = 1.35 * max(0.4, uScale);
  float w1 = exp(-length(uv - c1) * (2.2 / rScale));
  float w2 = exp(-length(uv - c2) * (2.4 / rScale));
  float w3 = exp(-length(uv - c3) * (2.8 / rScale));
  vec3 col = uColor3 * 0.45 + uColor1 * w1 * 0.95 + uColor2 * w2 * 0.85 + mix(uColor1, uColor2, 0.5) * w3 * 0.55;
  gl_FragColor = vec4(col * uBrightness, 1.0);
}
`;

// React Bits Ripple Interference Shader
const RIPPLE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uScale;
uniform float uBrightness;
uniform vec2 uMouse;

void main() {
  float aspect = iResolution.x / max(1.0, iResolution.y);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0) / max(0.35, uScale);
  vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0) * 0.35;
  float d1 = length(p - m);
  float d2 = length(p + m * 0.8);
  float t = iTime * 1.8;
  float r1 = 0.5 + 0.5 * sin(d1 * 24.0 - t);
  float r2 = 0.5 + 0.5 * cos(d2 * 18.0 - t * 0.85);
  float env = exp(-d1 * 1.45);
  float wave = (r1 * 0.6 + r2 * 0.4) * env;
  vec3 col = mix(uColor3 * 0.55, mix(uColor2, uColor1, r1), wave * 1.25);
  gl_FragColor = vec4(col * uBrightness, 1.0);
}
`;

// React Bits Nebula Particles Shader
const PARTICLES_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uScale;
uniform float uBrightness;
uniform vec2 uMouse;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float starLayer(vec2 uv, float scale, float t) {
  vec2 gv = fract(uv * scale) - 0.5;
  vec2 id = floor(uv * scale);
  float n = hash21(id);
  vec2 offset = vec2(n - 0.5, fract(n * 34.0) - 0.5) * 0.6;
  float d = length(gv - offset);
  float twinkle = 0.55 + 0.45 * sin(t * 2.5 + n * 6.2831);
  float spark = (0.025 / max(0.015, d)) * smoothstep(0.45, 0.05, d);
  return spark * twinkle * step(0.35, n);
}

void main() {
  float aspect = iResolution.x / max(1.0, iResolution.y);
  vec2 uv = (vUv - 0.5) * vec2(aspect, 1.0) / max(0.4, uScale);
  float t = iTime * 0.35;
  float s1 = starLayer(uv + vec2(t * 0.08, t * 0.05), 8.0, iTime);
  float s2 = starLayer(uv - vec2(t * 0.05, -t * 0.07), 14.0, iTime * 1.3);
  float nebula = exp(-length(uv) * 1.35) * 0.55;
  vec3 col = uColor3 * 0.5 + mix(uColor2, uColor1, vUv.x) * nebula;
  col += uColor1 * s1 * 0.9 + uColor2 * s2 * 0.75;
  gl_FragColor = vec4(col * uBrightness, 1.0);
}
`;

export type ShaderBgMode =
  | 'balatro'
  | 'iridescence'
  | 'silk'
  | 'aurora'
  | 'dither'
  | 'mesh'
  | 'ripple'
  | 'particles';

export const ReactBitsShaderBackground: React.FC<{
  mode: ShaderBgMode;
  color1: string;
  color2: string;
  color3: string;
  speed?: number;
  scale?: number;
  intensity?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  reactivity?: 'off' | 'low' | 'high';
}> = ({
  mode,
  color1,
  color2,
  color3,
  speed = 0.8,
  scale = 1.0,
  intensity = 0.85,
  brightness = 1.15,
  contrast = 1.15,
  saturation = 1.2,
  reactivity = 'low',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({
    mode,
    color1,
    color2,
    color3,
    speed,
    scale,
    intensity,
    brightness,
    contrast,
    saturation,
    reactivity,
  });

  useEffect(() => {
    propsRef.current = {
      mode,
      color1,
      color2,
      color3,
      speed,
      scale,
      intensity,
      brightness,
      contrast,
      saturation,
      reactivity,
    };
  }, [
    mode,
    color1,
    color2,
    color3,
    speed,
    scale,
    intensity,
    brightness,
    contrast,
    saturation,
    reactivity,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl =
      (canvas.getContext('webgl', { antialias: false, alpha: false }) as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl', {
        antialias: false,
        alpha: false,
      }) as WebGLRenderingContext | null);
    if (!gl) return;

    const compile = (type: number, src: string) => {
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

    const fragMap: Record<ShaderBgMode, string> = {
      balatro: BALATRO_FRAG,
      iridescence: IRIDESCENCE_FRAG,
      silk: SILK_FRAG,
      aurora: AURORA_FRAG,
      dither: DITHER_FRAG,
      mesh: MESH_FRAG,
      ripple: RIPPLE_FRAG,
      particles: PARTICLES_FRAG,
    };

    const fragSrc = fragMap[mode] || AURORA_FRAG;
    const vs = compile(gl.VERTEX_SHADER, BALATRO_VERT);
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(prog, 'aPosition');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const mouse = { x: 0.5, y: 0.5 };
    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX / Math.max(1, window.innerWidth);
      mouse.y = 1 - e.clientY / Math.max(1, window.innerHeight);
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    let animId = 0;
    let timeVal = Math.random() * 25;
    let lastNow = performance.now();

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      const p = propsRef.current;
      const rms = audioEngine.getRmsEnergy();
      const boost =
        p.reactivity === 'high' ? rms * 0.65 : p.reactivity === 'low' ? rms * 0.25 : 0;

      timeVal += dt * Math.max(0.05, p.speed) * (1 + boost);

      const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
      const w = Math.max(1, Math.floor(window.innerWidth * dpr));
      const h = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }

      const [r1, g1, b1] = hexToRgbNorm(p.color1);
      const [r2, g2, b2] = hexToRgbNorm(p.color2);
      const [r3, g3, b3] = hexToRgbNorm(p.color3);

      gl.uniform1f(gl.getUniformLocation(prog, 'iTime'), timeVal);
      gl.uniform2f(gl.getUniformLocation(prog, 'iResolution'), w, h);
      gl.uniform2f(gl.getUniformLocation(prog, 'uMouse'), mouse.x, mouse.y);

      const bright = Math.max(0.35, p.intensity) * (p.brightness ?? 1.15) + boost * 0.35;

      if (mode === 'balatro') {
        gl.uniform1f(gl.getUniformLocation(prog, 'uSpinRotation'), -2.0);
        gl.uniform1f(gl.getUniformLocation(prog, 'uSpinSpeed'), 4.5 * p.speed);
        gl.uniform4f(gl.getUniformLocation(prog, 'uColor1'), r1, g1, b1, 1.0);
        gl.uniform4f(gl.getUniformLocation(prog, 'uColor2'), r2, g2, b2, 1.0);
        gl.uniform4f(gl.getUniformLocation(prog, 'uColor3'), r3, g3, b3, 1.0);
        gl.uniform1f(
          gl.getUniformLocation(prog, 'uContrast'),
          2.6 * (p.contrast ?? 1.15)
        );
        gl.uniform1f(
          gl.getUniformLocation(prog, 'uLighting'),
          0.35 * bright
        );
        gl.uniform1f(
          gl.getUniformLocation(prog, 'uSpinAmount'),
          0.25 * p.scale + boost * 0.1
        );
        gl.uniform1f(gl.getUniformLocation(prog, 'uPixelFilter'), 745.0);
      } else if (mode === 'iridescence') {
        gl.uniform3f(gl.getUniformLocation(prog, 'uColor'), r1, g1, b1);
        gl.uniform1f(gl.getUniformLocation(prog, 'uScale'), p.scale);
        gl.uniform1f(gl.getUniformLocation(prog, 'uWarp'), 1.0 + boost * 0.5);
        gl.uniform1f(gl.getUniformLocation(prog, 'uBrightness'), bright);
      } else {
        gl.uniform3f(gl.getUniformLocation(prog, 'uColor1'), r1, g1, b1);
        gl.uniform3f(gl.getUniformLocation(prog, 'uColor2'), r2, g2, b2);
        gl.uniform3f(gl.getUniformLocation(prog, 'uColor3'), r3, g3, b3);
        gl.uniform1f(gl.getUniformLocation(prog, 'uScale'), p.scale);
        gl.uniform1f(gl.getUniformLocation(prog, 'uBrightness'), bright);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('pointermove', onMove);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [mode]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        filter: `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`,
      }}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};
