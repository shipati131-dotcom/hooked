/**
 * SFX manifest. `file` is optional -- if present and it loads, AudioSystem plays it.
 * If absent (or it fails to load), AudioSystem falls back to a small procedural
 * WebAudio synth recipe so the game always has real audio feedback with zero assets.
 * Drop matching files into public/visual-game-assets/audio/ to replace any of these later.
 */
export type SynthRecipe =
    | { kind: 'blip'; freq: number; decay: number; type: OscillatorType }
    | { kind: 'sweep'; from: number; to: number; decay: number; type: OscillatorType }
    | { kind: 'noise'; decay: number; filterFreq?: number }
    | { kind: 'chord'; freqs: number[]; decay: number; type: OscillatorType; stagger?: number }
    | { kind: 'click'; freq: number };

export interface SfxDef {
    key: string;
    file?: string;
    synth: SynthRecipe;
    volume?: number;
}

export const SFX: SfxDef[] = [
    { key: 'cast', synth: { kind: 'sweep', from: 220, to: 660, decay: 0.18, type: 'sine' } },
    { key: 'splash', synth: { kind: 'noise', decay: 0.35, filterFreq: 1200 } },
    { key: 'nibble', synth: { kind: 'blip', freq: 520, decay: 0.06, type: 'sine' }, volume: 0.5 },
    { key: 'bite', synth: { kind: 'sweep', from: 180, to: 90, decay: 0.22, type: 'sawtooth' } },
    { key: 'reel-tick', synth: { kind: 'click', freq: 900 }, volume: 0.35 },
    { key: 'reel-crank', synth: { kind: 'noise', decay: 0.05, filterFreq: 800 }, volume: 0.15 },
    { key: 'reel-perfect', synth: { kind: 'chord', freqs: [659, 988], decay: 0.16, type: 'triangle', stagger: 0.025 }, volume: 0.32 },
    { key: 'reel-miss', synth: { kind: 'sweep', from: 170, to: 105, decay: 0.11, type: 'sine' }, volume: 0.22 },
    { key: 'catch', synth: { kind: 'chord', freqs: [523, 659, 784, 1047], decay: 0.5, type: 'triangle', stagger: 0.05 } },
    { key: 'escape', synth: { kind: 'sweep', from: 400, to: 150, decay: 0.3, type: 'sawtooth' } },
    { key: 'coin', synth: { kind: 'blip', freq: 1200, decay: 0.1, type: 'square' }, volume: 0.4 },
    { key: 'purchase', synth: { kind: 'chord', freqs: [392, 523, 659], decay: 0.35, type: 'sine' } },
    { key: 'levelup', synth: { kind: 'chord', freqs: [523, 659, 784, 1047, 1319], decay: 0.7, type: 'triangle', stagger: 0.07 } },
    { key: 'achievement', synth: { kind: 'chord', freqs: [659, 784, 988], decay: 0.5, type: 'sine', stagger: 0.06 } },
    { key: 'rare', synth: { kind: 'sweep', from: 300, to: 1400, decay: 0.6, type: 'sine' } },
    { key: 'click', synth: { kind: 'click', freq: 700 }, volume: 0.3 },
    { key: 'hook-window', synth: { kind: 'blip', freq: 880, decay: 0.08, type: 'square' }, volume: 0.4 },

    // -- new redesign cues --
    { key: 'cast-charge', synth: { kind: 'click', freq: 500 }, volume: 0.18 },
    { key: 'cast-perfect', synth: { kind: 'chord', freqs: [784, 1175], decay: 0.22, type: 'triangle', stagger: 0.03 }, volume: 0.35 },
    { key: 'hotspot', synth: { kind: 'chord', freqs: [880, 1318], decay: 0.3, type: 'sine', stagger: 0.04 }, volume: 0.3 },
    { key: 'tug', synth: { kind: 'blip', freq: 340, decay: 0.08, type: 'sine' }, volume: 0.4 },
    { key: 'drag', synth: { kind: 'noise', decay: 0.4, filterFreq: 500 }, volume: 0.2 },
    { key: 'strike', synth: { kind: 'sweep', from: 260, to: 520, decay: 0.12, type: 'square' }, volume: 0.4 },
    { key: 'hook-set', synth: { kind: 'chord', freqs: [440, 660], decay: 0.18, type: 'square' }, volume: 0.35 },
    { key: 'line-strain', synth: { kind: 'noise', decay: 0.15, filterFreq: 2200 }, volume: 0.18 },
    { key: 'line-snap', synth: { kind: 'sweep', from: 900, to: 80, decay: 0.35, type: 'sawtooth' }, volume: 0.5 },
    { key: 'fish-run', synth: { kind: 'sweep', from: 200, to: 340, decay: 0.2, type: 'sine' }, volume: 0.28 },
    { key: 'fish-jump', synth: { kind: 'sweep', from: 300, to: 900, decay: 0.3, type: 'sine' }, volume: 0.35 },
    { key: 'splash-big', synth: { kind: 'noise', decay: 0.5, filterFreq: 900 }, volume: 0.4 },
    { key: 'tired', synth: { kind: 'blip', freq: 260, decay: 0.2, type: 'sine' }, volume: 0.3 },
    { key: 'phase', synth: { kind: 'chord', freqs: [220, 440, 880], decay: 0.6, type: 'sawtooth', stagger: 0.08 }, volume: 0.4 }
];

export function getSfx(key: string): SfxDef {
    const s = SFX.find(x => x.key === key);
    if (!s) throw new Error(`Unknown sfx: ${key}`);
    return s;
}
