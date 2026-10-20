import React from 'react';
import { BgConfig, Palette } from '../types';
import { CRTWarpBackground } from './CRTWarpBackground';
import {
  ReactBitsShaderBackground,
  ShaderBgMode,
} from './ReactBitsComponents';

interface DynamicBackgroundProps {
  config: BgConfig;
  palette: Palette;
  coverUrl: string;
  isPlaying: boolean;
}

export const DynamicBackground: React.FC<DynamicBackgroundProps> = ({
  config,
  palette,
  coverUrl,
}) => {
  const accentCount = config.accentCount ?? 2;

  const primaryColor =
    accentCount === 0 || config.colorSource === 'mono'
      ? '#cbd5e1'
      : config.colorSource === 'custom'
      ? config.customColor
      : palette.vibrant || '#c755f7';

  const secondaryColor =
    accentCount === 0 || config.colorSource === 'mono'
      ? '#64748b'
      : accentCount === 1
      ? primaryColor
      : config.colorSource === 'custom'
      ? config.customColor
      : palette.dominant || '#7c3aed';

  const baseDark =
    accentCount === 0 || config.colorSource === 'mono'
      ? '#09090b'
      : accentCount === 3
      ? palette.accentSoft || palette.dark || '#0a0514'
      : palette.dark || '#06020c';

  const brightness = config.brightness ?? 1.15;
  const contrast = config.contrast ?? 1.15;
  const saturation = accentCount === 0 ? 0 : config.saturation ?? 1.25;
  const cssFilter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;

  if (config.type === 'oled') {
    return <div className="fixed inset-0 bg-black pointer-events-none z-0" />;
  }

  if (config.type === 'solid') {
    return (
      <div
        className="fixed inset-0 pointer-events-none z-0 transition-colors duration-700"
        style={{
          backgroundColor: baseDark,
          filter: cssFilter,
        }}
      />
    );
  }

  if (config.type === 'blurred-cover') {
    return (
      <div
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
        style={{ backgroundColor: baseDark, filter: cssFilter }}
      >
        <img
          src={coverUrl}
          alt=""
          className="w-full h-full object-cover scale-125 transition-all duration-1000"
          style={{
            filter: `blur(${Math.round(52 * config.scale)}px) saturate(1.55)`,
            opacity: Math.max(0.35, config.intensity * 0.85),
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 38%, transparent 15%, ${baseDark} 94%)`,
          }}
        />
      </div>
    );
  }

  if (config.type === 'crt-warp') {
    return (
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{ filter: cssFilter }}
      >
        <CRTWarpBackground
          color={primaryColor}
          backgroundColor={baseDark}
          speed={0.25 + config.speed * 0.85}
          curvature={0.25 * config.scale}
          scanlineStrength={0.25}
          scanlineFrequency={200}
          waveAmplitude={0.3 * Math.max(0.45, config.intensity)}
          waveFrequency={2.5}
          bloom={1.5 * Math.max(0.5, config.intensity)}
          bloomRadius={1.0}
          noise={0.1}
          vignette={0.15}
          brightness={1.25 * brightness}
          pixelation={1.0}
          rgbShift={0.015}
          mouseReact={true}
          mouseStrength={0.5}
          fps={config.fpsCap}
          reactivity={config.reactivity}
        />
      </div>
    );
  }

  const shaderMode: ShaderBgMode =
    config.type === 'balatro' ||
    config.type === 'iridescence' ||
    config.type === 'silk' ||
    config.type === 'aurora' ||
    config.type === 'dither' ||
    config.type === 'mesh' ||
    config.type === 'ripple' ||
    config.type === 'particles'
      ? config.type
      : 'aurora';

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      style={{ filter: cssFilter }}
    >
      <ReactBitsShaderBackground
        mode={shaderMode}
        color1={primaryColor}
        color2={secondaryColor}
        color3={baseDark}
        speed={config.speed}
        intensity={Math.max(0.55, config.intensity)}
        scale={config.scale}
        brightness={brightness}
        contrast={contrast}
        saturation={saturation}
        reactivity={config.reactivity}
      />
    </div>
  );
};
