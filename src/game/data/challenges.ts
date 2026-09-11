import type { ChallengeTemplate } from './types';

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
    {
        id: 'catch-any', goal: 'catchAny',
        describe: (n) => `Catch ${n} fish`,
        targetRange: [5, 15], rewardCoinsPer: 12, rewardXpPer: 5
    },
    {
        id: 'catch-species', goal: 'catchSpecies',
        describe: (n, species) => `Catch ${n} ${species ?? 'fish'}`,
        targetRange: [2, 6], rewardCoinsPer: 25, rewardXpPer: 10
    },
    {
        id: 'catch-rarity', goal: 'catchRarityAtLeast',
        describe: (n, rarity) => `Catch ${n} ${rarity ?? 'Rare'}+ fish`,
        targetRange: [1, 3], extraPool: ['uncommon', 'rare', 'epic'], rewardCoinsPer: 90, rewardXpPer: 35
    },
    {
        id: 'earn-coins', goal: 'earnCoins',
        describe: (n) => `Earn ${n.toLocaleString()} coins`,
        targetRange: [200, 2000], rewardCoinsPer: 0.4, rewardXpPer: 0.15
    },
    {
        id: 'catch-heavy', goal: 'catchWeightAtLeast',
        describe: (n) => `Catch a fish heavier than ${n} kg`,
        targetRange: [2, 15], rewardCoinsPer: 60, rewardXpPer: 20
    },
    {
        id: 'perfect-catches', goal: 'perfectCatches',
        describe: (n) => `Land ${n} PERFECT catches`,
        targetRange: [2, 5], rewardCoinsPer: 70, rewardXpPer: 25
    }
];

export function getChallengeTemplate(id: string): ChallengeTemplate {
    const t = CHALLENGE_TEMPLATES.find(x => x.id === id);
    if (!t) throw new Error(`Unknown challenge template: ${id}`);
    return t;
}
