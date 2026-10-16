import React, { useEffect, useRef } from 'react';
import { VizConfig, VizType, Palette } from '../types';
import { audioEngine } from '../services/audioEngine';

interface AudioVisualizerProps {
  config: VizConfig;
  palette: Palette;
  width?: number;
  height?: number;
  isAroundCover?: boolean;
  className?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#38bdf8').replace('#', '').slice(0, 6);
  const num = parseInt(clean || '38bdf8', 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  config,
  palette,
  width = 480,
  height = 240,
  isAroundCover = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peaksRef = useRef<number[]>(new Array(128).fill(0));
  const smoothRef = useRef<number[]>(new Array(128).fill(0));
  const formantSmoothRef = useRef<[number, number, number, number]>([0, 0, 0, 0]);

  useEffect(() => {
    if (config.type === 'none' && config.secondaryLayers.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    let animId = 0;
    let phase = 0;

    // Resolve 0, 1, 2, 3 accent colors
    const accentCount = config.accentCount ?? 2;
    const isFlat = config.flatMode ?? true;

    const cPrimary =
      accentCount === 0 ? '#ffffff' : palette.vibrant || '#38bdf8';
    const cSecondary =
      accentCount === 0
        ? '#e2e8f0'
        : accentCount === 1
          ? cPrimary
          : palette.light || palette.accent || '#a855f7';
    const cTertiary =
      accentCount === 0
        ? '#94a3b8'
        : accentCount === 1
          ? cPrimary
          : accentCount === 2
            ? cSecondary
            : palette.dominant || '#ec4899';

    const accentList =
      accentCount === 0
        ? ['#ffffff']
        : accentCount === 1
          ? [cPrimary]
          : accentCount === 2
            ? [cPrimary, cSecondary]
            : [cPrimary, cSecondary, cTertiary];

    const [vr, vg, vb] = hexToRgb(cPrimary);
    const [lr, lg, lb] = hexToRgb(cSecondary);
    const [dr, dg, db] = hexToRgb(cTertiary);

    const drawSmoothClosedBlob = (
      cx: number,
      cy: number,
      baseR: number,
      lobeAmps: number[],
      rotOffset: number,
      deformStrength: number
    ) => {
      const n = lobeAmps.length;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rotOffset;
        const r = baseR + lobeAmps[i] * deformStrength;
        pts.push({
          x: cx + Math.cos(a) * r,
          y: cy + Math.sin(a) * r,
        });
      }

      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const p0 = pts[i];
        const p1 = pts[(i + 1) % n];
        const midX = (p0.x + p1.x) * 0.5;
        const midY = (p0.y + p1.y) * 0.5;
        if (i === 0) {
          const pPrev = pts[(i - 1 + n) % n];
          ctx.moveTo((pPrev.x + p0.x) * 0.5, (pPrev.y + p0.y) * 0.5);
        }
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      }
      ctx.closePath();
    };

    const drawLayer = (
      layerType: VizType,
      w: number,
      h: number,
      freq: Uint8Array,
      time: Uint8Array,
      rms: number,
      formants: [number, number, number, number],
      active: boolean,
      alphaScale: number
    ) => {
      if (layerType === 'none') return;

      const count = Math.min(128, Math.max(16, config.lineCount));
      const sens = config.sensitivity;
      // Fast syllable attack + natural release so every spoken word reacts in real time
      const releaseSmooth = Math.max(0.45, Math.min(0.88, config.smoothing * 0.85));

      ctx.save();
      ctx.globalAlpha = config.opacity * alphaScale;

      // Map visualizer bars across the real human voice spectrum (bins 2..110 = ~85 Hz to 4.7 kHz)
      const maxSpeechBin = config.speechMode
        ? Math.min(freq.length - 1, 108)
        : Math.min(freq.length - 1, 180);

      for (let i = 0; i < count; i++) {
        const normIdx = i / count;
        // Logarithmic-like mapping so fundamental voice pitch and vowel formants get rich resolution
        const binIdx = Math.min(
          maxSpeechBin,
          Math.max(1, Math.floor(2 + Math.pow(normIdx, 1.35) * (maxSpeechBin - 2)))
        );
        const rawNorm = active ? freq[binIdx] / 255 : 0;
        // Expand contrast so breath pauses drop to 0 and spoken syllables pop
        const gated =
          rawNorm < 0.04 ? 0 : Math.pow((rawNorm - 0.04) / 0.96, 1.3) * sens;
        const prev = smoothRef.current[i] || 0;
        // Fast attack on spoken consonant/vowel (0.58), smooth release on pause
        const val =
          gated > prev
            ? prev * 0.42 + gated * 0.58
            : prev * releaseSmooth + gated * (1 - releaseSmooth);
        smoothRef.current[i] = val < 0.003 ? 0 : val;

        if (val >= (peaksRef.current[i] || 0)) {
          peaksRef.current[i] = val;
        } else {
          peaksRef.current[i] = Math.max(0, (peaksRef.current[i] || 0) - 0.012);
        }
      }

      for (let k = 0; k < 4; k++) {
        const targetF = active ? Math.min(1.3, formants[k] * sens) : 0;
        const prevF = formantSmoothRef.current[k];
        // Fast syllable attack (0.56), crisp pause release (0.32)
        const alpha = targetF > prevF ? 0.56 : 0.32;
        const nextF = prevF * (1 - alpha) + targetF * alpha;
        formantSmoothRef.current[k] = nextF < 0.003 ? 0 : nextF;
      }

      const [f0, f1, f2, f3] = formantSmoothRef.current;

      // 1. CHATGPT VOICE ORB (Reacts in real time to live speech formants & FFT bins)
      if (layerType === 'chatgpt-orb' || layerType === 'orb' || layerType === 'breath') {
        const cx = w * 0.5;
        const cy = h * 0.5;
        const minDim = Math.min(w, h);
        // Scale pulse directly tied to real-time spoken voice loudness (rms & vowel F1)
        const voicePulse = active ? rms * 0.24 + f1 * 0.12 : 0;
        const baseR = minDim * (isAroundCover ? 0.38 : 0.27) * (1 + voicePulse);
        const deform = minDim * 0.11 * Math.min(1.6, sens);

        const nodes = 16;
        const outerLobes = Array.from({ length: nodes }, (_, i) => {
          const binSample = smoothRef.current[Math.floor((i / nodes) * (count * 0.75))] || 0;
          const a = (i / nodes) * Math.PI * 2;
          const harmonic =
            Math.sin(a * 2 + phase * 1.6) * f0 * 0.45 +
            Math.cos(a * 3 - phase * 2.1) * f1 * 0.4 +
            Math.sin(a * 5 + phase * 2.7) * f2 * 0.35;
          return binSample * 0.55 + harmonic * (0.4 + rms * 1.1);
        });

        // FLAT 2D VOICE ORB MODE (Crisp 2D geometric speech-reactive silhouette)
        if (isFlat) {
          if (accentCount >= 3) {
            const backLobes = outerLobes.map((v, idx) =>
              Math.cos(idx * 1.4 - phase * 1.1) * Math.abs(v) * 1.25 + f2 * 0.18
            );
            drawSmoothClosedBlob(
              cx,
              cy,
              baseR * (1.08 + f2 * 0.08),
              backLobes,
              -phase * 0.25,
              deform * 0.95
            );
            ctx.fillStyle = cTertiary;
            ctx.globalAlpha = config.opacity * alphaScale * 0.42;
            ctx.fill();
          }

          if (accentCount >= 2) {
            const midLobes = outerLobes.map((v, idx) =>
              Math.sin(idx * 1.6 + phase * 1.3) * Math.abs(v) * 1.12 + f1 * 0.14
            );
            drawSmoothClosedBlob(
              cx,
              cy,
              baseR * (1.03 + f1 * 0.05),
              midLobes,
              -phase * 0.15,
              deform * 0.9
            );
            ctx.fillStyle = cSecondary;
            ctx.globalAlpha = config.opacity * alphaScale * 0.6;
            ctx.fill();
          }

          ctx.globalAlpha = config.opacity * alphaScale;
          drawSmoothClosedBlob(cx, cy, baseR, outerLobes, phase * 0.28, deform);
          ctx.fillStyle = cPrimary;
          ctx.fill();
          ctx.restore();
          return;
        }

        // 3D SHADED VOICE ORB MODE
        const auraGrad = ctx.createRadialGradient(cx, cy, baseR * 0.2, cx, cy, baseR * 1.65);
        auraGrad.addColorStop(0, `rgba(${vr},${vg},${vb},${0.22 + rms * 0.35})`);
        auraGrad.addColorStop(0.55, `rgba(${dr},${dg},${db},0.12)`);
        auraGrad.addColorStop(1, `rgba(${dr},${dg},${db},0)`);
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, baseR * 1.65, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        drawSmoothClosedBlob(cx, cy, baseR, outerLobes, phase * 0.28, deform);

        const sphereGrad = ctx.createRadialGradient(
          cx - baseR * 0.28,
          cy - baseR * 0.32,
          baseR * 0.08,
          cx,
          cy,
          baseR * 1.15
        );
        sphereGrad.addColorStop(0, `rgba(${lr},${lg},${lb},0.95)`);
        sphereGrad.addColorStop(0.38, `rgba(${vr},${vg},${vb},0.92)`);
        sphereGrad.addColorStop(0.82, `rgba(${dr},${dg},${db},0.96)`);
        sphereGrad.addColorStop(
          1,
          `rgba(${Math.round(dr * 0.4)},${Math.round(dg * 0.4)},${Math.round(
            db * 0.4
          )},0.98)`
        );
        ctx.fillStyle = sphereGrad;
        ctx.fill();
        ctx.clip();

        ctx.globalCompositeOperation = 'screen';
        const causticCount = Math.max(1, accentCount);
        for (let c = 0; c < causticCount; c++) {
          const orbitAngle = phase * (0.65 + c * 0.25) + c * 2.1;
          const orbitDist =
            baseR * (0.18 + (c === 0 ? f0 : c === 1 ? f1 : f2) * 0.28);
          const lx = cx + Math.cos(orbitAngle) * orbitDist;
          const ly = cy + Math.sin(orbitAngle * 1.2) * orbitDist;
          const subR = baseR * (0.56 - c * 0.08);

          const innerLobes = outerLobes.map((v, idx) =>
            Math.sin(idx * 1.4 - phase * (1.2 + c * 0.5)) * Math.abs(v)
          );

          drawSmoothClosedBlob(
            lx,
            ly,
            subR,
            innerLobes,
            -phase * (0.35 + c * 0.2),
            deform * 0.85
          );
          const cg = ctx.createRadialGradient(
            lx,
            ly,
            subR * 0.05,
            lx,
            ly,
            subR * 1.1
          );
          if (c === 0) {
            cg.addColorStop(0, `rgba(255,255,255,${0.55 + f1 * 0.35})`);
            cg.addColorStop(0.55, `rgba(${lr},${lg},${lb},0.32)`);
            cg.addColorStop(1, `rgba(${vr},${vg},${vb},0)`);
          } else {
            cg.addColorStop(0, `rgba(${lr},${lg},${lb},${0.45 + f2 * 0.35})`);
            cg.addColorStop(0.6, `rgba(${vr},${vg},${vb},0.28)`);
            cg.addColorStop(1, `rgba(${dr},${dg},${db},0)`);
          }
          ctx.fillStyle = cg;
          ctx.fill();
        }
        ctx.restore();

        drawSmoothClosedBlob(cx, cy, baseR, outerLobes, phase * 0.28, deform);
        ctx.strokeStyle = `rgba(${lr},${lg},${lb},${0.28 + rms * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        return;
      }

      // 2. CHATGPT 4-DOT VOICE CAPSULES (Directly driven by live F0/F1/F2/F3 speech formants)
      if (layerType === 'chatgpt-dots') {
        const cx = w * 0.5;
        const cy = h * 0.5;
        const pillWidth = Math.max(14, Math.min(w, h) * 0.095);
        const gap = pillWidth * 0.65;
        const totalW = 4 * pillWidth + 3 * gap;
        const startX = cx - totalW * 0.5;
        const maxPillH = Math.min(w, h) * 0.62;

        // Each capsule responds to a distinct speech band (Pitch, Open Vowels, Tongue Formant, Sibilants)
        const bands = [
          Math.min(1, f0 * 0.75 + rms * 0.45),
          Math.min(1, f1 * 0.85 + rms * 0.55),
          Math.min(1, f2 * 0.9 + rms * 0.5),
          Math.min(1, f3 * 0.85 + f1 * 0.35),
        ];

        bands.forEach((val, idx) => {
          const activeH = Math.max(
            pillWidth,
            Math.min(maxPillH, pillWidth + val * (maxPillH - pillWidth))
          );
          const x = startX + idx * (pillWidth + gap);
          const y = cy - activeH * 0.5;

          if (isFlat) {
            ctx.fillStyle = accentList[idx % accentList.length];
            ctx.beginPath();
            ctx.roundRect(x, y, pillWidth, activeH, pillWidth * 0.5);
            ctx.fill();
          } else {
            const g = ctx.createLinearGradient(x, y, x, y + activeH);
            g.addColorStop(0, cSecondary);
            g.addColorStop(0.5, cPrimary);
            g.addColorStop(1, cTertiary);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.roundRect(x, y, pillWidth, activeH, pillWidth * 0.5);
            ctx.fill();
          }
        });
        ctx.restore();
        return;
      }

      // 3. REAL-TIME VOICE WAVEFORM / FLUID SILK / OSCILLOSCOPE (Traces actual PCM voice waveform)
      if (
        layerType === 'fluid-wave' ||
        layerType === 'aurora-ribbons' ||
        layerType === 'oscilloscope'
      ) {
        const midY = h * 0.5;
        const ribbonCount =
          layerType === 'oscilloscope' ? 1 : Math.max(1, accentCount || 1);

        for (let r = 0; r < ribbonCount; r++) {
          const pts: { x: number; y: number }[] = [];
          const segs = 48;
          for (let i = 0; i <= segs; i++) {
            const norm = i / segs;
            const x = norm * w;
            const env = Math.sin(norm * Math.PI);
            // Sample live PCM time-domain voice wave directly
            const tIdx = Math.min(
              time.length - 1,
              Math.floor(((norm + r * 0.08) % 1) * (time.length - 1))
            );
            const pcmSample = active ? ((time[tIdx] - 128) / 128) * 1.85 : 0;
            // Combine with live FFT formant bin at this position
            const fftSample =
              (smoothRef.current[Math.floor(norm * (count - 1))] || 0) *
              Math.sin(norm * Math.PI * (4 + r * 2) + phase * 2.2);

            const y =
              midY +
              (pcmSample * 0.68 + fftSample * 0.32) *
                env *
                (h * 0.44) *
                sens *
                (1 - r * 0.2);
            pts.push({ x, y });
          }

          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 0; i < pts.length - 1; i++) {
            const xc = (pts[i].x + pts[i + 1].x) * 0.5;
            const yc = (pts[i].y + pts[i + 1].y) * 0.5;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
          }
          ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

          ctx.strokeStyle = accentList[r % accentList.length];
          ctx.lineWidth = Math.max(1.4, config.thickness - r * 0.4);
          ctx.lineCap = 'round';
          ctx.stroke();

          if (
            !isFlat &&
            config.fill &&
            r === 0 &&
            layerType !== 'oscilloscope' &&
            rms > 0.01
          ) {
            ctx.lineTo(w, midY);
            ctx.lineTo(0, midY);
            ctx.closePath();
            const fg = ctx.createLinearGradient(
              0,
              midY - h * 0.35,
              0,
              midY + h * 0.35
            );
            fg.addColorStop(0, `rgba(${lr},${lg},${lb},0.22)`);
            fg.addColorStop(0.5, `rgba(${vr},${vg},${vb},0.05)`);
            fg.addColorStop(1, `rgba(${vr},${vg},${vb},0.22)`);
            ctx.fillStyle = fg;
            ctx.fill();
          }
        }
        ctx.restore();
        return;
      }

      // 4. COVER-OUTLINE BARS (Radial Cover Visualizer) & ORBITING HALO
      if (layerType === 'cover-outline' || layerType === 'halo') {
        const cx = w * 0.5;
        const cy = h * 0.5;
        const minDim = Math.min(w, h);
        const baseR =
          layerType === 'cover-outline'
            ? minDim * (isAroundCover ? 0.285 : 0.25) + config.offset * 0.5
            : minDim * 0.35 + config.offset * 0.5;

        if (layerType === 'halo') {
          const rings = Math.max(1, accentCount || 1);
          for (let ring = 0; ring < rings; ring++) {
            const nodes = 28;
            const ringLobes = Array.from({ length: nodes }, (_, i) => {
              const idx = Math.floor((i / nodes) * count);
              return (smoothRef.current[idx] || 0) * (1 - ring * 0.22);
            });
            drawSmoothClosedBlob(
              cx,
              cy,
              baseR + ring * 6,
              ringLobes,
              phase * (ring % 2 === 0 ? 0.5 : -0.4),
              28
            );
            ctx.strokeStyle = accentList[ring % accentList.length];
            ctx.lineWidth = Math.max(1.4, config.thickness - ring * 0.4);
            ctx.stroke();
          }
        } else {
          // Subtle inner glow ring tucked right underneath the circular cover's perimeter
          if (!isFlat) {
            const innerGlow = ctx.createRadialGradient(
              cx,
              cy,
              baseR * 0.85,
              cx,
              cy,
              baseR * (1.28 + rms * 0.25)
            );
            innerGlow.addColorStop(0, `rgba(${vr},${vg},${vb},${0.22 + rms * 0.3})`);
            innerGlow.addColorStop(1, `rgba(${vr},${vg},${vb},0)`);
            ctx.fillStyle = innerGlow;
            ctx.beginPath();
            ctx.arc(cx, cy, baseR * 1.45, 0, Math.PI * 2);
            ctx.fill();
          }

          const maxRadialSpan = minDim * (isAroundCover ? 0.18 : 0.2);
          for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
            const mirrorIdx = config.mirrored
              ? i < count / 2
                ? i
                : count - 1 - i
              : i;
            const val = Math.min(1.2, smoothRef.current[mirrorIdx] || 0);
            const barLen = 10 + val * maxRadialSpan;

            const x1 = cx + Math.cos(angle) * baseR;
            const y1 = cy + Math.sin(angle) * baseR;
            const x2 = cx + Math.cos(angle) * (baseR + barLen);
            const y2 = cy + Math.sin(angle) * (baseR + barLen);

            ctx.strokeStyle = accentList[i % accentList.length];
            ctx.lineWidth = Math.max(2, config.thickness * 1.15);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        }
        ctx.restore();
        return;
      }

      // 5. PRECISION BARS & MIRRORED BARS (Live Speech Spectrum)
      if (layerType === 'bars' || layerType === 'mirrored-bars') {
        const isMirror = layerType === 'mirrored-bars' || config.mirrored;
        const barW = Math.max(2, (w - count * 3) / count);
        const midY = isMirror ? h * 0.5 : h * 0.88;
        const maxBarH = isMirror ? h * 0.44 : h * 0.78;

        for (let i = 0; i < count; i++) {
          const idx = config.mirrored ? Math.abs(Math.floor(count / 2) - i) : i;
          const val = Math.min(1.08, smoothRef.current[idx] || 0);
          const bh = Math.max(2, val * maxBarH);
          const x = (w / count) * i + 1.5;

          if (isFlat) {
            ctx.fillStyle = accentList[i % accentList.length];
          } else {
            const grad = ctx.createLinearGradient(
              0,
              midY - bh,
              0,
              midY + (isMirror ? bh : 0)
            );
            grad.addColorStop(0, cSecondary);
            grad.addColorStop(0.5, cPrimary);
            grad.addColorStop(1, cTertiary);
            ctx.fillStyle = grad;
          }

          ctx.beginPath();
          ctx.roundRect(x, midY - bh, barW, isMirror ? bh * 2 : bh, barW * 0.5);
          ctx.fill();
        }
        ctx.restore();
        return;
      }

      // 6. DOTS / CONSTELLATION / SPECTROGRAM
      if (
        layerType === 'dots' ||
        layerType === 'spectrogram' ||
        layerType === 'constellation'
      ) {
        const pts: { x: number; y: number }[] = [];
        const nodeCount = 20;
        for (let i = 0; i < nodeCount; i++) {
          const val = smoothRef.current[i * 2] || 0;
          const angle = (i / nodeCount) * Math.PI * 2 + phase * 0.2;
          const rad = (0.16 + ((i * 7) % 10) * 0.028 + val * 0.22) * Math.min(w, h);
          pts.push({
            x: w * 0.5 + Math.cos(angle) * rad * (w / h) * 0.68,
            y: h * 0.5 + Math.sin(angle) * rad,
          });
        }
        ctx.strokeStyle = `rgba(${vr},${vg},${vb},0.3)`;
        ctx.lineWidth = 1;
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
            if (d < Math.min(w, h) * 0.36) {
              ctx.beginPath();
              ctx.moveTo(pts[i].x, pts[i].y);
              ctx.lineTo(pts[j].x, pts[j].y);
              ctx.stroke();
            }
          }
        }
        pts.forEach((p, idx) => {
          ctx.fillStyle = accentList[idx % accentList.length];
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2 + rms * 3.2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.restore();
    };

    const render = () => {
      animId = requestAnimationFrame(render);

      const { freq, time, rms, formants, active } = audioEngine.getAudioData(
        config.speechMode
      );

      // Advance phase ONLY when audio is actively playing, proportional to live speech energy
      if (active) {
        phase += 0.008 * (0.2 + rms * 1.8);
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      drawLayer(config.type, width, height, freq, time, rms, formants, active, 1.0);

      config.secondaryLayers.slice(0, 2).forEach((sec, idx) => {
        drawLayer(
          sec,
          width,
          height,
          freq,
          time,
          rms,
          formants,
          active,
          0.5 - idx * 0.15
        );
      });
      ctx.restore();
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [config, palette, width, height, isAroundCover]);

  if (config.type === 'none' && config.secondaryLayers.length === 0) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className={`pointer-events-none ${className}`}
    />
  );
};
