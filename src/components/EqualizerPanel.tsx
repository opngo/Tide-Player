import React from 'react';
import { EqualizerBand, Palette } from '../types';
import { EQ_PRESETS } from '../data/mockData';
import { Sliders, Volume2, Mic, FastForward, RotateCcw, X } from 'lucide-react';

interface EqualizerPanelProps {
  bands: EqualizerBand[];
  preampDb: number;
  voiceBoost: boolean;
  skipSilence: boolean;
  normalizeLoudness: boolean;
  palette: Palette;
  outputDevice?: string;
  onChangeBands: (bands: EqualizerBand[], preampDb: number) => void;
  onToggleVoiceBoost: () => void;
  onToggleSkipSilence: () => void;
  onToggleNormalize: () => void;
  onChangeDevice?: (dev: string) => void;
  onClose?: () => void;
  squareCorners: boolean;
}

export const EqualizerPanel: React.FC<EqualizerPanelProps> = ({
  bands,
  preampDb,
  voiceBoost,
  skipSilence,
  normalizeLoudness,
  palette,
  onChangeBands,
  onToggleVoiceBoost,
  onToggleSkipSilence,
  onToggleNormalize,
  onClose,
  squareCorners,
}) => {
  const pillRadius = squareCorners ? 'rounded-none' : 'rounded-xl';
  const radiusClass = squareCorners ? 'rounded-none' : 'rounded-3xl';

  const applyPreset = (presetName: string) => {
    const gains = EQ_PRESETS[presetName];
    if (!gains) return;
    const updated = bands.map((b, idx) => ({ ...b, gainDb: gains[idx] ?? 0 }));
    onChangeBands(updated, preampDb);
  };

  const handleBandChange = (index: number, val: number) => {
    const updated = bands.map((b, idx) =>
      idx === index ? { ...b, gainDb: val } : b
    );
    onChangeBands(updated, preampDb);
  };

  const svgW = 360;
  const svgH = 88;
  const midY = svgH / 2;

  const points = bands.map((b, idx) => {
    const x = (idx / (bands.length - 1)) * (svgW - 24) + 12;
    const y = midY - (b.gainDb / 12) * (midY - 10);
    return { x, y };
  });

  let pathD = '';
  points.forEach((pt, idx) => {
    if (idx === 0) {
      pathD += `M ${pt.x} ${pt.y}`;
    } else {
      const prev = points[idx - 1];
      const cx = (prev.x + pt.x) / 2;
      pathD += ` C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    }
  });

  const fillD = `${pathD} L ${points[points.length - 1].x} ${svgH} L ${points[0].x} ${svgH} Z`;

  const content = (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`w-full max-w-lg p-6 ${radiusClass} backdrop-blur-3xl bg-zinc-950/85 shadow-[0_28px_90px_rgba(0,0,0,0.85)] space-y-5 select-none text-xs animate-enter`}
    >
      {/* Top row: Title + Presets + Close */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 font-medium text-white">
          <Sliders className="w-4 h-4" style={{ color: palette.vibrant }} />
          <span>Equalizer & DSP</span>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {Object.keys(EQ_PRESETS).map((preset) => (
            <button
              key={preset}
              onClick={() => applyPreset(preset)}
              className={`px-2.5 py-1 ${pillRadius} text-[11px] font-mono bg-white/[0.06] hover:bg-white/[0.14] text-white/75 hover:text-white transition-colors`}
            >
              {preset}
            </button>
          ))}
          <button
            onClick={() => applyPreset('Flat')}
            className={`p-1.5 ${pillRadius} bg-white/[0.06] hover:bg-white/[0.14] text-white/50 hover:text-white`}
            title="Reset EQ"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className={`p-1.5 ${pillRadius} bg-white/[0.06] hover:bg-white/[0.14] text-white/60 hover:text-white ml-1`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Live Frequency Response Curve SVG */}
      <div className={`relative w-full h-24 ${pillRadius} bg-black/50 overflow-hidden`}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">
          <defs>
            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.vibrant} stopOpacity="0.45" />
              <stop offset="100%" stopColor={palette.vibrant} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <line
            x1="0"
            y1={midY}
            x2={svgW}
            y2={midY}
            stroke="rgba(255,255,255,0.1)"
            strokeDasharray="3 3"
          />
          <path d={fillD} fill="url(#eqFill)" />
          <path
            d={pathD}
            fill="none"
            stroke={palette.vibrant}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {points.map((pt, idx) => (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r="3.2"
              fill="#fff"
              stroke={palette.vibrant}
              strokeWidth="1.5"
            />
          ))}
        </svg>
      </div>

      {/* Preamp + 10-Band Sliders */}
      <div className="grid grid-cols-11 gap-1.5 items-center pt-1">
        {/* Preamp */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] font-mono text-white/45">
            {preampDb > 0 ? `+${preampDb}` : preampDb}
          </span>
          <div className="h-24 flex items-center justify-center">
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={preampDb}
              onChange={(e) => onChangeBands(bands, Number(e.target.value))}
              className="w-20 -rotate-90"
            />
          </div>
          <span className="text-[10px] font-mono text-white/50">PRE</span>
        </div>

        {/* 10 Frequency Bands */}
        {bands.map((b, idx) => (
          <div key={b.freq} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-mono text-white/45">
              {b.gainDb > 0 ? `+${b.gainDb}` : b.gainDb}
            </span>
            <div className="h-24 flex items-center justify-center">
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={b.gainDb}
                onChange={(e) => handleBandChange(idx, Number(e.target.value))}
                className="w-20 -rotate-90"
              />
            </div>
            <span className="text-[10px] font-mono text-white/45">{b.label}</span>
          </div>
        ))}
      </div>

      {/* DSP Toggles */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <button
          onClick={onToggleVoiceBoost}
          className={`p-2.5 ${pillRadius} flex items-center justify-center gap-1.5 transition-all ${
            voiceBoost
              ? 'bg-white/20 text-white font-medium'
              : 'bg-white/[0.04] text-white/55 hover:text-white'
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Voice Boost</span>
        </button>

        <button
          onClick={onToggleSkipSilence}
          className={`p-2.5 ${pillRadius} flex items-center justify-center gap-1.5 transition-all ${
            skipSilence
              ? 'bg-white/20 text-white font-medium'
              : 'bg-white/[0.04] text-white/55 hover:text-white'
          }`}
        >
          <FastForward className="w-3.5 h-3.5" />
          <span>Skip Silence</span>
        </button>

        <button
          onClick={onToggleNormalize}
          className={`p-2.5 ${pillRadius} flex items-center justify-center gap-1.5 transition-all ${
            normalizeLoudness
              ? 'bg-white/20 text-white font-medium'
              : 'bg-white/[0.04] text-white/55 hover:text-white'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Normalize</span>
        </button>
      </div>
    </div>
  );

  if (onClose) {
    return (
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
      >
        {content}
      </div>
    );
  }

  return content;
};
