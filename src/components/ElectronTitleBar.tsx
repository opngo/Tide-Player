import React, { useState, useEffect } from 'react';
import {
  Minus,
  Square,
  Copy,
  X,
  Pin,
  Minimize2,
  Maximize2,
  FolderOpen,
  Globe,
} from 'lucide-react';

declare global {
  interface Window {
    tideElectron?: {
      isElectron: boolean;
      platform: string;
      minimize: () => Promise<void>;
      toggleMaximize: () => Promise<boolean>;
      close: () => Promise<void>;
      setAlwaysOnTop: (enabled: boolean) => Promise<boolean>;
      setMiniPlayer: (enabled: boolean) => Promise<boolean>;
      openDirectoryDialog: () => Promise<string | null>;
      getAppInfo: () => Promise<{
        name: string;
        version: string;
        platform: string;
        arch: string;
        electronVersion: string;
        nodeVersion: string;
        tideJsonPath: string;
      }>;
      onMediaKey: (cb: (action: string) => void) => () => void;
      onWindowState: (
        cb: (state: { isMaximized: boolean; isAlwaysOnTop: boolean }) => void
      ) => () => void;
    };
  }
}

interface ElectronTitleBarProps {
  visible: boolean;
  accentColor: string;
  currentBookTitle?: string;
  isPlaying?: boolean;
  onNativeFolderPicked?: (folderPath: string) => void;
  onOpenFolderScanner?: () => void;
  onOpenShowcaseSite?: () => void;
}

export const ElectronTitleBar: React.FC<ElectronTitleBarProps> = ({
  visible,
  accentColor,
  currentBookTitle,
  isPlaying,
  onNativeFolderPicked,
  onOpenFolderScanner,
  onOpenShowcaseSite,
}) => {
  const isNativeElectron =
    typeof window !== 'undefined' && Boolean(window.tideElectron?.isElectron);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [isMiniWindow, setIsMiniWindow] = useState(false);

  useEffect(() => {
    if (!window.tideElectron?.onWindowState) return;
    return window.tideElectron.onWindowState((state) => {
      setIsMaximized(state.isMaximized);
      setIsAlwaysOnTop(state.isAlwaysOnTop);
    });
  }, []);

  if (!visible) return null;

  const handlePickDirectory = async () => {
    if (window.tideElectron?.openDirectoryDialog) {
      const folder = await window.tideElectron.openDirectoryDialog();
      if (folder && onNativeFolderPicked) {
        onNativeFolderPicked(folder);
        return;
      }
    }
    onOpenFolderScanner?.();
  };

  const handleTogglePin = async () => {
    const next = !isAlwaysOnTop;
    if (window.tideElectron?.setAlwaysOnTop) {
      const res = await window.tideElectron.setAlwaysOnTop(next);
      setIsAlwaysOnTop(res);
    } else {
      setIsAlwaysOnTop(next);
    }
  };

  const handleToggleMini = async () => {
    const next = !isMiniWindow;
    if (window.tideElectron?.setMiniPlayer) {
      const res = await window.tideElectron.setMiniPlayer(next);
      setIsMiniWindow(res);
    } else {
      setIsMiniWindow(next);
    }
  };

  const handleMinimize = async () => {
    if (window.tideElectron?.minimize) {
      await window.tideElectron.minimize();
    }
  };

  const handleMaximize = async () => {
    if (window.tideElectron?.toggleMaximize) {
      const res = await window.tideElectron.toggleMaximize();
      setIsMaximized(res);
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
        setIsMaximized(true);
      } else {
        document.exitFullscreen?.().catch(() => {});
        setIsMaximized(false);
      }
    }
  };

  const handleClose = async () => {
    if (window.tideElectron?.close) {
      await window.tideElectron.close();
    }
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 h-7 z-[80] flex items-center justify-between px-3 select-none transition-opacity duration-300"
      style={
        {
          WebkitAppRegion: 'drag',
          background:
            'linear-gradient(180deg, rgba(4,6,12,0.72) 0%, rgba(4,6,12,0) 100%)',
        } as React.CSSProperties
      }
    >
      {/* Left: Subtle Brand Dot + Quick Native Folder & Showcase Icons */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-white/[0.03]">
          <span
            className="w-1.5 h-1.5 rounded-full transition-transform duration-300"
            style={{
              backgroundColor: accentColor,
              boxShadow: isPlaying ? `0 0 8px ${accentColor}` : 'none',
              transform: isPlaying ? 'scale(1.15)' : 'scale(1)',
            }}
          />
          <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-slate-400/80">
            Tide
          </span>
          {isNativeElectron && (
            <span className="text-[9px] font-mono text-slate-500">Desktop</span>
          )}
        </div>

        <button
          onClick={handlePickDirectory}
          title="Mount Local Audiobook Directory"
          className="w-5 h-5 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
        >
          <FolderOpen className="w-3 h-3" />
        </button>

        {onOpenShowcaseSite && (
          <button
            onClick={onOpenShowcaseSite}
            title="Open Minimalist Project Showcase Website"
            className="w-5 h-5 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
          >
            <Globe className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Center: Subtle Active Title (whisper-quiet, fades when idle) */}
      <div className="pointer-events-none max-w-[42vw] truncate text-[10px] font-medium tracking-wider text-slate-500/75">
        {currentBookTitle || ''}
      </div>

      {/* Right: Frameless Electron Window Controls */}
      <div
        className="flex items-center gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleTogglePin}
          title={isAlwaysOnTop ? 'Unpin Always on Top' : 'Pin Always on Top'}
          className={`w-6 h-5 rounded-md flex items-center justify-center transition-colors ${
            isAlwaysOnTop
              ? 'text-amber-400 bg-amber-500/15'
              : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.06]'
          }`}
        >
          <Pin className="w-2.5 h-2.5" />
        </button>

        <button
          onClick={handleToggleMini}
          title={isMiniWindow ? 'Restore Full Window' : 'Compact Mini-Player'}
          className={`w-6 h-5 rounded-md flex items-center justify-center transition-colors ${
            isMiniWindow
              ? 'text-sky-400 bg-sky-500/15'
              : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.06]'
          }`}
        >
          {isMiniWindow ? (
            <Maximize2 className="w-2.5 h-2.5" />
          ) : (
            <Minimize2 className="w-2.5 h-2.5" />
          )}
        </button>

        <button
          onClick={handleMinimize}
          title="Minimize"
          className="w-6 h-5 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>

        <button
          onClick={handleMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
          className="w-6 h-5 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
        >
          {isMaximized ? (
            <Copy className="w-2.5 h-2.5" />
          ) : (
            <Square className="w-2.5 h-2.5" />
          )}
        </button>

        <button
          onClick={handleClose}
          title="Close Window"
          className="w-6 h-5 rounded-md flex items-center justify-center text-slate-500 hover:text-rose-200 hover:bg-rose-500/30 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </header>
  );
};
