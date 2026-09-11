import type { PerkDef } from './types';

export const PERKS: PerkDef[] = [
    {
        id: 'lucky-hook', name: 'Lucky Hook', description: 'Improves the odds of hooking rare, epic and legendary fish.',
        maxLevel: 10, baseCost: 200, costGrowth: 1.55, effectPerLevel: 0.02,
        format: (lvl, next) => `+${(lvl * 2)}% rare fish chance${lvl < 10 ? ` (next: +${(next * 2)}%)` : ' (MAX)'}`
    },
    {
        id: 'quick-bite', name: 'Quick Bite', description: 'Shortens the wait before a fish bites.',
        maxLevel: 10, baseCost: 180, costGrowth: 1.5, effectPerLevel: 0.035,
        format: (lvl, next) => `-${(lvl * 3.5).toFixed(0)}% wait time${lvl < 10 ? ` (next: -${(next * 3.5).toFixed(0)}%)` : ' (MAX)'}`
    },
    {
        id: 'strong-arms', name: 'Strong Arms', description: 'Fills the capture meter faster while reeling.',
        maxLevel: 10, baseCost: 220, costGrowth: 1.55, effectPerLevel: 0.03,
        format: (lvl, next) => `+${(lvl * 3)}% capture speed${lvl < 10 ? ` (next: +${(next * 3)}%)` : ' (MAX)'}`
    },
    {
        id: 'fish-sense', name: 'Fish Sense', description: 'Increases the chance of hooking a larger specimen.',
        maxLevel: 10, baseCost: 260, costGrowth: 1.55, effectPerLevel: 1,
        format: (lvl, next) => `+${lvl} large-fish tier${lvl < 10 ? ` (next: +${next})` : ' (MAX)'}`
    },
    {
        id: 'golden-touch', name: 'Golden Touch', description: 'Increases the coin value of every fish you sell.',
        maxLevel: 10, baseCost: 240, costGrowth: 1.55, effectPerLevel: 0.04,
        format: (lvl, next) => `+${(lvl * 4)}% sell value${lvl < 10 ? ` (next: +${(next * 4)}%)` : ' (MAX)'}`
    },
    {
        id: 'xp-hunter', name: 'XP Hunter', description: 'Increases the XP earned from every catch.',
        maxLevel: 10, baseCost: 200, costGrowth: 1.5, effectPerLevel: 0.04,
        format: (lvl, next) => `+${(lvl * 4)}% XP gained${lvl < 10 ? ` (next: +${(next * 4)}%)` : ' (MAX)'}`
    }
];

export function getPerk(id: string): PerkDef {
    const p = PERKS.find(x => x.id === id);
    if (!p) throw new Error(`Unknown perk: ${id}`);
    return p;
}

export function perkCost(perk: PerkDef, currentLevel: number): number {
    return Math.round(perk.baseCost * Math.pow(perk.costGrowth, currentLevel));
}
