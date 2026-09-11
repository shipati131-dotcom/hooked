import type { AchievementDef } from './types';

export const ACHIEVEMENTS: AchievementDef[] = [
    // ---- catches ----
    { id: 'first-catch', name: 'First Catch', description: 'Catch your first fish.', category: 'catches', condition: { type: 'stat', stat: 'totalCaught', gte: 1 }, rewardCoins: 20, rewardXp: 10 },
    { id: 'getting-hooked', name: 'Getting Hooked', description: 'Catch 25 fish.', category: 'catches', condition: { type: 'stat', stat: 'totalCaught', gte: 25 }, rewardCoins: 150, rewardXp: 60 },
    { id: 'dedicated-angler', name: 'Dedicated Angler', description: 'Catch 100 fish.', category: 'catches', condition: { type: 'stat', stat: 'totalCaught', gte: 100 }, rewardCoins: 500, rewardXp: 200 },
    { id: 'professional-angler', name: 'Professional Angler', description: 'Catch 500 fish.', category: 'catches', condition: { type: 'stat', stat: 'totalCaught', gte: 500 }, rewardCoins: 3000, rewardXp: 800 },
    { id: 'master-angler', name: 'Master Angler', description: 'Catch 2,000 fish.', category: 'catches', condition: { type: 'stat', stat: 'totalCaught', gte: 2000 }, rewardCoins: 15000, rewardXp: 3000 },
    { id: 'never-let-go', name: 'Never Let Go', description: 'Land 10 fish in a row without one escaping.', category: 'skill', condition: { type: 'stat', stat: 'bestCatchStreak', gte: 10 }, rewardCoins: 400, rewardXp: 150 },
    { id: 'perfect-form', name: 'Perfect Form', description: 'Land 25 PERFECT catches.', category: 'skill', condition: { type: 'stat', stat: 'perfectCatches', gte: 25 }, rewardCoins: 900, rewardXp: 300 },

    // ---- money ----
    { id: 'pocket-change', name: 'Pocket Change', description: 'Earn 1,000 coins total.', category: 'money', condition: { type: 'stat', stat: 'totalCoinsEarned', gte: 1000 }, rewardCoins: 100, rewardXp: 40 },
    { id: 'saving-up', name: 'Saving Up', description: 'Earn 10,000 coins total.', category: 'money', condition: { type: 'stat', stat: 'totalCoinsEarned', gte: 10000 }, rewardCoins: 500, rewardXp: 150 },
    { id: 'rich-angler', name: 'Rich Angler', description: 'Earn 100,000 coins total.', category: 'money', condition: { type: 'stat', stat: 'totalCoinsEarned', gte: 100000 }, rewardCoins: 3000, rewardXp: 500 },
    { id: 'tackle-tycoon', name: 'Tackle Tycoon', description: 'Earn 1,000,000 coins total.', category: 'money', condition: { type: 'stat', stat: 'totalCoinsEarned', gte: 1000000 }, rewardCoins: 20000, rewardXp: 2000 },

    // ---- size ----
    { id: 'decent-size', name: 'Decent Size', description: 'Catch a fish over 5 kg.', category: 'size', condition: { type: 'stat', stat: 'biggestFishKg', gte: 5 }, rewardCoins: 80, rewardXp: 30 },
    { id: 'big-one', name: 'Big One', description: 'Catch a fish over 10 kg.', category: 'size', condition: { type: 'stat', stat: 'biggestFishKg', gte: 10 }, rewardCoins: 200, rewardXp: 80 },
    { id: 'heavyweight', name: 'Heavyweight', description: 'Catch a fish over 40 kg.', category: 'size', condition: { type: 'stat', stat: 'biggestFishKg', gte: 40 }, rewardCoins: 600, rewardXp: 200 },
    { id: 'monster-catch', name: 'Monster Catch', description: 'Catch a fish over 100 kg.', category: 'size', condition: { type: 'stat', stat: 'biggestFishKg', gte: 100 }, rewardCoins: 2000, rewardXp: 600 },
    { id: 'true-titan', name: 'True Titan', description: 'Catch a fish over 500 kg.', category: 'size', condition: { type: 'stat', stat: 'biggestFishKg', gte: 500 }, rewardCoins: 10000, rewardXp: 2500 },

    // ---- collection ----
    { id: 'curious-collector', name: 'Curious Collector', description: 'Discover 10 species.', category: 'collection', condition: { type: 'speciesDiscovered', gte: 10 }, rewardCoins: 250, rewardXp: 100 },
    { id: 'collector', name: 'Collector', description: 'Discover 20 species.', category: 'collection', condition: { type: 'speciesDiscovered', gte: 20 }, rewardCoins: 600, rewardXp: 250 },
    { id: 'seasoned-collector', name: 'Seasoned Collector', description: 'Discover 35 species.', category: 'collection', condition: { type: 'speciesDiscovered', gte: 35 }, rewardCoins: 1500, rewardXp: 500 },
    { id: 'master-collector', name: 'Master Collector', description: 'Discover every species in the Fishdex.', category: 'collection', condition: { type: 'allSpeciesDiscovered' }, rewardCoins: 10000, rewardXp: 3000 },

    // ---- rarity ----
    { id: 'something-uncommon', name: 'Something Uncommon', description: 'Catch your first Uncommon fish.', category: 'rarity', condition: { type: 'rarityCaught', rarity: 'uncommon', gte: 1 }, rewardCoins: 40, rewardXp: 20 },
    { id: 'rare-find', name: 'Rare Find', description: 'Catch your first Rare fish.', category: 'rarity', condition: { type: 'rarityCaught', rarity: 'rare', gte: 1 }, rewardCoins: 120, rewardXp: 60 },
    { id: 'epic-encounter', name: 'Epic Encounter', description: 'Catch your first Epic fish.', category: 'rarity', condition: { type: 'rarityCaught', rarity: 'epic', gte: 1 }, rewardCoins: 350, rewardXp: 150 },
    { id: 'lucky-catch', name: 'Lucky Catch', description: 'Catch your first Legendary fish.', category: 'rarity', condition: { type: 'rarityCaught', rarity: 'legendary', gte: 1 }, rewardCoins: 1000, rewardXp: 400 },
    { id: 'myth-hunter', name: 'Myth Hunter', description: 'Catch your first Mythic fish.', category: 'rarity', condition: { type: 'rarityCaught', rarity: 'mythic', gte: 1 }, rewardCoins: 5000, rewardXp: 1500 },
    { id: 'legend-in-the-making', name: 'Legend in the Making', description: 'Catch 10 Legendary fish.', category: 'rarity', condition: { type: 'rarityCaught', rarity: 'legendary', gte: 10 }, rewardCoins: 6000, rewardXp: 2000 },

    // ---- locations ----
    { id: 'venturing-out', name: 'Venturing Out', description: 'Unlock your second fishing location.', category: 'locations', condition: { type: 'locationsUnlocked', gte: 2 }, rewardCoins: 150, rewardXp: 60 },
    { id: 'world-traveler', name: 'World Traveler', description: 'Unlock 5 fishing locations.', category: 'locations', condition: { type: 'locationsUnlocked', gte: 5 }, rewardCoins: 2000, rewardXp: 600 },
    { id: 'ends-of-the-earth', name: 'Ends of the Earth', description: 'Unlock every fishing location.', category: 'locations', condition: { type: 'locationsUnlocked', gte: 9 }, rewardCoins: 15000, rewardXp: 3000 },

    // ---- upgrades ----
    { id: 'gearing-up', name: 'Gearing Up', description: 'Buy your first rod upgrade.', category: 'upgrades', condition: { type: 'stat', stat: 'equipmentPurchased', gte: 1 }, rewardCoins: 60, rewardXp: 30 },
    { id: 'fully-equipped', name: 'Fully Equipped', description: 'Own at least one upgrade in every equipment category.', category: 'upgrades', condition: { type: 'stat', stat: 'categoriesUpgraded', gte: 4 }, rewardCoins: 500, rewardXp: 200 },
    { id: 'lucky-hook-master', name: 'Lucky Hook Master', description: 'Max out the Lucky Hook perk.', category: 'upgrades', condition: { type: 'perkLevel', perkId: 'lucky-hook', gte: 10 }, rewardCoins: 3000, rewardXp: 800 },
    { id: 'strong-arms-master', name: 'Iron Grip', description: 'Max out the Strong Arms perk.', category: 'upgrades', condition: { type: 'perkLevel', perkId: 'strong-arms', gte: 10 }, rewardCoins: 3000, rewardXp: 800 },

    // ---- level ----
    { id: 'level-5', name: 'Getting the Hang of It', description: 'Reach player level 5.', category: 'level', condition: { type: 'level', gte: 5 }, rewardCoins: 200, rewardXp: 0 },
    { id: 'level-15', name: 'Seasoned Angler', description: 'Reach player level 15.', category: 'level', condition: { type: 'level', gte: 15 }, rewardCoins: 1200, rewardXp: 0 },
    { id: 'level-30', name: 'Veteran Angler', description: 'Reach player level 30.', category: 'level', condition: { type: 'level', gte: 30 }, rewardCoins: 5000, rewardXp: 0 },
    { id: 'level-50', name: 'Angling Legend', description: 'Reach player level 50.', category: 'level', condition: { type: 'level', gte: 50 }, rewardCoins: 20000, rewardXp: 0 }
];

export function getAchievement(id: string): AchievementDef {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) throw new Error(`Unknown achievement: ${id}`);
    return a;
}
