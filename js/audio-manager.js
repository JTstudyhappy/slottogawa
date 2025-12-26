export default class AudioManager {
    constructor(config = {}) {
        this.config = config || {};
        this.volumes = {
            bgm: this.config.volumes?.bgm ?? 0.6,
            sfx: this.config.volumes?.sfx ?? 0.85,
            voice: this.config.volumes?.voice ?? 0.8
        };
        this.bgmTracks = Array.isArray(this.config.bgm) ? this.config.bgm : [];
        this.sfxConfig = this.config.sfx || {};

        this.bgmAudioMap = new Map();
        this.sfxTemplates = new Map();
        this.currentBgmId = null;
        this.currentBgmAudio = null;
        this.reelAudio = null;
        this.currentVoiceAudio = null; // 当前正在播放的语音，确保完整播放

        this.bgmEnabled = true;
        this.bgmLocked = false; // BGM永久锁定标志
    }

    load() {
        this.bgmTracks.forEach(track => {
            if (!track?.src) return;
            const audio = new Audio(track.src);
            audio.loop = true;
            audio.preload = 'auto';
            audio.volume = this.volumes.bgm;
            this.bgmAudioMap.set(track.id, audio);
        });

        Object.entries(this.sfxConfig).forEach(([key, value]) => {
            if (!value) return;
            if (Array.isArray(value)) {
                const arr = value.map(src => this.createSfxTemplate(src)).filter(Boolean);
                if (arr.length) this.sfxTemplates.set(key, arr);
            } else {
                const tpl = this.createSfxTemplate(value);
                if (tpl) this.sfxTemplates.set(key, tpl);
            }
        });
    }

    createSfxTemplate(src) {
        if (!src) return null;
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = this.volumes.sfx;
        return audio;
    }

    updateBgmByCoins(coins) {
        if (this.bgmLocked) return; // 如果BGM已锁定，不再切换
        if (!this.bgmTracks.length) return;
        const target = this.bgmTracks.find(t => coins >= (t.min_coins ?? 0) && coins < (t.max_coins ?? Number.POSITIVE_INFINITY))
            || this.bgmTracks[this.bgmTracks.length - 1];
        if (!target || !target.id) return;
        if (target.id === this.currentBgmId) return;
        this.switchBgm(target.id);
    }

    playInitialBgm1() {
        if (!this.bgmTracks.length) return;
        const first = this.bgmTracks[0];
        if (first?.id) this.switchBgm(first.id);
    }

    setBgmEnabled(enabled) {
        this.bgmEnabled = !!enabled;
        if (!this.bgmEnabled) {
            if (this.currentBgmAudio) this.currentBgmAudio.pause();
            return;
        }
        if (this.currentBgmAudio) {
            this.currentBgmAudio.volume = this.volumes.bgm;
            this.safePlay(this.currentBgmAudio);
        }
    }

    toggleBgmEnabled() {
        this.setBgmEnabled(!this.bgmEnabled);
        return this.bgmEnabled;
    }

    resumeBgmIfNeeded() {
        if (!this.bgmEnabled) return;
        if (this.currentBgmAudio && this.currentBgmAudio.paused) {
            this.safePlay(this.currentBgmAudio);
        }
    }

    switchBgm(trackId) {
        const nextAudio = this.bgmAudioMap.get(trackId);
        if (!nextAudio) return;
        if (this.currentBgmAudio && this.currentBgmAudio !== nextAudio) {
            this.currentBgmAudio.pause();
            this.currentBgmAudio.currentTime = 0;
        }
        this.currentBgmId = trackId;
        this.currentBgmAudio = nextAudio;
        nextAudio.volume = this.volumes.bgm;
        if (this.bgmEnabled) this.safePlay(nextAudio);
    }

    playSfx(key, opts = {}) {
        this.resumeBgmIfNeeded();
        const tpl = this.sfxTemplates.get(key);
        if (!tpl) return;
        const audio = Array.isArray(tpl)
            ? tpl[Math.floor(Math.random() * tpl.length)]?.cloneNode()
            : tpl.cloneNode();
        if (!audio) return;
        audio.volume = this.clamp(this.volumes.sfx * (opts.volume ?? 1), 0, 1);
        audio.playbackRate = this.clamp(opts.playbackRate ?? 1, 0.5, 3);
        this.safePlay(audio);
    }

    startReelSound(playbackRate = 1) {
        this.resumeBgmIfNeeded();
        const tpl = this.sfxTemplates.get('reel_spin');
        if (!tpl) return;
        if (this.reelAudio) {
            this.reelAudio.pause();
            this.reelAudio = null;
        }
        const audio = Array.isArray(tpl) ? tpl[0].cloneNode() : tpl.cloneNode();
        audio.loop = true;
        audio.volume = this.volumes.sfx;
        audio.playbackRate = this.clamp(playbackRate, 0.5, 3);
        this.reelAudio = audio;
        this.safePlay(audio);
    }

    stopReelSound() {
        if (this.reelAudio) {
            this.reelAudio.pause();
            this.reelAudio = null;
        }
    }

    playWaiter(index = 0) {
        this.resumeBgmIfNeeded();
        const tpl = this.sfxTemplates.get('waiter');
        if (!tpl || !Array.isArray(tpl)) return;
        
        // 停止之前的语音（如果有）
        if (this.currentVoiceAudio) {
            this.currentVoiceAudio.pause();
            this.currentVoiceAudio = null;
        }
        
        // 根据index播放对应的语音（0-based）
        const validIndex = Math.max(0, Math.min(index, tpl.length - 1));
        const audio = tpl[validIndex]?.cloneNode();
        if (!audio) return;
        
        audio.volume = this.clamp(this.volumes.voice, 0, 1);
        this.currentVoiceAudio = audio;
        
        // 监听多个事件确保引用被清除
        const clearVoice = () => {
            if (this.currentVoiceAudio === audio) {
                this.currentVoiceAudio = null;
            }
        };
        audio.addEventListener('ended', clearVoice);
        audio.addEventListener('pause', clearVoice);
        audio.addEventListener('error', clearVoice);
        
        this.safePlay(audio);
    }

    lockBgmToEnding() {
        this.bgmLocked = true;
        this.switchBgm('ending');
    }

    playEndingSfx() {
        this.resumeBgmIfNeeded();
        const tpl = this.sfxTemplates.get('ending');
        if (!tpl) return;
        
        // 停止之前的语音（如果有）
        if (this.currentVoiceAudio) {
            this.currentVoiceAudio.pause();
            this.currentVoiceAudio = null;
        }
        
        const audio = Array.isArray(tpl) ? tpl[0].cloneNode() : tpl.cloneNode();
        if (!audio) return;
        
        audio.volume = this.clamp(this.volumes.voice, 0, 1);
        this.currentVoiceAudio = audio;
        
        // 监听多个事件确保引用被清除
        const clearVoice = () => {
            if (this.currentVoiceAudio === audio) {
                this.currentVoiceAudio = null;
            }
        };
        audio.addEventListener('ended', clearVoice);
        audio.addEventListener('pause', clearVoice);
        audio.addEventListener('error', clearVoice);
        
        this.safePlay(audio);
    }

    playGemSfx(gemCount) {
        if (!gemCount || gemCount <= 0) return;
        let key = 'gem_small';
        if (gemCount > 20) key = 'gem_big';
        else if (gemCount > 5) key = 'gem_mid';
        this.playSfx(key);
    }

    safePlay(audio) {
        if (!audio) return;
        audio.play().catch(() => {});
    }

    clamp(val, min, max) {
        return Math.min(max, Math.max(min, val));
    }
}
