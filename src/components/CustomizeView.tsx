import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Palette as PaletteIcon,
  Eye,
  Layers,
  Plus,
  Trash2,
  Check,
  Lock,
  Unlock,
  Database,
  RefreshCw,
  Wrench,
  RotateCcw,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import {
  BgConfig,
  BgType,
  VizConfig,
  VizType,
  Palette,
  ThemeMode,
  ColorScheme,
  CoverShape,
  ProgressBarStyle,
  FontChoice,
  ScenePreset,
  Book,
} from '../types';
import { SCENE_PRESETS, PALETTES, derivePaletteFromCustom } from '../data/mockData';
import {
  ReactBitsColorPickerPopover,
  ReactBitsSpotlightCard,
} from './ReactBitsComponents';

export type CustomThemePreset = {
  id: string;
  name: string;
  palette: Palette;
};

interface CustomizeViewProps {
  palette: Palette;
  coverUrl: string;
  bgConfig: BgConfig;
  onChangeBg: (cfg: BgConfig) => void;
  vizConfig: VizConfig;
  onChangeViz: (cfg: VizConfig) => void;
  themeMode: ThemeMode;
  onChangeThemeMode: (m: ThemeMode) => void;
  colorScheme: ColorScheme;
  onChangeColorScheme: (s: ColorScheme) => void;
  coverShape: CoverShape;
  onChangeCoverShape: (c: CoverShape) => void;
  progressBarStyle: ProgressBarStyle;
  onChangeProgressBarStyle: (p: ProgressBarStyle) => void;
  squareCorners: boolean;
  onToggleSquareCorners: () => void;
  lockTheme: boolean;
  onToggleLockTheme: () => void;
  onSelectOverridePalette: (p: Palette) => void;
  customThemes: CustomThemePreset[];
  onSaveCustomTheme: (theme: CustomThemePreset) => void;
  onDeleteCustomTheme: (id: string) => void;
  sidebarFrosted: boolean;
  onToggleSidebarFrosted: () => void;
  fontFamily: FontChoice;
  onChangeFontFamily: (f: FontChoice) => void;
  shellMode: 'sidebar' | 'dock';
  onChangeShellMode: (m: 'sidebar' | 'dock') => void;
  onApplyScene: (scene: ScenePreset) => void;
  books: Book[];
  watchedRoots: string[];
  onForceIndex: () => Promise<void>;
  onRepairLibrary: () => Promise<void>;
  onResetLibrary: () => Promise<void>;
  clickSparkEnabled?: boolean;
  onToggleClickSpark?: () => void;
}

interface DropdownOption<T extends string> {
  id: T;
  label: string;
  badge?: string;
}

