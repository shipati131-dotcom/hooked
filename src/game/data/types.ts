import type { Rarity } from '../constants';

export type Habitat = 'fresh' | 'salt' | 'deep' | 'ice' | 'lava' | 'abyss';

export type MovementPattern =
    | 'calm'
    | 'drifter'
    | 'darter'
    | 'sinker'
    | 'jumper'
    | 'erratic'
    | 'dasher'
    | 'mythic';

export type BodyShape =
    | 'round'
    | 'long'
    | 'flat'
    | 'eel'
    | 'shark'
    | 'sword'
    | 'koi'
    | 'angler'
    | 'fantasy';

export interface FishArtSpec {
    shape: BodyShape;
    primaryColor: number;
    secondaryColor: number;
    finColor: number;
    pattern?: 'stripes' | 'spots' | 'gradient' | 'scales' | 'none';
    glow?: boolean;
}

/** How a fish announces itself before the real strike -- see data/fishBehaviors.ts. */
export type BiteStyle = 'timid' | 'greedy' | 'cautious' | 'runner' | 'trickster' | 'ominous';

/** The personality archetype driving a hooked fish's fight -- see data/fishBehaviors.ts. */
export type BehaviorType = 'small' | 'fast' | 'heavy' | 'acrobat' | 'aggressive' | 'tricky' | 'legendary';

/** One move a fish can perform while fought -- see systems/fishing/fightMoves.ts. */
export type MoveId = 'cruise' | 'run' | 'dive' | 'thrash' | 'jump' | 'fakeout' | 'rest' | 'frenzy' | 'deepPlunge' | 'whirl';

/** A legendary/mythic phase transition: at or below this stamina fraction, the
 *  fight gains the listed moves/specials and its aggression multiplier steps up. */
export interface FightPhase {
    staminaThreshold: number; // 0..1, phase activates when stamina drops to/below this
    addMoves: MoveId[];
    aggressionMult: number;
    label: string; // shown on the phase-change banner, e.g. "SECOND WIND"
}

/** Full data-driven fight tuning for a hooked fish. Built by
 *  systems/fishing/fightProfile.ts from the archetype for `movementPattern`,
 *  then scaled by difficulty/weight/location, then overridden per-fish here. */
export interface FightProfile {
    behaviorType: BehaviorType;
    stamina: number; // 0..1 capacity, larger = longer fight
    strength: number; // base pull force
    aggression: number; // 0..1, how often offensive moves are picked
    burstChance: number; // 0..1, chance a scheduled move is a burst (run/thrash/etc) vs cruise
    burstPower: number; // multiplier applied during run/dive/thrash/jump
    directionChangeFrequency: number; // moves per minute, roughly
    recoveryRate: number; // stamina regained per second while slack
    hookDifficulty: number; // 0..1, gates directional hook-set requirement and double-pulls
    biteStyle: BiteStyle;
    moves: MoveId[];
    phases?: FightPhase[];
    parSec: number; // target "perfect" landing time for this fish
}

export interface FishDef {
    id: string;
    name: string;
    description: string;
    rarity: Rarity;
    baseValue: number;
    xp: number;
    minWeight: number;
    maxWeight: number;
    difficulty: number; // 1-10
    habitat: Habitat;
    locations: string[]; // location ids where it can appear
    biteChance: number; // relative weight within its rarity bucket
    movementPattern: MovementPattern;
    art: FishArtSpec;
    /** Hand-authored fight tuning override (signature fish, legendaries/mythics).
     *  Anything omitted here still comes from the archetype + scaling. */
    fight?: Partial<FightProfile>;
}

export interface LocationDef {
    id: string;
    name: string;
    description: string;
    order: number;
    unlockLevel: number;
    travelCost: number;
    ambience: string;
    difficultyMod: number; // multiplies fish difficulty
    valueMult: number; // multiplies fish sell value
    rarityWeights: Record<Rarity, number>;
    palette: {
        sky: [number, number];
        water: [number, number];
        fog: number;
        accent: number;
    };
    props: ('lilypad' | 'reeds' | 'pine' | 'dock' | 'rocks' | 'palm' | 'ice' | 'lava' | 'coral' | 'fireflies' | 'aurora' | 'stars')[];
}

export type EquipmentCategory = 'rod' | 'reel' | 'line' | 'bait' | 'bobber' | 'hook';

export interface RodStats {
    control: number; power: number; rareLuck: number;
    /** 0..1, how much the rod absorbs sudden bursts (slows tension rise, extends snap grace). */
    flex: number;
}
export interface ReelStats { captureSpeed: number; tensionResist: number; }
export interface LineStats { maxTension: number; snapResist: number; color: number; }
export interface BaitStats { biteSpeed: number; rarityLuck: number; habitatAffinity: Partial<Record<Habitat, number>>; }
export interface BobberStats { skinColor: number; }
export interface HookStats {
    windowMult: number; // multiplies the hook-set strike window
    directionForgiveness: number; // 0..1, chance a wrong-direction strike downgrades to a light hook instead of losing the fish
    holdStrength: number; // 0..1, reduces hook-throw chance on jumps/slack and lengthens the slack timer
}

export interface EquipmentDef {
    id: string;
    category: EquipmentCategory;
    name: string;
    description: string;
    price: number;
    unlockLevel: number;
    tier: number;
    stats: RodStats | ReelStats | LineStats | BaitStats | BobberStats | HookStats;
}

export interface PerkDef {
    id: string;
    name: string;
    description: string;
    maxLevel: number;
    baseCost: number;
    costGrowth: number;
    effectPerLevel: number; // e.g. 0.02 = +2% per level
    format: (level: number, next: number) => string;
}

export type AchievementCondition =
    | { type: 'stat'; stat: string; gte: number }
    | { type: 'rarityCaught'; rarity: Rarity; gte: number }
    | { type: 'speciesDiscovered'; gte: number }
    | { type: 'allSpeciesDiscovered' }
    | { type: 'level'; gte: number }
    | { type: 'locationsUnlocked'; gte: number }
    | { type: 'perkLevel'; perkId: string; gte: number };

export interface AchievementDef {
    id: string;
    name: string;
    description: string;
    category: 'catches' | 'money' | 'size' | 'collection' | 'rarity' | 'locations' | 'upgrades' | 'level' | 'skill';
    condition: AchievementCondition;
    rewardCoins: number;
    rewardXp: number;
}

export type ChallengeGoalType = 'catchSpecies' | 'catchRarityAtLeast' | 'earnCoins' | 'catchWeightAtLeast' | 'perfectCatches' | 'catchAny';

export interface ChallengeTemplate {
    id: string;
    goal: ChallengeGoalType;
    describe: (target: number, extra?: string) => string;
    targetRange: [number, number];
    extraPool?: string[]; // e.g. species ids or rarity names
    rewardCoinsPer: number;
    rewardXpPer: number;
}

export interface ActiveChallenge {
    id: string;
    templateId: string;
    goal: ChallengeGoalType;
    target: number;
    progress: number;
    extra?: string;
    description: string;
    rewardCoins: number;
    rewardXp: number;
    completed: boolean;
}
