import React, { useState } from 'react';
import {
  Play,
  Pause,
  ArrowRight,
  Search,
  Copy,
  Check,
  Mic,
} from 'lucide-react';
import {
  Book,
  BgConfig,
  BgType,
  VizConfig,
  VizType,
  NavigationTab,
} from '../types';
import { AudioVisualizer } from './AudioVisualizer';
import { audioEngine } from '../services/audioEngine';

interface LandingPageProps {
  books: Book[];
  currentBook: Book;
  isPlaying: boolean;
  positionMs: number;
  onSelectBook: (book: Book) => void;
  onTogglePlay: () => void;
  onSeek: (ms: number) => void;
  bgConfig: BgConfig;
  onChangeBgType: (type: BgType) => void;
  vizConfig: VizConfig;
  onChangeVizType: (type: VizType) => void;
  onLaunchApp: (initialTab?: NavigationTab) => void;
}

const RUN_COMMANDS = {
  run: `npm install
npm run dev`,
  tauri: `npm install -D @tauri-apps/cli@latest
npm run tauri:build`,
  electron: `npm install -D electron electron-builder
npm run electron:build`,
  docker: `docker compose up -d --build`,
};

export const LandingPage: React.FC<LandingPageProps> = ({
  currentBook,
  isPlaying,
  onTogglePlay,
  bgConfig,
  onChangeBgType,
  vizConfig,
  onChangeVizType,
  onLaunchApp,
}) => {
  const [activeCmd, setActiveCmd] = useState<keyof typeof RUN_COMMANDS>('run');
  const [copied, setCopied] = useState(false);
  const [micActive, setMicActive] = useState(audioEngine.isMicActive);

  const palette = currentBook.palette;

  const copyText = (txt: string) => {
    navigator.clipboard?.writeText(txt).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden relative z-10 text-white select-none">
      {/* Ultra-minimal Top Bar */}
      <header className="max-w-5xl mx-auto px-8 h-20 flex items-center justify-between">
        <span className="text-sm font-medium tracking-tight text-white/90">Tide</span>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onLaunchApp('abb-search')}
            className="p-2.5 rounded-full ambient-surface ambient-surface-hover text-white/70 hover:text-white transition-all"
            title="AudioBookBay"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={() => onLaunchApp('player')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium text-black transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: palette.vibrant }}
          >
            <span>Open</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Minimalist Hero: ChatGPT Voice Orb Stage */}
      <section className="max-w-4xl mx-auto px-8 pt-6 pb-20 flex flex-col items-center text-center">
        {/* Live Interactive Voice Visualizer Stage */}
        <div
          onClick={onTogglePlay}
          className="relative w-72 h-72 sm:w-88 sm:h-88 flex items-center justify-center cursor-pointer group"
          title="Click to play / pause voice visualizer"
        >
          <AudioVisualizer
            config={vizConfig}
            palette={palette}
            width={360}
            height={360}
            isAroundCover={false}
            className="w-full h-full transition-transform duration-700 group-hover:scale-105"
          />

          <div className="absolute bottom-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2 px-3.5 py-1.5 rounded-full ambient-surface text-xs font-mono text-white/80">
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isPlaying ? 'Listening' : 'Play'}</span>
          </div>
        </div>

        {/* Visualizer & Mic Mode Switcher Pills */}
        <div className="flex items-center gap-2 flex-wrap justify-center mt-2 mb-10">
          {(
            [
              { id: 'chatgpt-orb', label: 'Orb' },
              { id: 'chatgpt-dots', label: 'Dots' },
              { id: 'fluid-wave', label: 'Wave' },
              { id: 'halo', label: 'Halo' },
            ] as { id: VizType; label: string }[]
          ).map((v) => (
            <button
              key={v.id}
              onClick={() => onChangeVizType(v.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all ${
                vizConfig.type === v.id
                  ? 'bg-white text-black font-medium'
                  : 'ambient-surface text-white/55 hover:text-white'
              }`}
            >
              {v.label}
            </button>
          ))}

          <button
            onClick={async () => {
              const active = await audioEngine.toggleMicrophone();
              setMicActive(active);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-mono flex items-center gap-1.5 transition-all ${
              micActive
                ? 'bg-rose-500/30 text-rose-200'
                : 'ambient-surface text-white/55 hover:text-white'
            }`}
            title="Drive orb with live microphone voice"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Mic</span>
          </button>

          {(['aurora', 'silk', 'dither', 'oled'] as BgType[]).map((bg) => (
            <button
              key={bg}
              onClick={() => onChangeBgType(bg)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all ${
                bgConfig.type === bg
                  ? 'bg-white/20 text-white'
                  : 'bg-white/[0.03] text-white/40 hover:text-white/80'
              }`}
            >
              {bg}
            </button>
          ))}
        </div>

        {/* Editorial Headline */}
        <h1 className="text-3xl sm:text-5xl font-light tracking-tight text-white/95 max-w-xl leading-[1.15]">
          Cover drives color.{' '}
          <span className="font-serif-editorial italic text-white/70">
            Audio drives motion.
          </span>
        </h1>

        <div className="flex items-center gap-3 mt-8">
          <button
            onClick={() => onLaunchApp('player')}
            className="px-7 py-3 rounded-full text-xs font-medium text-black transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: palette.vibrant }}
          >
            Player
          </button>
          <button
            onClick={() => onLaunchApp('library')}
            className="px-6 py-3 rounded-full text-xs font-medium ambient-surface ambient-surface-hover text-white/85"
          >
            Library
          </button>
          <button
            onClick={() => onLaunchApp('abb-search')}
            className="px-6 py-3 rounded-full text-xs font-medium ambient-surface ambient-surface-hover text-white/85"
          >
            AudioBookBay
          </button>
        </div>
      </section>

      {/* Minimal Run & Package Section */}
      <section className="max-w-2xl mx-auto px-8 pb-24 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'run', label: 'Run' },
                { id: 'tauri', label: 'Tauri' },
                { id: 'electron', label: 'Electron' },
                { id: 'docker', label: 'Docker' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCmd(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all ${
                  activeCmd === tab.id
                    ? 'bg-white/15 text-white'
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => copyText(RUN_COMMANDS[activeCmd])}
            className="p-2 rounded-full ambient-surface text-white/60 hover:text-white transition-all"
            title="Copy"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <pre className="p-5 rounded-2xl bg-white/[0.03] text-xs font-mono text-white/80 overflow-x-auto leading-relaxed">
          <code>{RUN_COMMANDS[activeCmd]}</code>
        </pre>
      </section>
    </div>
  );
};
