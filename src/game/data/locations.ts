import type { LocationDef } from './types';

/** All locations, ordered by progression. Fees are one-time; unlockLevel gates travel. */
export const LOCATIONS: LocationDef[] = [
    {
        id: 'pond', name: 'Peaceful Pond', order: 0, unlockLevel: 1, travelCost: 0,
        ambience: 'pond', difficultyMod: 0.5, valueMult: 1.0,
        description: 'A calm little pond behind the old mill. Perfect for learning the ropes.',
        rarityWeights: { common: 70, uncommon: 22, rare: 6.5, epic: 1.2, legendary: 0.28, mythic: 0.02 },
        palette: { sky: [0x8fd6f0, 0xdff3ff], water: [0x2c93b0, 0x0e5a74], fog: 0xcdeffb, accent: 0xffe17a },
        props: ['lilypad', 'reeds']
    },
    {
        id: 'lake', name: 'Pinewood Lake', order: 1, unlockLevel: 3, travelCost: 400,
        ambience: 'lake', difficultyMod: 0.65, valueMult: 1.3,
        description: 'Misty pines ring a wide, quiet lake. The fish here run a little bigger.',
        rarityWeights: { common: 60, uncommon: 27, rare: 10, epic: 2.5, legendary: 0.45, mythic: 0.05 },
        palette: { sky: [0x9fc9d8, 0xe7f4f2], water: [0x246b82, 0x0b3f52], fog: 0xd9ecec, accent: 0x8fbf7a },
        props: ['pine', 'dock', 'reeds']
    },
    {
        id: 'river', name: 'Mountain River', order: 2, unlockLevel: 6, travelCost: 1800,
        ambience: 'river', difficultyMod: 0.85, valueMult: 1.7,
        description: 'Fast, cold water tumbling down from the peaks. Strong fish, stronger current.',
        rarityWeights: { common: 50, uncommon: 30, rare: 15, epic: 4, legendary: 0.85, mythic: 0.15 },
        palette: { sky: [0xaad4e6, 0xf0f8fb], water: [0x3d92b8, 0x145066], fog: 0xe5f4fa, accent: 0xffffff },
        props: ['rocks', 'pine']
    },
    {
        id: 'swamp', name: 'Misty Swamp', order: 3, unlockLevel: 10, travelCost: 6000,
        ambience: 'swamp', difficultyMod: 1.05, valueMult: 2.2,
        description: 'Cypress knees and drifting fog. Strange things bite in the murk at dusk.',
        rarityWeights: { common: 42, uncommon: 30, rare: 20, epic: 6.5, legendary: 1.3, mythic: 0.2 },
        palette: { sky: [0x6b8271, 0xc9d3a8], water: [0x4a5c3a, 0x27321f], fog: 0x9fae86, accent: 0xd7ff8a },
        props: ['reeds', 'fireflies', 'rocks']
    },
    {
        id: 'coast', name: 'Tropical Coast', order: 4, unlockLevel: 14, travelCost: 15000,
        ambience: 'coast', difficultyMod: 1.35, valueMult: 3.0,
        description: 'Warm turquoise shallows over the reef, painted gold at sunset.',
        rarityWeights: { common: 34, uncommon: 30, rare: 24, epic: 9.5, legendary: 2.1, mythic: 0.4 },
        palette: { sky: [0xffc98a, 0xfff0da], water: [0x1fb3c9, 0x0a6478], fog: 0xffe9c9, accent: 0xff7a7a },
        props: ['palm', 'coral', 'rocks']
    },
    {
        id: 'ocean', name: 'Deep Ocean', order: 5, unlockLevel: 19, travelCost: 40000,
        ambience: 'ocean', difficultyMod: 1.75, valueMult: 4.0,
        description: 'No land in sight. The swells hide monsters worth chasing.',
        rarityWeights: { common: 26, uncommon: 28, rare: 27, epic: 14, legendary: 4, mythic: 0.9 },
        palette: { sky: [0x4f8fc9, 0xbfe0f2], water: [0x0e5a86, 0x03263c], fog: 0xbfe0f2, accent: 0xffffff },
        props: ['rocks']
    },
    {
        id: 'fjord', name: 'Frozen Fjord', order: 6, unlockLevel: 25, travelCost: 100000,
        ambience: 'fjord', difficultyMod: 2.2, valueMult: 5.5,
        description: 'Glacier-carved cliffs under a shivering aurora. The cold keeps rare things down deep.',
        rarityWeights: { common: 18, uncommon: 26, rare: 28, epic: 19, legendary: 7.5, mythic: 1.5 },
        palette: { sky: [0x27384f, 0x7f9fc2], water: [0x123a52, 0x061b2c], fog: 0x9fc2df, accent: 0x9affea },
        props: ['ice', 'aurora', 'rocks']
    },
    {
        id: 'volcano', name: 'Volcanic Island', order: 7, unlockLevel: 32, travelCost: 250000,
        ambience: 'volcano', difficultyMod: 2.75, valueMult: 7.5,
        description: 'Black sand and rivers of lava light the water an angry orange.',
        rarityWeights: { common: 10, uncommon: 22, rare: 27, epic: 25, legendary: 13, mythic: 3 },
        palette: { sky: [0x3a1f1a, 0xaa5030], water: [0x3a1810, 0x160705], fog: 0xff8a4a, accent: 0xff5a1a },
        props: ['lava', 'rocks']
    },
    {
        id: 'abyss', name: 'Midnight Abyss', order: 8, unlockLevel: 40, travelCost: 600000,
        ambience: 'abyss', difficultyMod: 3.4, valueMult: 11,
        description: 'Sunless water where the only light is what swims in it. Legends live here.',
        rarityWeights: { common: 4, uncommon: 14, rare: 24, epic: 28, legendary: 22, mythic: 8 },
        palette: { sky: [0x03040a, 0x0c1730], water: [0x040a1a, 0x01030a], fog: 0x1a2a4a, accent: 0x6affe0 },
        props: ['stars', 'rocks']
    }
];

export function getLocation(id: string): LocationDef {
    const loc = LOCATIONS.find(l => l.id === id);
    if (!loc) throw new Error(`Unknown location: ${id}`);
    return loc;
}

export function locationsUpTo(order: number): LocationDef[] {
    return LOCATIONS.filter(l => l.order <= order);
}
