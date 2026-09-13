import type { MoveId } from '../../data/types';

/**
 * Generic, data-driven config for one fish move. FightModel's scheduler reads
 * these fields to drive tension/lateral/distance/hook-throw behaviour without
 * needing a special case per move -- to add a new behaviour, add one entry
 * here (and list the MoveId in an archetype or FightPhase.addMoves).
 */
export interface MoveConfig {
    id: MoveId;
    /** Seconds of visible telegraph (banner/streak/arrow) before the move goes active. 0 = no telegraph. */
    telegraphSec: number;
    activeSecMin: number;
    activeSecMax: number;
    /** Multiplies the fish's base pull force while this move is active. */
    pullMult: number;
    /** How the move moves the fish laterally (left/right on the FightView). */
    lateral: 'drift' | 'burst' | 'fakeout' | 'circular' | 'still';
    /** How much distance (line taken out) this move costs the player, beyond the tension model's normal drag. */
    outwardMult: number;
    /** True while this move is active, the fish is airborne (jumps only) -- reeling with high tension risks a hook-throw. */
    airborne?: boolean;
    /** True for moves that spike tension in rapid pulses rather than one smooth pull (thrash, frenzy). */
    pulsed?: boolean;
    /** Reeling gets a large distance multiplier during this move (rest). */
    reelBonusMult?: number;
    /** This move heavily favors picking a target opposite the fish's current side (used by darter/erratic fakeouts). */
    reverseLateral?: boolean;
    label: string; // FightHud/FightView callout text
}

export const MOVES: Record<MoveId, MoveConfig> = {
    cruise: {
        id: 'cruise', telegraphSec: 0, activeSecMin: 1.2, activeSecMax: 2.2, pullMult: 0.55,
        lateral: 'drift', outwardMult: 0.3, label: ''
    },
    rest: {
        id: 'rest', telegraphSec: 0, activeSecMin: 1, activeSecMax: 1.6, pullMult: 0.25,
        lateral: 'drift', outwardMult: 0.1, reelBonusMult: 1.8, label: 'TIRED — REEL NOW!'
    },
    run: {
        id: 'run', telegraphSec: 0.45, activeSecMin: 0.7, activeSecMax: 1.4, pullMult: 1.15,
        lateral: 'burst', outwardMult: 1, label: 'RUN'
    },
    dive: {
        id: 'dive', telegraphSec: 0.35, activeSecMin: 0.9, activeSecMax: 1.6, pullMult: 1.68,
        lateral: 'drift', outwardMult: 1.4, label: 'DIVING — HOLD STEADY'
    },
    thrash: {
        id: 'thrash', telegraphSec: 0.25, activeSecMin: 1.2, activeSecMax: 1.8, pullMult: 1.1,
        lateral: 'still', outwardMult: 0.5, pulsed: true, label: 'THRASHING — EASE OFF THE SPIKES'
    },
    jump: {
        id: 'jump', telegraphSec: 0.5, activeSecMin: 0.7, activeSecMax: 0.7, pullMult: 0.4,
        lateral: 'still', outwardMult: 0.2, airborne: true, label: 'JUMP — GIVE SLACK!'
    },
    fakeout: {
        id: 'fakeout', telegraphSec: 0.4, activeSecMin: 0.7, activeSecMax: 1.2, pullMult: 1.2,
        lateral: 'fakeout', outwardMult: 1, reverseLateral: true, label: 'FAKE-OUT — WATCH THE REVERSAL'
    },
    frenzy: {
        id: 'frenzy', telegraphSec: 0.3, activeSecMin: 1.4, activeSecMax: 2, pullMult: 1.3,
        lateral: 'burst', outwardMult: 1.1, pulsed: true, label: 'FRENZY!'
    },
    deepPlunge: {
        id: 'deepPlunge', telegraphSec: 0.5, activeSecMin: 1.1, activeSecMax: 1.6, pullMult: 1.55,
        lateral: 'drift', outwardMult: 1.8, label: 'DEEP PLUNGE — HOLD ON'
    },
    whirl: {
        id: 'whirl', telegraphSec: 0.3, activeSecMin: 1.5, activeSecMax: 2.2, pullMult: 1.05,
        lateral: 'circular', outwardMult: 0.6, label: 'CIRCLING'
    }
};
