import { ARCHETYPES, DEFAULT_LEGENDARY_PHASES, MECHANIC_UNLOCKS } from '../../data/fishBehaviors';
import type { FightProfile, FishDef, MoveId } from '../../data/types';
import { BALANCE } from '../../data/balance';
import { clamp } from '../../utils/format';
import { RARITY_ORDER } from '../../constants';

export interface FightProfileContext {
    weightPercentile: number; // 0..1
    locationDifficultyMod: number;
    /** 0 at a brand-new player, 1 at full difficulty -- see FishingSystem's tutorial ramp. */
    tutorialProgress: number;
    /** Total lifetime catches, used to gate which moves are unlocked yet. */
    totalCaught: number;
}

const MOVES_ALWAYS_ON: MoveId[] = ['cruise', 'rest'];

/** Which moves each MECHANIC_UNLOCKS threshold gates. A move not covered here
 *  is always available once its archetype includes it. */
const MOVE_UNLOCK_GATE: Partial<Record<MoveId, keyof typeof MECHANIC_UNLOCKS>> = {
    run: 'steering',
    dive: 'diveAndRest',
    jump: 'jumps',
    thrash: 'thrashAndFakeBites',
    fakeout: 'fakeouts'
};

/** Builds the full fight tuning for a hooked fish: archetype base, scaled by
 *  fish difficulty/weight/location/tutorial ramp, then any per-fish override
 *  from FishDef.fight, then move-unlock gating for the player's progress. */
export function buildFightProfile(fish: FishDef, ctx: FightProfileContext): FightProfile {
    const archetype = ARCHETYPES[fish.movementPattern];
    const difficultyNorm = clamp((fish.difficulty - 1) / 9, 0, 1); // 1..10 -> 0..1
    const weightScale = 0.7 + 0.6 * ctx.weightPercentile;
    const locScale = clamp(ctx.locationDifficultyMod, 0.4, 4);
    const tutorialScale = BALANCE.bite.tutorialScale + (1 - BALANCE.bite.tutorialScale) * clamp(ctx.tutorialProgress, 0, 1);

    const rarityIdx = RARITY_ORDER.indexOf(fish.rarity);
    const isLegendaryPlus = rarityIdx >= RARITY_ORDER.indexOf('legendary');

    const base: FightProfile = {
        behaviorType: archetype.behaviorType,
        stamina: archetype.stamina * (0.75 + 0.5 * difficultyNorm) * (0.85 + 0.3 * weightScale),
        strength: archetype.strength * (0.7 + 0.6 * difficultyNorm) * weightScale * locScale * tutorialScale,
        aggression: clamp(archetype.aggression * (0.7 + 0.6 * difficultyNorm) * tutorialScale, 0.05, 1),
        burstChance: clamp(archetype.burstChance * (0.8 + 0.4 * difficultyNorm), 0.05, 0.85),
        burstPower: archetype.burstPower * (0.85 + 0.3 * difficultyNorm) * locScale,
        directionChangeFrequency: archetype.directionChangeFrequency * (0.8 + 0.4 * difficultyNorm),
        recoveryRate: archetype.recoveryRate * (1.15 - 0.3 * difficultyNorm),
        hookDifficulty: clamp(archetype.hookDifficulty * (0.8 + 0.5 * difficultyNorm), 0, 1),
        biteStyle: archetype.biteStyle,
        moves: [...new Set([...MOVES_ALWAYS_ON, ...archetype.moves])],
        phases: isLegendaryPlus ? DEFAULT_LEGENDARY_PHASES : undefined,
        parSec: archetype.parSec * (0.85 + 0.35 * difficultyNorm) * (0.9 + 0.3 * weightScale)
    };

    const merged: FightProfile = { ...base, ...fish.fight, moves: fish.fight?.moves ?? base.moves };
    return gateMoves(merged, ctx.totalCaught);
}

/** Filters out moves the player hasn't unlocked yet (see MECHANIC_UNLOCKS),
 *  so early fights genuinely teach one mechanic at a time regardless of which
 *  species the player happens to hook first. */
function gateMoves(profile: FightProfile, totalCaught: number): FightProfile {
    const moves = profile.moves.filter(m => {
        const gate = MOVE_UNLOCK_GATE[m];
        if (!gate) return true;
        return totalCaught >= MECHANIC_UNLOCKS[gate];
    });
    const hookDifficulty = totalCaught >= MECHANIC_UNLOCKS.steering ? profile.hookDifficulty : 0;
    return { ...profile, moves: moves.length ? moves : MOVES_ALWAYS_ON, hookDifficulty };
}
