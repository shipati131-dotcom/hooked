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
    { key: 'catch', synth: { kind: 'chord', freqs: [523, 659, 784, 1047], decay: 0.5, type: 'triangle', stagger: 0.05 } },
    { key: 'escape', synth: { kind: 'sweep', from: 400, to: 150, decay: 0.3, type: 'sawtooth' } },
    { key: 'coin', synth: { kind: 'blip', freq: 1200, decay: 0.1, type: 'square' }, volume: 0.4 },
    { key: 'purchase', synth: { kind: 'chord', freqs: [392, 523, 659], decay: 0.35, type: 'sine' } },
    { key: 'levelup', synth: { kind: 'chord', freqs: [523, 659, 784, 1047, 1319], decay: 0.7, type: 'triangle', stagger: 0.07 } },
    { key: 'achievement', synth: { kind: 'chord', freqs: [659, 784, 988], decay: 0.5, type: 'sine', stagger: 0.06 } },
    { key: 'rare', synth: { kind: 'sweep', from: 300, to: 1400, decay: 0.6, type: 'sine' } },
    { key: 'click', synth: { kind: 'click', freq: 700 }, volume: 0.3 },
    { key: 'hook-window', synth: { kind: 'blip', freq: 880, decay: 0.08, type: 'square' }, volume: 0.4 }
];

export function getSfx(key: string): SfxDef {
    const s = SFX.find(x => x.key === key);
    if (!s) throw new Error(`Unknown sfx: ${key}`);
    return s;
}
