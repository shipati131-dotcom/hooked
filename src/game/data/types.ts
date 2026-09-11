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

export type EquipmentCategory = 'rod' | 'reel' | 'line' | 'bait' | 'bobber';

export interface RodStats { control: number; power: number; rareLuck: number; }
export interface ReelStats { captureSpeed: number; tensionResist: number; }
export interface LineStats { maxTension: number; snapResist: number; color: number; }
export interface BaitStats { biteSpeed: number; rarityLuck: number; habitatAffinity: Partial<Record<Habitat, number>>; }
export interface BobberStats { skinColor: number; }

export interface EquipmentDef {
    id: string;
    category: EquipmentCategory;
    name: string;
    description: string;
    price: number;
    unlockLevel: number;
    tier: number;
    stats: RodStats | ReelStats | LineStats | BaitStats | BobberStats;
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
