import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';

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
      updateMediaMetadata?: (meta: {
        title: string;
        artist: string;
        album: string;
        isPlaying: boolean;
        pngDataUrl: string;
      }) => Promise<boolean>;
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
}

export const ElectronTitleBar: React.FC<ElectronTitleBarProps> = ({
  visible,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!window.tideElectron?.onWindowState) return;
    return window.tideElectron.onWindowState((state) => {
      setIsMaximized(state.isMaximized);
    });
  }, []);

  if (!visible) return null;

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
      className="fixed top-0 left-0 right-0 h-10 z-[80] flex items-center justify-end px-3 select-none pointer-events-auto"
      style={
        {
          WebkitAppRegion: 'drag',
        } as React.CSSProperties
      }
    >
      <div
        className="flex items-center gap-1.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          title="Minimize"
          className="w-11 h-8 rounded-xl flex items-center justify-center text-white/65 hover:text-white hover:bg-white/[0.1] transition-colors"
        >
          <Minus className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>

        <button
          onClick={handleMaximize}
          title={isMaximized ? 'Restore / Splitscreen' : 'Full / Maximize'}
          className="w-11 h-8 rounded-xl flex items-center justify-center text-white/65 hover:text-white hover:bg-white/[0.1] transition-colors"
        >
          {isMaximized ? (
            <Copy className="w-[16px] h-[16px]" strokeWidth={2} />
          ) : (
            <Square className="w-[16px] h-[16px]" strokeWidth={2} />
          )}
        </button>

        <button
          onClick={handleClose}
          title="Close"
          className="w-11 h-8 rounded-xl flex items-center justify-center text-white/65 hover:text-rose-100 hover:bg-rose-500/45 transition-colors"
        >
          <X className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>
      </div>
    </header>
  );
};
