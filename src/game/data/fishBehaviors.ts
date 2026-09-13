import type { MovementPattern } from './types';
import type { BehaviorType, BiteStyle, FightPhase, MoveId } from './types';

/**
 * Base fight tuning per `movementPattern` archetype, before per-fish scaling
 * (difficulty/weight/location/tutorial -- see systems/fishing/fightProfile.ts)
 * or per-fish overrides (FishDef.fight). Keyed by the existing movementPattern
 * so none of the 48 species entries needed editing to get a fight personality.
 */
export interface ArchetypeProfile {
    behaviorType: BehaviorType;
    stamina: number;
    strength: number;
    aggression: number;
    burstChance: number;
    burstPower: number;
    directionChangeFrequency: number;
    recoveryRate: number;
    hookDifficulty: number;
    biteStyle: BiteStyle;
    moves: MoveId[];
    parSec: number;
}

export const ARCHETYPES: Record<MovementPattern, ArchetypeProfile> = {
    calm: {
        behaviorType: 'small', stamina: 0.5, strength: 0.45, aggression: 0.2, burstChance: 0.15, burstPower: 0.8,
        directionChangeFrequency: 4, recoveryRate: 0.05, hookDifficulty: 0.05, biteStyle: 'timid',
        moves: ['cruise', 'rest'], parSec: 5
    },
    drifter: {
        behaviorType: 'small', stamina: 0.55, strength: 0.5, aggression: 0.25, burstChance: 0.2, burstPower: 0.85,
        directionChangeFrequency: 5, recoveryRate: 0.06, hookDifficulty: 0.1, biteStyle: 'timid',
        moves: ['cruise', 'run', 'rest'], parSec: 6
    },
    darter: {
        behaviorType: 'fast', stamina: 0.6, strength: 0.62, aggression: 0.55, burstChance: 0.45, burstPower: 1.1,
        directionChangeFrequency: 14, recoveryRate: 0.05, hookDifficulty: 0.3, biteStyle: 'runner',
        moves: ['cruise', 'run', 'rest'], parSec: 9
    },
    sinker: {
        behaviorType: 'heavy', stamina: 0.85, strength: 0.95, aggression: 0.4, burstChance: 0.35, burstPower: 1.15,
        directionChangeFrequency: 5, recoveryRate: 0.04, hookDifficulty: 0.35, biteStyle: 'cautious',
        moves: ['cruise', 'dive', 'rest'], parSec: 14
    },
    jumper: {
        behaviorType: 'acrobat', stamina: 0.7, strength: 0.68, aggression: 0.6, burstChance: 0.4, burstPower: 1.1,
        directionChangeFrequency: 10, recoveryRate: 0.05, hookDifficulty: 0.45, biteStyle: 'runner',
        moves: ['cruise', 'run', 'jump', 'rest'], parSec: 12
    },
    erratic: {
        behaviorType: 'tricky', stamina: 0.75, strength: 0.7, aggression: 0.55, burstChance: 0.5, burstPower: 1.15,
        directionChangeFrequency: 12, recoveryRate: 0.045, hookDifficulty: 0.6, biteStyle: 'trickster',
        moves: ['cruise', 'run', 'fakeout', 'rest'], parSec: 16
    },
    dasher: {
        behaviorType: 'aggressive', stamina: 0.8, strength: 0.9, aggression: 0.7, burstChance: 0.55, burstPower: 1.25,
        directionChangeFrequency: 9, recoveryRate: 0.04, hookDifficulty: 0.5, biteStyle: 'runner',
        moves: ['cruise', 'run', 'thrash', 'rest'], parSec: 18
    },
    mythic: {
        behaviorType: 'legendary', stamina: 1, strength: 1.1, aggression: 0.65, burstChance: 0.45, burstPower: 1.2,
        directionChangeFrequency: 8, recoveryRate: 0.03, hookDifficulty: 0.8, biteStyle: 'ominous',
        moves: ['cruise', 'run', 'dive', 'rest'], parSec: 32
    }
};

/** Legendary/mythic phase template, applied at stamina thresholds (checked in
 *  descending order). Signature legendaries/mythics can still override the
 *  whole `phases` array in FishDef.fight for a hand-authored fight. */
export const DEFAULT_LEGENDARY_PHASES: FightPhase[] = [
    { staminaThreshold: 0.66, addMoves: ['fakeout', 'thrash'], aggressionMult: 1.2, label: 'SECOND WIND' },
    { staminaThreshold: 0.33, addMoves: ['frenzy', 'whirl'], aggressionMult: 1.45, label: 'LAST STAND' }
];

/** Total lifetime catches at which each fight mechanic unlocks. Gates which
 *  moves the scheduler is allowed to pick and whether the hook-set requires a
 *  direction -- see systems/fishing/fightProfile.ts `gateMoves`. */
export const MECHANIC_UNLOCKS = {
    steering: 2, // runs + directional hook-set requirement
    diveAndRest: 5,
    jumps: 8,
    thrashAndFakeBites: 12, // thrash move + trickster false-plunge bite cue
    fakeouts: 16
};

/** Coach-hint copy shown for the first 2 catches after a mechanic unlocks. */
export const MECHANIC_HINTS: Record<keyof typeof MECHANIC_UNLOCKS, string> = {
    steering: 'The fish is running — drag to steer the rod, opposite its pull to fight harder',
    diveAndRest: 'Heavy fish dive and take line — hold a steady reel. When it tires, reel fast!',
    jumps: 'Fish jump! Give slack while it\'s airborne or it may throw the hook',
    thrashAndFakeBites: 'Watch for a false bite — wait for the real plunge before you strike',
    fakeouts: 'Tricky fish fake one direction, then run the other — read the real pull'
};
