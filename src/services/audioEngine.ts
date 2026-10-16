import { Howler } from 'howler';
import { EqualizerBand } from '../types';

const DEFAULT_FALLBACK_STREAM =
  '/api/fs/stream?path=' +
  encodeURIComponent(
    '/home/user/Audiobooks/The War of the Worlds/01 - The Eve of the War.mp3'
  ) +
  '&_ext=.mp3';

export class TideAudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaElementSource: MediaElementAudioSourceNode | null = null;
  private preampGain: GainNode | null = null;
  private voiceBoostFilter: BiquadFilterNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private compressor: DynamicsCompressorNode | null = null;

  // Primary low-latency HTML5 Audio element with in-memory Blob URL cache & HTTP 206 Range streaming
  private audio: HTMLAudioElement;
  private currentStreamUrl: string = '';
  private pendingSeekSec: number | null = null;
  private lastManualSeekPerfTime: number = 0;
  private lastManualSeekTargetSec: number | null = null;
  private isLoadingStream: boolean = false;
  private blobUrlCache: Map<string, string> = new Map();
  private blobFetchPromises: Map<string, Promise<string>> = new Map();
  private progressRafId: number | null = null;
  private lastSeekEmitTime: number = 0;

  // Live Microphone Input
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  public isMicActive: boolean = false;

  private isPlayingWanted: boolean = false;
  private actuallyPlaying: boolean = false;
  private playbackSpeed: number = 1.0;
  private volume: number = 0.85;
  private muted: boolean = false;
  private skipSilenceEnabled: boolean = false;
  private voiceBoostEnabled: boolean = false;
  private eqGainBoost: number = 1.0;

  // A-B Loop state (in track milliseconds)
  public abLoopStartMs: number | null = null;
  public abLoopEndMs: number | null = null;

  // Real book waveform peaks for fallback / skip-silence
  private currentBookPeaks: number[] = [];
  private currentPlayheadRatio: number = 0;

  private rawFreqData: Uint8Array = new Uint8Array(512);
  private smoothedFreqData: Float32Array = new Float32Array(512);
  private outFreqData: Uint8Array = new Uint8Array(512);
  private timeData: Uint8Array = new Uint8Array(512);
  private smoothedRms: number = 0;
  private smoothedFormants: [number, number, number, number] = [0, 0, 0, 0];
  private envelopePhase: number = 0;

  private onTimeUpdateCallback:
    | ((currentTimeMs: number, durationMs?: number) => void)
    | null = null;
  private onTrackEndCallback: (() => void) | null = null;
  private onLivePeakCallback: ((ratio: number, peakAmplitude: number) => void) | null =
    null;
  private onPlayStateChangeCallback: ((playing: boolean) => void) | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.timeData.fill(128);
    this.setupAudioElementListeners();
  }

  private applyPendingSeekIfReady(): boolean {
    if (this.pendingSeekSec === null || isNaN(this.pendingSeekSec)) return true;
    if (this.audio.readyState < 1) return false;
    try {
      const dur = this.audio.duration;
      const target =
        typeof dur === 'number' && !isNaN(dur) && isFinite(dur) && dur > 0
          ? Math.max(0, Math.min(dur - 0.05, this.pendingSeekSec))
          : Math.max(0, this.pendingSeekSec);
      this.audio.currentTime = target;
      if (Math.abs(this.audio.currentTime - target) < 1.5 || target === 0) {
        this.pendingSeekSec = null;
        if (typeof dur === 'number' && !isNaN(dur) && isFinite(dur) && dur > 0) {
          this.currentPlayheadRatio = Math.max(0, Math.min(1, target / dur));
        }
        return true;
      }
    } catch {
      // Will retry on canplay / loadeddata
    }
    return false;
  }

  private setupAudioElementListeners(): void {
    this.audio.addEventListener('loadedmetadata', () => {
      this.audio.playbackRate = this.playbackSpeed;
      this.applyVolumeToElement();
      this.applyPendingSeekIfReady();
      if (this.isPlayingWanted && this.audio.paused) {
        this.audio
          .play()
          .then(() => {
            this.actuallyPlaying = true;
            this.applyPendingSeekIfReady();
            this.startProgressLoop();
          })
          .catch(() => {});
      }
    });

    this.audio.addEventListener('loadeddata', () => {
      this.applyPendingSeekIfReady();
    });

    this.audio.addEventListener('canplay', () => {
      this.applyPendingSeekIfReady();
      if (this.isPlayingWanted && this.audio.paused) {
        this.audio
          .play()
          .then(() => {
            this.actuallyPlaying = true;
            this.applyPendingSeekIfReady();
            this.startProgressLoop();
          })
          .catch(() => {});
      }
    });

    this.audio.addEventListener('seeked', () => {
      const dur = this.audio.duration;
      if (typeof dur === 'number' && !isNaN(dur) && isFinite(dur) && dur > 0) {
        this.currentPlayheadRatio = Math.max(
          0,
          Math.min(1, this.audio.currentTime / dur)
        );
      }
    });

    this.audio.addEventListener('playing', () => {
      this.actuallyPlaying = true;
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.audio.playbackRate = this.playbackSpeed;
      this.applyVolumeToElement();
      this.applyPendingSeekIfReady();
      if (this.onPlayStateChangeCallback) {
        this.onPlayStateChangeCallback(true);
      }
      this.startProgressLoop();
    });

    this.audio.addEventListener('pause', () => {
      this.actuallyPlaying = false;
      if (!this.isPlayingWanted && this.onPlayStateChangeCallback) {
        this.onPlayStateChangeCallback(false);
      }
    });

    this.audio.addEventListener('timeupdate', () => {
      this.emitProgressTick();
    });

    this.audio.addEventListener('ended', () => {
      if (this.isLoadingStream) return;
      this.actuallyPlaying = false;
      if (this.onTrackEndCallback) {
        this.onTrackEndCallback();
      }
    });

    this.audio.addEventListener('error', () => {
      if (this.isLoadingStream) return;
      if (
        this.currentStreamUrl &&
        this.currentStreamUrl !== DEFAULT_FALLBACK_STREAM
      ) {
        const preservedMs =
          this.pendingSeekSec !== null
            ? this.pendingSeekSec * 1000
            : this.lastManualSeekTargetSec !== null
            ? this.lastManualSeekTargetSec * 1000
            : undefined;
        this.currentStreamUrl = '';
        this.setBookProfile(115, 1.0, DEFAULT_FALLBACK_STREAM, preservedMs);
      } else {
        this.actuallyPlaying = false;
      }
    });
  }

  private applyVolumeToElement(): void {
    const effective = Math.max(0, Math.min(1, this.volume * this.eqGainBoost));
    this.audio.muted = this.muted;
    this.audio.volume = this.muted ? 0 : effective;
    Howler.volume(this.muted ? 0 : effective);
    Howler.mute(this.muted);
  }

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.minDecibels = -85;
      this.analyser.maxDecibels = -18;
      this.analyser.smoothingTimeConstant = 0.58;

      this.preampGain = this.ctx.createGain();
      this.preampGain.gain.value = 1.0;

      this.voiceBoostFilter = this.ctx.createBiquadFilter();
      this.voiceBoostFilter.type = 'peaking';
      this.voiceBoostFilter.frequency.value = 2200;
      this.voiceBoostFilter.Q.value = 0.9;
      this.voiceBoostFilter.gain.value = 0;

      const freqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      this.eqFilters = freqs.map((f, idx) => {
        const filter = this.ctx!.createBiquadFilter();
        filter.type =
          idx === 0
            ? 'lowshelf'
            : idx === freqs.length - 1
            ? 'highshelf'
            : 'peaking';
        filter.frequency.value = f;
        filter.Q.value = 1.1;
        filter.gain.value = 0;
        return filter;
      });

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 16;
      this.compressor.ratio.value = 2.8;
      this.compressor.attack.value = 0.008;
      this.compressor.release.value = 0.22;

      let prevNode: AudioNode = this.preampGain;
      prevNode.connect(this.voiceBoostFilter);
      prevNode = this.voiceBoostFilter;

      for (const f of this.eqFilters) {
        prevNode.connect(f);
        prevNode = f;
      }

      prevNode.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Connect the HTMLAudioElement directly into the Web Audio DSP + Analyser graph
      this.mediaElementSource = this.ctx.createMediaElementSource(this.audio);
      this.mediaElementSource.connect(this.preampGain);

      const bins = this.analyser.frequencyBinCount;
      this.rawFreqData = new Uint8Array(bins);
      this.smoothedFreqData = new Float32Array(bins);
      this.outFreqData = new Uint8Array(bins);
      this.timeData = new Uint8Array(bins);
      this.timeData.fill(128);
    } catch {
      // Fallback if Web Audio context creation is restricted
    }
  }

  public isActive(): boolean {
    const audioRunning =
      this.isPlayingWanted &&
      this.actuallyPlaying &&
      !this.audio.paused &&
      !this.audio.ended;
    return audioRunning || this.isMicActive;
  }

  public onTimeUpdate(cb: (ms: number, durationMs?: number) => void): void {
    this.onTimeUpdateCallback = cb;
  }

  public onTrackEnd(cb: () => void): void {
    this.onTrackEndCallback = cb;
  }

  public onLivePeak(cb: (ratio: number, peakAmplitude: number) => void): void {
    this.onLivePeakCallback = cb;
  }

  public onPlayStateChange(cb: (playing: boolean) => void): void {
    this.onPlayStateChangeCallback = cb;
  }

  public setBookPeaks(peaks: number[]): void {
    if (Array.isArray(peaks) && peaks.length > 0) {
      this.currentBookPeaks = peaks;
    }
  }

  public setAbLoop(startMs: number | null, endMs: number | null): void {
    this.abLoopStartMs = startMs;
    this.abLoopEndMs = endMs;
  }

  public setSkipSilence(enabled: boolean): void {
    this.skipSilenceEnabled = enabled;
    if (!enabled) {
      this.audio.playbackRate = this.playbackSpeed;
    }
  }

  private normalizeStreamUrl(rawUrl?: string): string {
    const resolved =
      rawUrl && rawUrl.trim() ? rawUrl.trim() : DEFAULT_FALLBACK_STREAM;
    const decoded = (() => {
      try {
        return decodeURIComponent(resolved);
      } catch {
        return resolved;
      }
    })();

    const extMatch = decoded.match(
      /\.(mp3|m4b|m4a|mp4|flac|ogg|opus|wav|aac|webm)(?:$|\?|&)/i
    );
    const ext = extMatch ? extMatch[1].toLowerCase() : 'mp3';

    if (
      resolved.startsWith('http') &&
      !resolved.includes(window.location.host)
    ) {
      return `/api/proxy?url=${encodeURIComponent(resolved)}&_ext=.${ext}`;
    }
    if (resolved.startsWith('/api/fs/stream') && !resolved.includes('_ext=')) {
      return `${resolved}${resolved.includes('?') ? '&' : '?'}_ext=.${ext}`;
    }
    return resolved;
  }

  private detectMimeType(arrayBuf: ArrayBuffer, url: string): string {
    if (arrayBuf.byteLength >= 12) {
      const b = new Uint8Array(arrayBuf, 0, 12);
      // ID3v2 tag or MPEG audio sync word -> audio/mpeg
      if (
        (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) ||
        (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)
      ) {
        return 'audio/mpeg';
      }
      // ISO Base Media File Format (MP4 / M4A / M4B 'ftyp')
      if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
        return 'audio/mp4';
      }
      // FLAC ('fLaC')
      if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) {
        return 'audio/flac';
      }
      // Ogg ('OggS')
      if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) {
        return 'audio/ogg';
      }
      // WAV ('RIFF')
      if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) {
        return 'audio/wav';
      }
    }
    const lower = url.toLowerCase();
    if (lower.includes('.m4b') || lower.includes('.m4a') || lower.includes('.mp4')) {
      return 'audio/mp4';
    }
    if (lower.includes('.flac')) return 'audio/flac';
    if (lower.includes('.ogg') || lower.includes('.opus')) return 'audio/ogg';
    if (lower.includes('.wav')) return 'audio/wav';
    if (lower.includes('.aac')) return 'audio/aac';
    return 'audio/mpeg';
  }

  /**
   * Resolves a stream URL into an in-memory Blob URL so HTML5 Audio seeking
   * is 100% local in browser RAM (0ms latency) and never resets to 0:00
   * even behind reverse proxies that buffer or strip HTTP Range headers.
   */
  private async resolveSeekableBlobUrl(finalSrc: string): Promise<string> {
    if (finalSrc.startsWith('blob:') || finalSrc.startsWith('data:')) {
      return finalSrc;
    }
    const cached = this.blobUrlCache.get(finalSrc);
    if (cached) return cached;

    const existingPromise = this.blobFetchPromises.get(finalSrc);
    if (existingPromise) return existingPromise;

    const fetchPromise = (async () => {
      try {
        const resp = await fetch(finalSrc);
        if (!resp.ok) return finalSrc;
        const arrayBuf = await resp.arrayBuffer();
        if (!arrayBuf || arrayBuf.byteLength < 256) return finalSrc;
        const mime = this.detectMimeType(arrayBuf, finalSrc);
        const blob = new Blob([arrayBuf], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        this.blobUrlCache.set(finalSrc, blobUrl);
        return blobUrl;
      } catch {
        return finalSrc;
      } finally {
        this.blobFetchPromises.delete(finalSrc);
      }
    })();

    this.blobFetchPromises.set(finalSrc, fetchPromise);
    return fetchPromise;
  }

  public setBookProfile(
    _basePitchHz: number = 115,
    _cadenceSpeed: number = 1.0,
    streamUrl?: string,
    initialSeekMs?: number
  ): void {
    const finalSrc = this.normalizeStreamUrl(streamUrl);

    if (typeof initialSeekMs === 'number' && initialSeekMs >= 0) {
      this.pendingSeekSec = initialSeekMs / 1000;
      this.lastManualSeekPerfTime = performance.now();
      this.lastManualSeekTargetSec = this.pendingSeekSec;
    }

    if (finalSrc !== this.currentStreamUrl) {
      this.currentStreamUrl = finalSrc;
      this.isLoadingStream = true;
      this.audio.pause();

      const cachedBlobUrl = this.blobUrlCache.get(finalSrc);
      if (cachedBlobUrl) {
        this.isLoadingStream = false;
        this.audio.src = cachedBlobUrl;
        this.audio.playbackRate = this.playbackSpeed;
        this.applyVolumeToElement();
        if (this.isPlayingWanted) {
          this.init();
        }
        // loadedmetadata / canplay listener will apply pendingSeekSec BEFORE calling audio.play()
        this.audio.load();
        return;
      }

      // Resolve in-memory seekable Blob URL so any seek/skip/scrubber interaction is instant and never resets
      const requestedSrc = finalSrc;
      this.resolveSeekableBlobUrl(finalSrc).then((playableUrl) => {
        if (this.currentStreamUrl !== requestedSrc) return;
        this.isLoadingStream = false;
        this.audio.src = playableUrl;
        this.audio.playbackRate = this.playbackSpeed;
        this.applyVolumeToElement();
        if (this.isPlayingWanted) {
          this.init();
        }
        // loadedmetadata / canplay listener will apply pendingSeekSec BEFORE calling audio.play()
        this.audio.load();
      });
    } else if (this.pendingSeekSec !== null) {
      this.seekRealFile(this.pendingSeekSec * 1000);
    }
  }

  private emitProgressTick(): void {
    // Never emit or overwrite App position while paused, loading, or mid-seek
    if (
      this.audio.paused ||
      !this.actuallyPlaying ||
      this.isLoadingStream ||
      this.audio.seeking
    ) {
      return;
    }

    if (this.pendingSeekSec !== null) {
      if (!this.applyPendingSeekIfReady()) {
        return;
      }
    }

    const seekSec = this.audio.currentTime;
    const durSec = this.audio.duration;
    if (typeof seekSec !== 'number' || isNaN(seekSec)) return;

    // Guard against stale emission immediately after a manual seek
    if (
      this.lastManualSeekTargetSec !== null &&
      performance.now() - this.lastManualSeekPerfTime < 650 &&
      Math.abs(seekSec - this.lastManualSeekTargetSec) > 2.5
    ) {
      if (this.audio.readyState >= 1) {
        try {
          this.audio.currentTime = this.lastManualSeekTargetSec;
        } catch {
          // ignore
        }
      }
      return;
    }

    const curMs = seekSec * 1000;
    const validDur =
      typeof durSec === 'number' && !isNaN(durSec) && isFinite(durSec) && durSec > 0;
    const durMs = validDur ? durSec * 1000 : undefined;

    if (
      this.abLoopStartMs !== null &&
      this.abLoopEndMs !== null &&
      this.abLoopEndMs > this.abLoopStartMs + 400 &&
      curMs >= this.abLoopEndMs
    ) {
      this.seekRealFile(this.abLoopStartMs);
      return;
    }

    if (validDur) {
      this.currentPlayheadRatio = Math.max(0, Math.min(1, seekSec / durSec));
    }

    if (
      this.skipSilenceEnabled &&
      this.actuallyPlaying &&
      this.currentBookPeaks.length > 0
    ) {
      const idx = Math.floor(
        this.currentPlayheadRatio * (this.currentBookPeaks.length - 1)
      );
      const peak = this.currentBookPeaks[idx] ?? 0.5;
      const targetRate =
        peak < 0.18
          ? Math.min(3.5, this.playbackSpeed * 1.45)
          : this.playbackSpeed;
      if (Math.abs(this.audio.playbackRate - targetRate) > 0.05) {
        this.audio.playbackRate = targetRate;
      }
    }

    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(curMs, durMs);
    }
    if (this.onLivePeakCallback && validDur) {
      this.onLivePeakCallback(this.currentPlayheadRatio, this.smoothedRms);
    }
  }

  private startProgressLoop(): void {
    if (this.progressRafId) cancelAnimationFrame(this.progressRafId);
    const tick = (now: number) => {
      if (this.isPlayingWanted && !this.audio.paused) {
        this.actuallyPlaying = true;
        if (now - this.lastSeekEmitTime >= 32) {
          this.lastSeekEmitTime = now;
          this.emitProgressTick();
        }
        this.progressRafId = requestAnimationFrame(tick);
      } else {
        this.progressRafId = null;
      }
    };
    this.progressRafId = requestAnimationFrame(tick);
  }

  public seekRealFile(ms: number): void {
    const targetSec = Math.max(0, ms / 1000);
    this.pendingSeekSec = targetSec;
    this.lastManualSeekPerfTime = performance.now();
    this.lastManualSeekTargetSec = targetSec;

    const durSec = this.audio.duration;
    const validDur =
      typeof durSec === 'number' && !isNaN(durSec) && isFinite(durSec) && durSec > 0;

    if (!this.isLoadingStream && this.audio.readyState >= 1) {
      try {
        const clampedSec = validDur
          ? Math.max(0, Math.min(durSec - 0.05, targetSec))
          : targetSec;
        this.audio.currentTime = clampedSec;
        if (Math.abs(this.audio.currentTime - clampedSec) < 1.5 || clampedSec === 0) {
          this.pendingSeekSec = null;
        }
      } catch {
        // Will be applied on loadedmetadata / canplay
      }
    }

    if (validDur) {
      this.currentPlayheadRatio = Math.max(0, Math.min(1, targetSec / durSec));
    }
  }

  public async toggleMicrophone(): Promise<boolean> {
    this.init();
    if (!this.ctx || !this.analyser) return false;

    if (this.isMicActive) {
      if (this.micSource) {
        this.micSource.disconnect();
        this.micSource = null;
      }
      if (this.micStream) {
        this.micStream.getTracks().forEach((t) => t.stop());
        this.micStream = null;
      }
      this.isMicActive = false;
      return false;
    }

    try {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.micSource = this.ctx.createMediaStreamSource(this.micStream);
      this.micSource.connect(this.analyser);
      this.isMicActive = true;
      return true;
    } catch {
      this.isMicActive = false;
      return false;
    }
  }

  public play(): void {
    this.isPlayingWanted = true;
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (this.isLoadingStream) {
      // Stream Blob URL is currently resolving; setBookProfile will start playback at pendingSeekSec once ready
      return;
    }

    if (!this.currentStreamUrl) {
      this.setBookProfile(115, 1.0, DEFAULT_FALLBACK_STREAM);
      return;
    }

    this.audio.playbackRate = this.playbackSpeed;
    this.applyVolumeToElement();
    this.applyPendingSeekIfReady();

    const playPromise = this.audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          this.actuallyPlaying = true;
          this.applyPendingSeekIfReady();
          this.startProgressLoop();
        })
        .catch((err) => {
          // Ignore AbortError when interrupted by a seek/load; never wipe pendingSeekSec or reset to 0
          if (err && err.name === 'AbortError') return;
        });
    } else {
      this.actuallyPlaying = true;
      this.startProgressLoop();
    }
  }

  public pause(): void {
    this.isPlayingWanted = false;
    this.actuallyPlaying = false;
    this.audio.pause();
    if (this.progressRafId) {
      cancelAnimationFrame(this.progressRafId);
      this.progressRafId = null;
    }
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.applyVolumeToElement();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolumeToElement();
  }

  public setSpeed(speed: number): void {
    this.playbackSpeed = Math.max(0.5, Math.min(4.0, speed));
    this.audio.playbackRate = this.playbackSpeed;
  }

  public setVoiceBoost(enabled: boolean): void {
    this.voiceBoostEnabled = enabled;
    this.eqGainBoost = enabled ? 1.15 : 1.0;
    this.applyVolumeToElement();
    if (this.voiceBoostFilter && this.ctx) {
      this.voiceBoostFilter.gain.setTargetAtTime(
        enabled ? 6.0 : 0,
        this.ctx.currentTime,
        0.04
      );
    }
  }

  public setEqualizer(bands: EqualizerBand[], preampDb: number): void {
    const avgGain =
      bands.reduce((acc, b) => acc + b.gainDb, 0) / Math.max(1, bands.length);
    const totalDb = Math.max(-12, Math.min(12, preampDb + avgGain * 0.35));
    this.eqGainBoost =
      Math.pow(10, totalDb / 24) * (this.voiceBoostEnabled ? 1.12 : 1.0);
    this.applyVolumeToElement();

    if (this.ctx) {
      if (this.preampGain) {
        const linearPreamp = Math.pow(10, preampDb / 20);
        this.preampGain.gain.setTargetAtTime(linearPreamp, this.ctx.currentTime, 0.03);
      }
      bands.forEach((b, i) => {
        if (this.eqFilters[i]) {
          this.eqFilters[i].gain.setTargetAtTime(b.gainDb, this.ctx!.currentTime, 0.03);
        }
      });
    }
  }

  /**
   * Real-time FFT frequency spectrum directly from the live Web Audio AnalyserNode
   * connected to the playing audiobook (or live microphone).
   */
  public getFrequencyData(speechWeighted: boolean = true): Uint8Array {
    if (!this.isActive()) {
      for (let i = 0; i < this.smoothedFreqData.length; i++) {
        this.smoothedFreqData[i] *= 0.72;
        if (this.smoothedFreqData[i] < 0.5) this.smoothedFreqData[i] = 0;
        this.outFreqData[i] = Math.floor(this.smoothedFreqData[i]);
      }
      this.smoothedRms *= 0.72;
      if (this.smoothedRms < 0.002) this.smoothedRms = 0;
      return this.outFreqData;
    }

    // 1. Pull real-time FFT spectrum from Web Audio AnalyserNode
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.rawFreqData);
      let rawSum = 0;
      for (let i = 1; i < 96; i++) rawSum += this.rawFreqData[i];

      if (rawSum > 8) {
        const len = this.outFreqData.length;
        for (let i = 0; i < len; i++) {
          let val = this.rawFreqData[i];
          if (speechWeighted) {
            // Boost human speech articulation bands (85 Hz - 4.5 kHz, bins 2..110)
            const weight = i >= 2 && i <= 95 ? 1.25 : i < 2 ? 0.75 : 0.9;
            val = Math.min(255, val * weight);
          }
          // Fast attack (0.48), crisp syllable release (0.68) so words & pauses react immediately
          const prev = this.smoothedFreqData[i];
          const alpha = val > prev ? 0.48 : 0.28;
          this.smoothedFreqData[i] = prev * (1 - alpha) + val * alpha;
          this.outFreqData[i] = Math.min(255, Math.floor(this.smoothedFreqData[i]));
        }
        return this.outFreqData;
      }
    }

    // Fallback if browser audio context hasn't unlocked yet
    const len = this.outFreqData.length;
    this.envelopePhase += 0.035 * Math.sqrt(this.playbackSpeed);
    let bookAmp = 0.55;
    if (this.currentBookPeaks.length > 0) {
      const exactIdx =
        this.currentPlayheadRatio * (this.currentBookPeaks.length - 1);
      const i0 = Math.floor(exactIdx);
      const i1 = Math.min(this.currentBookPeaks.length - 1, i0 + 1);
      const frac = exactIdx - i0;
      bookAmp =
        (this.currentBookPeaks[i0] ?? 0.5) * (1 - frac) +
        (this.currentBookPeaks[i1] ?? 0.5) * frac;
    }

    for (let i = 0; i < len; i++) {
      const norm = i / len;
      const speechCurve = Math.exp(-Math.pow((norm - 0.12) / 0.16, 2));
      const target = Math.max(0, Math.min(240, 180 * speechCurve * bookAmp));
      this.smoothedFreqData[i] =
        this.smoothedFreqData[i] * 0.75 + target * 0.25;
      this.outFreqData[i] = Math.floor(this.smoothedFreqData[i]);
    }
    return this.outFreqData;
  }

  /**
   * Real-time PCM time-domain waveform directly from the playing audiobook stream
   */
  public getTimeDomainData(): Uint8Array {
    if (!this.isActive()) {
      for (let i = 0; i < this.timeData.length; i++) {
        this.timeData[i] = Math.round(128 + (this.timeData[i] - 128) * 0.72);
      }
      return this.timeData;
    }

    if (this.analyser) {
      this.analyser.getByteTimeDomainData(this.timeData);
      return this.timeData;
    }

    return this.timeData;
  }

  /**
   * Real-time RMS speech loudness from actual PCM waveform samples + noise gate for breath pauses
   */
  public getRmsEnergy(): number {
    if (!this.isActive()) {
      this.smoothedRms *= 0.72;
      return this.smoothedRms < 0.002 ? 0 : this.smoothedRms;
    }

    // Calculate true instantaneous RMS from PCM time-domain waveform
    let pcmSqSum = 0;
    const tLen = this.timeData.length;
    for (let i = 0; i < tLen; i++) {
      const sample = (this.timeData[i] - 128) / 128;
      pcmSqSum += sample * sample;
    }
    const pcmRms = Math.sqrt(pcmSqSum / Math.max(1, tLen));

    // Also measure speech-band spectral energy (bins 2..85)
    let specSum = 0;
    const specBins = Math.min(85, this.outFreqData.length);
    for (let i = 2; i < specBins; i++) {
      const v = this.outFreqData[i] / 255;
      specSum += v * v;
    }
    const specRms = Math.sqrt(specSum / Math.max(1, specBins - 2));

    const combined = Math.max(pcmRms * 2.6, specRms * 1.15);
    // Speech noise gate: drop to 0 during breath pauses between words
    const gated = combined < 0.025 ? 0 : Math.min(1, (combined - 0.025) * 1.35);

    const alpha = gated > this.smoothedRms ? 0.52 : 0.28;
    this.smoothedRms = this.smoothedRms * (1 - alpha) + gated * alpha;
    return this.smoothedRms;
  }

  /**
   * Real-time human voice formant bands:
   * - F0 (Fundamental voice pitch: ~85–300 Hz, bins 2..7)
   * - F1 (Open vowel / jaw height: ~300–950 Hz, bins 7..22)
   * - F2 (Tongue articulation / front-back vowels: ~950–2600 Hz, bins 22..60)
   * - F3 (Consonants / sibilance / 's','t','k': ~2600–6500 Hz, bins 60..150)
   */
  public getVoiceFormants(): [number, number, number, number] {
    if (!this.isActive()) {
      this.smoothedFormants = [
        this.smoothedFormants[0] * 0.7,
        this.smoothedFormants[1] * 0.7,
        this.smoothedFormants[2] * 0.7,
        this.smoothedFormants[3] * 0.7,
      ];
      return this.smoothedFormants;
    }
    const data = this.outFreqData;
    const band = (start: number, end: number, gain: number) => {
      let s = 0;
      const stop = Math.min(data.length, end);
      for (let i = start; i < stop; i++) s += data[i] || 0;
      const norm = s / (Math.max(1, stop - start) * 255);
      // Contrast curve so quiet pauses sit near 0 and spoken syllables pop
      return Math.min(1, Math.pow(Math.max(0, norm - 0.03), 1.35) * gain);
    };

    const raw: [number, number, number, number] = [
      band(2, 8, 1.65),   // F0 Fundamental Pitch
      band(8, 23, 1.75),  // F1 Open Vowels
      band(23, 62, 1.95), // F2 Tongue Articulation
      band(62, 145, 2.3), // F3 Consonants & Sibilants
    ];

    for (let k = 0; k < 4; k++) {
      const prev = this.smoothedFormants[k];
      const next = raw[k];
      // Fast attack on spoken syllables (0.55), fast drop on pauses (0.32)
      const alpha = next > prev ? 0.55 : 0.32;
      this.smoothedFormants[k] = prev * (1 - alpha) + next * alpha;
    }
    return this.smoothedFormants;
  }

  public getAudioData(speechWeighted: boolean = true): {
    freq: Uint8Array;
    time: Uint8Array;
    rms: number;
    formants: [number, number, number, number];
    active: boolean;
  } {
    const freq = this.getFrequencyData(speechWeighted);
    const time = this.getTimeDomainData();
    const rms = this.getRmsEnergy();
    const formants = this.getVoiceFormants();
    return {
      freq,
      time,
      rms,
      formants,
      active: this.isActive(),
    };
  }
}

export const audioEngine = new TideAudioEngine();