function CustomDropdown<T extends string>({
  value,
  options,
  onChange,
  accentColor,
  radiusClass,
}: {
  value: T;
  options: DropdownOption<T>[];
  onChange: (val: T) => void;
  accentColor: string;
  radiusClass: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const selected = options.find((o) => o.id === value) || options[0];

  return (
    <div ref={ref} className="relative min-w-[165px] max-w-[220px] w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full h-9 px-3 ${radiusClass} bg-white/[0.07] hover:bg-white/[0.12] flex items-center justify-between gap-2 text-xs font-medium text-white transition-all`}
      >
        <span className="truncate">{selected?.label || value}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-white/50 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute right-0 mt-1.5 w-full min-w-[190px] max-h-64 overflow-y-auto py-1.5 ${radiusClass} bg-[#0c0c14]/95 backdrop-blur-3xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] z-50`}
        >
          {options.map((opt) => {
            const active = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                  active
                    ? 'bg-white/[0.12] text-white font-semibold'
                    : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {opt.badge && (
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.08] text-white/55">
                      {opt.badge}
                    </span>
                  )}
                  {active && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: accentColor }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettingSlider({
  label,
  valueDisplay,
  value,
  min,
  max,
  step,
  onChange,
  accentColor,
  marks,
}: {
  label: string;
  valueDisplay: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  accentColor: string;
  marks?: string[];
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-white/75 font-medium truncate">{label}</span>
        <span className="font-mono text-white/60 tabular-nums shrink-0">
          {valueDisplay}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-lg appearance-none bg-white/15 cursor-pointer"
        style={{ accentColor }}
      />
      {marks && marks.length > 0 && (
        <div className="flex justify-between text-[10px] font-mono text-white/35 px-0.5">
          {marks.map((m, idx) => (
            <span key={idx}>{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingToggle({
  label,
  checked,
  onToggle,
  accentColor,
  radiusClass,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  accentColor: string;
  radiusClass: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 min-w-0">
      <span className="text-xs font-medium text-white/80 truncate">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        className={`w-11 h-6 ${radiusClass} p-0.5 transition-colors shrink-0 flex items-center ${
          checked ? 'justify-end' : 'justify-start bg-white/[0.12]'
        }`}
        style={checked ? { backgroundColor: accentColor } : undefined}
      >
        <span className="w-5 h-5 rounded-full bg-white shadow-md transition-transform" />
      </button>
    </div>
  );
}

const BG_OPTIONS: DropdownOption<BgType>[] = [
  { id: 'crt-warp', label: 'CRT Warp', badge: 'GLSL' },
  { id: 'balatro', label: 'Balatro Swirl', badge: 'GLSL' },
  { id: 'iridescence', label: 'Iridescence', badge: 'GLSL' },
  { id: 'aurora', label: 'Aurora Veil', badge: 'GLSL' },
  { id: 'silk', label: 'Fluid Silk', badge: 'GLSL' },
  { id: 'dither', label: 'Bayer Dither', badge: 'GLSL' },
  { id: 'mesh', label: 'Plasma Mesh', badge: 'GLSL' },
  { id: 'ripple', label: 'Wave Ripple', badge: 'GLSL' },
  { id: 'particles', label: 'Starfield', badge: 'GLSL' },
  { id: 'blurred-cover', label: 'Cover Blur' },
  { id: 'solid', label: 'Solid Minimal' },
  { id: 'oled', label: 'Pure Black' },
];

const VIZ_OPTIONS: DropdownOption<VizType>[] = [
  { id: 'chatgpt-orb', label: 'Voice Orb' },
  { id: 'chatgpt-dots', label: 'Voice Dots' },
  { id: 'fluid-wave', label: 'Silk Wave' },
  { id: 'bars', label: 'Spectrum Bars' },
  { id: 'mirrored-bars', label: 'Mirror Bars' },
  { id: 'halo', label: 'Orbit Halo' },
  { id: 'cover-outline', label: 'Cover Radial' },
  { id: 'aurora-ribbons', label: 'Ribbons' },
  { id: 'oscilloscope', label: 'Oscilloscope' },
  { id: 'constellation', label: 'Nodes' },
  { id: 'none', label: 'Off' },
];

const SEEKBAR_OPTIONS: DropdownOption<ProgressBarStyle>[] = [
  { id: 'simple', label: 'Simple (No Gradients)', badge: 'FLAT' },
  { id: 'simple-chapter', label: 'Simple Chapter Split', badge: 'FLAT' },
  { id: 'screen-veil', label: 'Full-Screen Wipe' },
  { id: 'wave', label: 'Neon Soundwave' },
  { id: 'chaptered', label: 'Glass Chapters' },
  { id: 'line', label: 'Laser Horizon' },
  { id: 'stepped', label: 'Stepped Blocks', badge: 'FLAT' },
  { id: 'minimal-ticks', label: 'Ruler Ticks', badge: 'FLAT' },
  { id: 'dual', label: 'Dual Macro + Chapter' },
  { id: 'dots', label: 'LED Matrix' },
];

const COVER_SHAPE_OPTIONS: DropdownOption<CoverShape>[] = [
  { id: 'rounded', label: 'Rounded Sleeve' },
  { id: 'square', label: 'Sharp Square' },
  { id: 'circle', label: 'Circular Disc' },
  { id: 'vinyl', label: 'Spinning Vinyl LP' },
  { id: 'cd-jewel', label: 'Optical CD Jewel' },
  { id: 'hardcover', label: 'Hardcover Book Spine' },
  { id: 'floating-glass', label: 'Frosted Glass Frame' },
  { id: 'polaroid', label: 'Editorial Polaroid' },
  { id: 'tape', label: 'Analog Cassette Tape' },
  { id: 'octagon', label: 'Geometric Octagon' },
];

const FONT_OPTIONS: DropdownOption<FontChoice>[] = [
  { id: 'geist', label: 'Satoshi' },
  { id: 'jakarta', label: 'Space Grotesk' },
  { id: 'instrument', label: 'Plus Jakarta' },
  { id: 'newsreader', label: 'Newsreader Serif' },
];

type SettingsSection = 'all' | 'shaders' | 'visualizer' | 'interface' | 'theme' | 'storage';

export const CustomizeView: React.FC<CustomizeViewProps> = ({
  palette,
  bgConfig,
  onChangeBg,
  vizConfig,
  onChangeViz,
  themeMode,
  onChangeThemeMode,
  colorScheme,
  onChangeColorScheme,
  coverShape,
  onChangeCoverShape,
  progressBarStyle,
  onChangeProgressBarStyle,
  squareCorners,
  onToggleSquareCorners,
  lockTheme,
  onToggleLockTheme,
  onSelectOverridePalette,
  customThemes,
  onSaveCustomTheme,
  onDeleteCustomTheme,
  sidebarFrosted,
  onToggleSidebarFrosted,
  fontFamily,
  onChangeFontFamily,
  shellMode,
  onChangeShellMode,
  onApplyScene,
  books,
  watchedRoots,
  onForceIndex,
  onRepairLibrary,
  onResetLibrary,
  clickSparkEnabled = true,
  onToggleClickSpark,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('all');
  const [indexBusy, setIndexBusy] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [themeName, setThemeName] = useState('Midnight Neon');
  const [primaryHex, setPrimaryHex] = useState('#38bdf8');
  const [accentHex, setAccentHex] = useState('#a855f7');
  const [bgHex, setBgHex] = useState('#070b14');

  const cardRadius = squareCorners ? 'rounded-none' : 'rounded-2xl';
  const pillRadius = squareCorners ? 'rounded-none' : 'rounded-xl';

  const previewBuiltPalette = derivePaletteFromCustom(primaryHex, accentHex, bgHex);

  const handleCreateTheme = () => {
    if (!themeName.trim()) return;
    const newTheme = {
      id: `custom-${Date.now()}`,
      name: themeName.trim(),
      palette: previewBuiltPalette,
    };
    onSaveCustomTheme(newTheme);
    onSelectOverridePalette(newTheme.palette);
    setBuilderOpen(false);
  };

  const navTabs: { id: SettingsSection; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'all', label: 'All', icon: Sliders },
    { id: 'shaders', label: 'Shaders', icon: Layers },
    { id: 'visualizer', label: 'Visualizer', icon: Sparkles },
    { id: 'interface', label: 'Player & UI', icon: Eye },
    { id: 'theme', label: 'Themes', icon: PaletteIcon },
    { id: 'storage', label: 'Storage', icon: Database },
  ];

  const showSection = (sec: SettingsSection) =>
    activeSection === 'all' || activeSection === sec;

  return (
    <div className="h-full overflow-y-auto px-8 sm:px-12 py-10 pb-32 max-w-5xl mx-auto space-y-7 select-none">
      {/* Compact Header + Category Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>

        <div className={`flex items-center gap-1 p-1.5 ${pillRadius} bg-white/[0.05] overflow-x-auto`}>
          {navTabs.map((t) => {
            const Icon = t.icon;
            const active = activeSection === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveSection(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 ${pillRadius} text-xs font-medium transition-all whitespace-nowrap ${
                  active
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* GROUP 1: SHADERS & BACKGROUND */}
        {showSection('shaders') && (
          <ReactBitsSpotlightCard
            spotlightColor={`${palette.vibrant}22`}
            className={`p-6 sm:p-7 ${cardRadius} bg-white/[0.04] backdrop-blur-2xl`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
                <Layers className="w-3.5 h-3.5" style={{ color: palette.vibrant }} />
                <span>Background Shader</span>
              </div>
              <button
                onClick={() =>
                  onChangeBg({
                    ...bgConfig,
                    brightness: 1.15,
                    contrast: 1.15,
                    saturation: 1.25,
                    intensity: 0.78,
                    speed: 0.5,
                    scale: 1.0,
                    accentCount: 2,
                  })
                }
                className="text-[11px] text-white/40 hover:text-white transition-colors"
              >
                Reset
              </button>
            </div>

            {/* Dropdowns */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-white/80 truncate">Shader</span>
                <CustomDropdown
                  value={bgConfig.type}
                  options={BG_OPTIONS}
                  onChange={(type) => onChangeBg({ ...bgConfig, type })}
                  accentColor={palette.vibrant}
                  radiusClass={pillRadius}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-white/80 truncate">Color Source</span>
                <CustomDropdown
                  value={bgConfig.colorSource}
                  options={[
                    { id: 'cover', label: 'Book Cover' },
                    { id: 'custom', label: 'Custom Color' },
                    { id: 'mono', label: 'Monochrome' },
                  ]}
                  onChange={(colorSource) => onChangeBg({ ...bgConfig, colorSource })}
                  accentColor={palette.vibrant}
                  radiusClass={pillRadius}
                />
              </div>

              {bgConfig.colorSource === 'custom' && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs font-medium text-white/80 truncate">Shader Tint</span>
                  <ReactBitsColorPickerPopover
                    title="Tint"
                    color={bgConfig.customColor}
                    onChange={(hex) =>
                      onChangeBg({ ...bgConfig, colorSource: 'custom', customColor: hex })
                    }
                  />
                </div>
              )}
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <SettingSlider
                label="Accents"
                valueDisplay={`${bgConfig.accentCount ?? 2}`}
                value={bgConfig.accentCount ?? 2}
                min={0}
                max={3}
                step={1}
                marks={['0', '1', '2', '3']}
                onChange={(v) =>
                  onChangeBg({ ...bgConfig, accentCount: v as 0 | 1 | 2 | 3 })
                }
                accentColor={palette.vibrant}
              />

              <SettingSlider
                label="Intensity"
                valueDisplay={`${Math.round(bgConfig.intensity * 100)}%`}
                value={bgConfig.intensity}
                min={0.15}
                max={1}
                step={0.01}
                onChange={(intensity) => onChangeBg({ ...bgConfig, intensity })}
                accentColor={palette.vibrant}
              />

              <SettingSlider
                label="Speed"
                valueDisplay={`${Math.round(bgConfig.speed * 100)}%`}
                value={bgConfig.speed}
                min={0}
                max={1}
                step={0.01}
                onChange={(speed) => onChangeBg({ ...bgConfig, speed })}
                accentColor={palette.vibrant}
              />

              <SettingSlider
                label="Scale"
                valueDisplay={`${bgConfig.scale.toFixed(1)}×`}
                value={bgConfig.scale}
                min={0.5}
                max={2}
                step={0.05}
                onChange={(scale) => onChangeBg({ ...bgConfig, scale })}
                accentColor={palette.vibrant}
              />

              <SettingSlider
                label="Brightness"
                valueDisplay={`${Math.round((bgConfig.brightness ?? 1.15) * 100)}%`}
                value={bgConfig.brightness ?? 1.15}
                min={0.4}
                max={2.2}
                step={0.05}
                onChange={(brightness) => onChangeBg({ ...bgConfig, brightness })}
                accentColor={palette.vibrant}
              />

              <SettingSlider
                label="Contrast"
                valueDisplay={`${Math.round((bgConfig.contrast ?? 1.15) * 100)}%`}
                value={bgConfig.contrast ?? 1.15}
                min={0.5}
                max={2.5}
                step={0.05}
                onChange={(contrast) => onChangeBg({ ...bgConfig, contrast })}
                accentColor={palette.vibrant}
              />

              <SettingSlider
                label="Saturation"
                valueDisplay={`${Math.round((bgConfig.saturation ?? 1.25) * 100)}%`}
                value={bgConfig.saturation ?? 1.25}
                min={0}
                max={2.5}
                step={0.05}
                onChange={(saturation) => onChangeBg({ ...bgConfig, saturation })}
                accentColor={palette.vibrant}
              />

              <SettingSlider
                label="Billboard Text Speed"
                valueDisplay={`${bgConfig.slickTextSpeed ?? 18}`}
                value={bgConfig.slickTextSpeed ?? 18}
                min={5}
                max={120}
                step={1}
                onChange={(slickTextSpeed) =>
                  onChangeBg({ ...bgConfig, slickTextSpeed })
                }
                accentColor={palette.vibrant}
              />
            </div>
          </ReactBitsSpotlightCard>
        )}

        {/* GROUP 2: VOICE ORB, DOTS & VISUALIZER */}
        {showSection('visualizer') && (
          <ReactBitsSpotlightCard
            spotlightColor={`${palette.vibrant}22`}
            className={`p-6 sm:p-7 ${cardRadius} bg-white/[0.04] backdrop-blur-2xl`}
          >
            <div className="flex items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
                <Sparkles className="w-3.5 h-3.5" style={{ color: palette.vibrant }} />
                <span>Visualizer & Voice</span>
              </div>
              <span className="text-[11px] font-mono text-white/40">
                {vizConfig.flatMode ?? true ? 'Flat 2D' : '3D Shaded'} ·{' '}
                {vizConfig.accentCount ?? 2} Accents
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-white/80 truncate">Mode</span>
                <CustomDropdown
                  value={vizConfig.type}
                  options={VIZ_OPTIONS}
                  onChange={(type) => onChangeViz({ ...vizConfig, type })}
                  accentColor={palette.vibrant}
                  radiusClass={pillRadius}
                />
              </div>

              <SettingToggle
                label="Flat 2D Mode (Voice Orb & Dots)"
                checked={vizConfig.flatMode ?? true}
                onToggle={() =>
                  onChangeViz({ ...vizConfig, flatMode: !(vizConfig.flatMode ?? true) })
                }
                accentColor={palette.vibrant}
                radiusClass="rounded-full"
              />

              <SettingToggle
                label="Voice Frequency Focus"
                checked={vizConfig.speechMode}
                onToggle={() =>
                  onChangeViz({ ...vizConfig, speechMode: !vizConfig.speechMode })
                }
                accentColor={palette.vibrant}
                radiusClass="rounded-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <SettingSlider
                label="Accents"
                valueDisplay={`${vizConfig.accentCount ?? 2}`}
                value={vizConfig.accentCount ?? 2}
                min={0}
                max={3}
                step={1}
                marks={['0', '1', '2', '3']}
                onChange={(v) =>
                  onChangeViz({ ...vizConfig, accentCount: v as 0 | 1 | 2 | 3 })
                }
                accentColor={palette.vibrant}
              />

              <SettingSlider
                label="Sensitivity"
                valueDisplay={`${vizConfig.sensitivity.toFixed(1)}×`}
                value={vizConfig.sensitivity}
                min={0.3}
                max={2.5}
                step={0.05}
                onChange={(sensitivity) => onChangeViz({ ...vizConfig, sensitivity })}
                accentColor={palette.vibrant}
              />

              <SettingSlider
                label="Smoothness"
                valueDisplay={`${Math.round(vizConfig.smoothing * 100)}%`}
                value={vizConfig.smoothing}
                min={0.5}
                max={0.95}
                step={0.01}
                onChange={(smoothing) => onChangeViz({ ...vizConfig, smoothing })}
                accentColor={palette.vibrant}
              />

              <SettingSlider
                label="Opacity"
                valueDisplay={`${Math.round(vizConfig.opacity * 100)}%`}
                value={vizConfig.opacity}
                min={0.2}
                max={1}
                step={0.02}
                onChange={(opacity) => onChangeViz({ ...vizConfig, opacity })}
                accentColor={palette.vibrant}
              />

              <SettingSlider
                label="Bar Density"
                valueDisplay={`${vizConfig.lineCount}`}
                value={vizConfig.lineCount}
                min={24}
                max={128}
                step={8}
                onChange={(lineCount) =>
                  onChangeViz({ ...vizConfig, lineCount: Math.round(lineCount) })
                }
                accentColor={palette.vibrant}
              />

              <SettingSlider
                label="Thickness"
                valueDisplay={`${vizConfig.thickness}px`}
                value={vizConfig.thickness}
                min={1}
                max={8}
                step={0.5}
                onChange={(thickness) => onChangeViz({ ...vizConfig, thickness })}
                accentColor={palette.vibrant}
              />
            </div>
          </ReactBitsSpotlightCard>
        )}

        {/* GROUP 3: PLAYER & INTERFACE */}
        {showSection('interface') && (
          <ReactBitsSpotlightCard
            spotlightColor={`${palette.vibrant}22`}
            className={`p-6 sm:p-7 ${cardRadius} bg-white/[0.04] backdrop-blur-2xl`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60 pb-1">
              <Eye className="w-3.5 h-3.5" style={{ color: palette.vibrant }} />
              <span>Player & Interface</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-white/80 truncate">Scene Preset</span>
                <CustomDropdown
                  value={SCENE_PRESETS[0].id}
                  options={SCENE_PRESETS.map((s) => ({ id: s.id, label: s.name }))}
                  onChange={(id) => {
                    const found = SCENE_PRESETS.find((s) => s.id === id);
                    if (found) onApplyScene(found);
                  }}
                  accentColor={palette.vibrant}
                  radiusClass={pillRadius}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-white/80 truncate">Seekbar Style</span>
                <CustomDropdown
                  value={progressBarStyle}
                  options={SEEKBAR_OPTIONS}
                  onChange={onChangeProgressBarStyle}
                  accentColor={palette.vibrant}
                  radiusClass={pillRadius}
                />
              </div>

              <div className="pt-1 pb-1">
                <SettingSlider
                  label="Seekbar Width (Relative to Screen)"
                  valueDisplay={`${Math.round(bgConfig.seekbarWidthPct ?? 88)}%`}
                  value={bgConfig.seekbarWidthPct ?? 88}
                  min={35}
                  max={100}
                  step={1}
                  marks={['35%', '50%', '75%', '100%']}
                  onChange={(seekbarWidthPct) =>
                    onChangeBg({ ...bgConfig, seekbarWidthPct })
                  }
                  accentColor={palette.vibrant}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-white/80 truncate">Cover Design</span>
                <CustomDropdown
                  value={coverShape}
                  options={COVER_SHAPE_OPTIONS}
                  onChange={onChangeCoverShape}
                  accentColor={palette.vibrant}
                  radiusClass={pillRadius}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-white/80 truncate">Typography</span>
                <CustomDropdown
                  value={fontFamily}
                  options={FONT_OPTIONS}
                  onChange={onChangeFontFamily}
                  accentColor={palette.vibrant}
                  radiusClass={pillRadius}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-white/80 truncate">Navigation</span>
                <CustomDropdown
                  value={shellMode}
                  options={[
                    { id: 'sidebar', label: 'Auto-Hide Sidebar' },
                    { id: 'dock', label: 'Bottom Dock' },
                  ]}
                  onChange={onChangeShellMode}
                  accentColor={palette.vibrant}
                  radiusClass={pillRadius}
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <SettingToggle
                label="Show Current Chapter Only on Bar"
                checked={bgConfig.chapterOnlySeekbar ?? false}
                onToggle={() =>
                  onChangeBg({
                    ...bgConfig,
                    chapterOnlySeekbar: !(bgConfig.chapterOnlySeekbar ?? false),
                  })
                }
                accentColor={palette.vibrant}
                radiusClass="rounded-full"
              />

              <SettingToggle
                label="Full-Screen Dark Progress Filter"
                checked={bgConfig.fullScreenSeekbar ?? true}
                onToggle={() =>
                  onChangeBg({
                    ...bgConfig,
                    fullScreenSeekbar: !(bgConfig.fullScreenSeekbar ?? true),
                  })
                }
                accentColor={palette.vibrant}
                radiusClass="rounded-full"
              />

              <SettingToggle
                label="Frosted Glass Sidebar"
                checked={sidebarFrosted}
                onToggle={onToggleSidebarFrosted}
                accentColor={palette.vibrant}
                radiusClass="rounded-full"
              />

              {onToggleClickSpark && (
                <SettingToggle
                  label="Cursor Click Spark"
                  checked={clickSparkEnabled}
                  onToggle={onToggleClickSpark}
                  accentColor={palette.vibrant}
                  radiusClass="rounded-full"
                />
              )}

              <SettingToggle
                label="Square Corners"
                checked={squareCorners}
                onToggle={onToggleSquareCorners}
                accentColor={palette.vibrant}
                radiusClass="rounded-full"
              />
            </div>
          </ReactBitsSpotlightCard>
        )}

        {/* GROUP 4: THEMES & COLOR STUDIO */}
        {showSection('theme') && (
          <ReactBitsSpotlightCard
            spotlightColor={`${palette.vibrant}22`}
            className={`p-6 sm:p-7 ${cardRadius} bg-white/[0.04] backdrop-blur-2xl`}
          >
            <div className="flex items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
                <PaletteIcon className="w-3.5 h-3.5" style={{ color: palette.vibrant }} />
                <span>Theme & Colors</span>
              </div>
              <button
                onClick={() => setBuilderOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 ${pillRadius} bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-white transition-all`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Theme</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-white/80 truncate">Cover Override</span>
                <button
                  onClick={onToggleLockTheme}
                  className={`h-9 px-3 ${pillRadius} flex items-center gap-2 text-xs font-medium transition-all ${
                    lockTheme
                      ? 'bg-white text-black font-semibold'
                      : 'bg-white/[0.07] text-white/75 hover:text-white'
                  }`}
                >
                  {lockTheme ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  <span>{lockTheme ? 'Theme Locked' : 'Dynamic Cover'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-white/80 truncate">Atmosphere</span>
                <CustomDropdown
                  value={themeMode}
                  options={[
                    { id: 'vivid', label: 'Vivid' },
                    { id: 'soft', label: 'Soft' },
                    { id: 'cinema', label: 'Cinema' },
                    { id: 'mono', label: 'Monochrome' },
                  ]}
                  onChange={onChangeThemeMode}
                  accentColor={palette.vibrant}
                  radiusClass={pillRadius}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-white/80 truncate">Base Surface</span>
                <CustomDropdown
                  value={colorScheme}
                  options={[
                    { id: 'dark', label: 'Ambient Dark' },
                    { id: 'oled', label: 'Pure OLED' },
                    { id: 'light', label: 'Daylight' },
                  ]}
                  onChange={onChangeColorScheme}
                  accentColor={palette.vibrant}
                  radiusClass={pillRadius}
                />
              </div>
            </div>

            {/* Compact Palette Swatches */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {Object.entries(PALETTES).map(([key, pal]) => {
                const isSelected = lockTheme && palette.vibrant === pal.vibrant;
                return (
                  <button
                    key={key}
                    onClick={() => onSelectOverridePalette(pal)}
                    className={`flex items-center justify-between px-2.5 py-2 ${pillRadius} transition-all ${
                      isSelected
                        ? 'bg-white/[0.16] text-white'
                        : 'bg-white/[0.04] hover:bg-white/[0.09] text-white/70'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: pal.vibrant }}
                      />
                      <span className="text-[11px] font-medium capitalize truncate">
                        {key}
                      </span>
                    </div>
                    {isSelected && <Check className="w-3 h-3 text-white shrink-0" />}
                  </button>
                );
              })}

              {customThemes.map((ct) => {
                const isSelected = lockTheme && palette.vibrant === ct.palette.vibrant;
                return (
                  <div
                    key={ct.id}
                    className={`flex items-center justify-between px-2.5 py-2 ${pillRadius} ${
                      isSelected ? 'bg-white/[0.16]' : 'bg-white/[0.04]'
                    }`}
                  >
                    <button
                      onClick={() => onSelectOverridePalette(ct.palette)}
                      className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: ct.palette.vibrant }}
                      />
                      <span className="text-[11px] font-medium text-white truncate">
                        {ct.name}
                      </span>
                    </button>
                    <button
                      onClick={() => onDeleteCustomTheme(ct.id)}
                      className="p-0.5 text-white/30 hover:text-rose-400 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {builderOpen && (
              <div className={`p-4 ${cardRadius} bg-black/50 space-y-3`}>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={themeName}
                    onChange={(e) => setThemeName(e.target.value)}
                    placeholder="Theme name"
                    className={`flex-1 h-9 px-3 ${pillRadius} bg-white/[0.07] text-xs text-white focus:outline-none`}
                  />
                  <button
                    onClick={handleCreateTheme}
                    className={`h-9 px-3.5 ${pillRadius} text-xs font-semibold text-black shrink-0`}
                    style={{ backgroundColor: previewBuiltPalette.vibrant }}
                  >
                    Save
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ReactBitsColorPickerPopover
                    title="Primary"
                    color={primaryHex}
                    onChange={setPrimaryHex}
                  />
                  <ReactBitsColorPickerPopover
                    title="Accent"
                    color={accentHex}
                    onChange={setAccentHex}
                  />
                  <ReactBitsColorPickerPopover
                    title="Surface"
                    color={bgHex}
                    onChange={setBgHex}
                  />
                </div>
              </div>
            )}
          </ReactBitsSpotlightCard>
        )}

        {/* GROUP 5: STORAGE & ~/.tide/all.json INDEX */}
        {showSection('storage') && (
          <ReactBitsSpotlightCard
            spotlightColor={`${palette.vibrant}22`}
            className={`p-6 sm:p-7 ${cardRadius} bg-white/[0.04] backdrop-blur-2xl md:col-span-2`}
          >
            <div className="flex items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
                <Database className="w-3.5 h-3.5" style={{ color: palette.vibrant }} />
                <span>Library Index (~/.tide/all.json · chapters.json)</span>
              </div>
              <span className="text-xs font-mono text-white/45">
                {books.length} books · {watchedRoots.length} root folder
                {watchedRoots.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <button
                disabled={indexBusy !== null}
                onClick={async () => {
                  setIndexBusy('force');
                  try {
                    await onForceIndex();
                  } finally {
                    setIndexBusy(null);
                  }
                }}
                className={`flex items-center justify-center gap-2 h-10 px-4 ${pillRadius} bg-white/[0.07] hover:bg-white/[0.13] text-xs font-medium text-white transition-all disabled:opacity-50`}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${indexBusy === 'force' ? 'animate-spin' : ''}`}
                  style={{ color: palette.vibrant }}
                />
                <span>Force Index</span>
              </button>

              <button
                disabled={indexBusy !== null}
                onClick={async () => {
                  setIndexBusy('repair');
                  try {
                    await onRepairLibrary();
                  } finally {
                    setIndexBusy(null);
                  }
                }}
                className={`flex items-center justify-center gap-2 h-10 px-4 ${pillRadius} bg-white/[0.07] hover:bg-white/[0.13] text-xs font-medium text-white transition-all disabled:opacity-50`}
              >
                <Wrench
                  className={`w-3.5 h-3.5 ${indexBusy === 'repair' ? 'animate-spin' : ''}`}
                  style={{ color: palette.light }}
                />
                <span>Fix Lost Books</span>
              </button>

              <button
                disabled={indexBusy !== null}
                onClick={async () => {
                  setIndexBusy('reset');
                  try {
                    await onResetLibrary();
                  } finally {
                    setIndexBusy(null);
                  }
                }}
                className={`flex items-center justify-center gap-2 h-10 px-4 ${pillRadius} bg-white/[0.07] hover:bg-rose-500/20 text-xs font-medium text-white transition-all disabled:opacity-50`}
              >
                <RotateCcw
                  className={`w-3.5 h-3.5 text-rose-400 ${
                    indexBusy === 'reset' ? 'animate-spin' : ''
                  }`}
                />
                <span>Reset & Re-Add</span>
              </button>
            </div>
          </ReactBitsSpotlightCard>
        )}
      </div>
    </div>
  );
};
