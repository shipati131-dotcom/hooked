import Phaser from 'phaser';
import { SFX, getSfx, type SynthRecipe } from '../data/audio';
import type { SaveData } from '../core/GameState';

/**
 * Plays a loaded sound file if one exists for a key; otherwise synthesizes a
 * short WebAudio sound so the game always has real audio feedback with zero
 * asset files. Never throws or blocks gameplay if audio is unavailable.
 */
export class AudioSystem {
    private ctx: AudioContext | null = null;
    private hasFile = new Set<string>();

    constructor(private game: Phaser.Game, private save: SaveData) {
        for (const sfx of SFX) {
            if (sfx.file && game.cache.audio.exists(sfx.key)) this.hasFile.add(sfx.key);
        }
    }

    private ensureCtx(): AudioContext | null {
        if (this.save.settings.muted) return null;
        if (!this.ctx) {
            try {
                const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                this.ctx = new Ctor();
            } catch {
                return null;
            }
        }
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return this.ctx;
    }

    play(key: string): void {
        if (this.save.settings.muted) return;
        try {
            const def = getSfx(key);
            const vol = (def.volume ?? 0.6) * this.save.settings.sfxVolume;
            if (this.hasFile.has(key)) {
                this.game.sound.play(key, { volume: vol });
                return;
            }
            this.synth(def.synth, vol);
        } catch (e) {
            console.warn('[AudioSystem] failed to play', key, e);
        }
    }

    private synth(recipe: SynthRecipe, volume: number): void {
        const ctx = this.ensureCtx();
        if (!ctx) return;
        const now = ctx.currentTime;

        if (recipe.kind === 'noise') {
            const bufferSize = Math.floor(ctx.sampleRate * recipe.decay);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = recipe.filterFreq ?? 1500;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + recipe.decay);
            src.connect(filter).connect(gain).connect(ctx.destination);
            src.start(now);
            src.stop(now + recipe.decay + 0.05);
            return;
        }

        if (recipe.kind === 'click') {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = recipe.freq;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.06);
            return;
        }

        if (recipe.kind === 'chord') {
            recipe.freqs.forEach((freq, i) => {
                const start = now + (recipe.stagger ?? 0) * i;
                const osc = ctx.createOscillator();
                osc.type = recipe.type;
                osc.frequency.value = freq;
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(volume * 0.6, start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, start + recipe.decay);
                osc.connect(gain).connect(ctx.destination);
                osc.start(start);
                osc.stop(start + recipe.decay + 0.05);
            });
            return;
        }

        // blip / sweep
        const osc = ctx.createOscillator();
        osc.type = recipe.type;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + recipe.decay);
        if (recipe.kind === 'sweep') {
            osc.frequency.setValueAtTime(recipe.from, now);
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, recipe.to), now + recipe.decay);
        } else {
            osc.frequency.value = recipe.freq;
        }
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + recipe.decay + 0.05);
    }
}
