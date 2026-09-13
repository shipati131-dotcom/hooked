import type { EquipmentDef, RodStats, ReelStats, LineStats, BaitStats, BobberStats, HookStats } from './types';

export const RODS: EquipmentDef[] = [
    { id: 'rod-old', category: 'rod', name: 'Old Rod', description: 'A hand-me-down rod. It works, mostly.', price: 0, unlockLevel: 1, tier: 1, stats: { control: 0, power: 1.0, rareLuck: 0, flex: 0.15 } as RodStats },
    { id: 'rod-fiberglass', category: 'rod', name: 'Fiberglass Rod', description: 'Flexes to soak up sudden runs -- very forgiving in a fight.', price: 250, unlockLevel: 2, tier: 2, stats: { control: 3, power: 1.25, rareLuck: 0.05, flex: 0.55 } as RodStats },
    { id: 'rod-carbon', category: 'rod', name: 'Carbon Rod', description: 'Stiff and sensitive -- hits harder, but bursts land at full force.', price: 2200, unlockLevel: 6, tier: 3, stats: { control: 7, power: 1.6, rareLuck: 0.12, flex: 0.25 } as RodStats },
    { id: 'rod-pro', category: 'rod', name: 'Pro Angler Rod', description: 'Tournament-grade gear with real bite feedback.', price: 12000, unlockLevel: 12, tier: 4, stats: { control: 12, power: 2.1, rareLuck: 0.22, flex: 0.4 } as RodStats },
    { id: 'rod-deepsea', category: 'rod', name: 'Deep Sea Rod', description: 'Built to handle open-ocean monsters and their bursts.', price: 60000, unlockLevel: 20, tier: 5, stats: { control: 17, power: 2.8, rareLuck: 0.35, flex: 0.5 } as RodStats },
    { id: 'rod-legendary', category: 'rod', name: 'Legendary Rod', description: 'Said to have never lost a fish.', price: 400000, unlockLevel: 35, tier: 6, stats: { control: 24, power: 3.6, rareLuck: 0.55, flex: 0.65 } as RodStats }
];

export const REELS: EquipmentDef[] = [
    { id: 'reel-basic', category: 'reel', name: 'Basic Reel', description: 'Gets the job done, slowly.', price: 0, unlockLevel: 1, tier: 1, stats: { captureSpeed: 1.0, tensionResist: 1.0 } as ReelStats },
    { id: 'reel-smooth', category: 'reel', name: 'Smooth-Drag Reel', description: 'Turns faster without losing control.', price: 300, unlockLevel: 3, tier: 2, stats: { captureSpeed: 1.2, tensionResist: 1.1 } as ReelStats },
    { id: 'reel-sport', category: 'reel', name: 'Sport Reel', description: 'A balanced reel built for active fights.', price: 3000, unlockLevel: 8, tier: 3, stats: { captureSpeed: 1.45, tensionResist: 1.25 } as ReelStats },
    { id: 'reel-tourney', category: 'reel', name: 'Tournament Reel', description: 'Precision gearing for serious anglers.', price: 15000, unlockLevel: 15, tier: 4, stats: { captureSpeed: 1.75, tensionResist: 1.45 } as ReelStats },
    { id: 'reel-abyssal', category: 'reel', name: 'Abyssal Reel', description: 'Engineered to haul up the deep-water giants.', price: 90000, unlockLevel: 26, tier: 5, stats: { captureSpeed: 2.15, tensionResist: 1.75 } as ReelStats }
];

export const LINES: EquipmentDef[] = [
    { id: 'line-cotton', category: 'line', name: 'Cotton Line', description: 'Cheap, and it shows.', price: 0, unlockLevel: 1, tier: 1, stats: { maxTension: 15, snapResist: 1.0, color: 0xf0f0e0 } as LineStats },
    { id: 'line-nylon', category: 'line', name: 'Nylon Line', description: 'A reliable everyday line.', price: 200, unlockLevel: 2, tier: 2, stats: { maxTension: 35, snapResist: 1.1, color: 0xe0e8f0 } as LineStats },
    { id: 'line-braided', category: 'line', name: 'Braided Line', description: 'Thin, strong, and nearly invisible.', price: 2500, unlockLevel: 9, tier: 3, stats: { maxTension: 80, snapResist: 1.25, color: 0xb9d9e0 } as LineStats },
    { id: 'line-fluoro', category: 'line', name: 'Fluorocarbon Line', description: 'Premium line built for the biggest fights.', price: 18000, unlockLevel: 17, tier: 4, stats: { maxTension: 160, snapResist: 1.5, color: 0x9adfe8 } as LineStats },
    { id: 'line-titan', category: 'line', name: 'Titanium-Core Line', description: 'Nothing snaps this line. Nothing.', price: 120000, unlockLevel: 28, tier: 5, stats: { maxTension: 350, snapResist: 1.8, color: 0xd8e8ff } as LineStats }
];

export const BAITS: EquipmentDef[] = [
    { id: 'bait-bread', category: 'bait', name: 'Bread', description: 'Simple, cheap, works on almost anything small.', price: 0, unlockLevel: 1, tier: 1, stats: { biteSpeed: 1.0, rarityLuck: 0, habitatAffinity: { fresh: 1.0 } } as BaitStats },
    { id: 'bait-worms', category: 'bait', name: 'Worms', description: 'A classic. Fish can\'t resist them.', price: 150, unlockLevel: 2, tier: 2, stats: { biteSpeed: 1.2, rarityLuck: 0.04, habitatAffinity: { fresh: 1.15 } } as BaitStats },
    { id: 'bait-crickets', category: 'bait', name: 'Crickets', description: 'Lively bait that draws faster strikes.', price: 900, unlockLevel: 5, tier: 3, stats: { biteSpeed: 1.4, rarityLuck: 0.08, habitatAffinity: { fresh: 1.25, ice: 1.1 } } as BaitStats },
    { id: 'bait-shrimp', category: 'bait', name: 'Shrimp', description: 'Salt-water favorite, irresistible on the coast.', price: 4000, unlockLevel: 11, tier: 4, stats: { biteSpeed: 1.35, rarityLuck: 0.1, habitatAffinity: { salt: 1.3, fresh: 1.0 } } as BaitStats },
    { id: 'bait-squid', category: 'bait', name: 'Squid', description: 'Strong scent that pulls in deep-water hunters.', price: 20000, unlockLevel: 19, tier: 5, stats: { biteSpeed: 1.3, rarityLuck: 0.16, habitatAffinity: { salt: 1.35, abyss: 1.2, lava: 1.1 } } as BaitStats },
    { id: 'bait-glowworm', category: 'bait', name: 'Glowworm', description: 'A faint glow that draws curious eyes from the dark.', price: 80000, unlockLevel: 27, tier: 6, stats: { biteSpeed: 1.25, rarityLuck: 0.24, habitatAffinity: { ice: 1.25, abyss: 1.3, lava: 1.2 } } as BaitStats },
    { id: 'bait-mythic', category: 'bait', name: 'Mythic Lure', description: 'Legends say it was carved from a scale of something ancient.', price: 350000, unlockLevel: 38, tier: 7, stats: { biteSpeed: 1.15, rarityLuck: 0.4, habitatAffinity: { fresh: 1.1, salt: 1.1, ice: 1.1, lava: 1.1, abyss: 1.15 } } as BaitStats }
];

export const BOBBERS: EquipmentDef[] = [
    { id: 'bobber-red', category: 'bobber', name: 'Classic Red & White', description: 'The one everyone recognizes.', price: 0, unlockLevel: 1, tier: 1, stats: { skinColor: 0xd94a3a } as BobberStats },
    { id: 'bobber-yellow', category: 'bobber', name: 'Sunshine Bobber', description: 'Easy to spot on a bright day.', price: 100, unlockLevel: 3, tier: 2, stats: { skinColor: 0xf0c93d } as BobberStats },
    { id: 'bobber-green', category: 'bobber', name: 'Forest Bobber', description: 'Blends right into the reeds.', price: 500, unlockLevel: 7, tier: 3, stats: { skinColor: 0x4a9a4a } as BobberStats },
    { id: 'bobber-glow', category: 'bobber', name: 'Glow Bobber', description: 'Lights up faintly at dusk.', price: 3000, unlockLevel: 13, tier: 4, stats: { skinColor: 0x4affea } as BobberStats },
    { id: 'bobber-gold', category: 'bobber', name: 'Golden Bobber', description: 'A little flashy, honestly.', price: 15000, unlockLevel: 22, tier: 5, stats: { skinColor: 0xf7d585 } as BobberStats },
    { id: 'bobber-mythic', category: 'bobber', name: 'Starlight Bobber', description: 'Reserved for anglers who\'ve truly earned it.', price: 100000, unlockLevel: 40, tier: 6, stats: { skinColor: 0xea4cff } as BobberStats }
];

export const HOOKS: EquipmentDef[] = [
    { id: 'hook-rusty', category: 'hook', name: 'Rusty J-Hook', description: 'It\'ll do.', price: 0, unlockLevel: 1, tier: 1, stats: { windowMult: 1.0, directionForgiveness: 0, holdStrength: 0 } as HookStats },
    { id: 'hook-circle', category: 'hook', name: 'Circle Hook', description: 'Sets itself more often -- a wider, more forgiving strike window.', price: 350, unlockLevel: 3, tier: 2, stats: { windowMult: 1.15, directionForgiveness: 0.2, holdStrength: 0.15 } as HookStats },
    { id: 'hook-offset', category: 'hook', name: 'Offset Hook', description: 'Bites down harder once set -- holds through jumps and slack.', price: 2800, unlockLevel: 8, tier: 3, stats: { windowMult: 1.25, directionForgiveness: 0.35, holdStrength: 0.3 } as HookStats },
    { id: 'hook-treble', category: 'hook', name: 'Treble Hook', description: 'Three points -- forgives a wrong strike more often.', price: 16000, unlockLevel: 15, tier: 4, stats: { windowMult: 1.35, directionForgiveness: 0.5, holdStrength: 0.5 } as HookStats },
    { id: 'hook-barbed', category: 'hook', name: 'Barbed Tournament Hook', description: 'Competition-grade -- barely ever throws.', price: 70000, unlockLevel: 24, tier: 5, stats: { windowMult: 1.45, directionForgiveness: 0.65, holdStrength: 0.7 } as HookStats },
    { id: 'hook-leviathan', category: 'hook', name: 'Leviathan Gaff Hook', description: 'Built for things that shouldn\'t exist. It does not let go.', price: 380000, unlockLevel: 36, tier: 6, stats: { windowMult: 1.6, directionForgiveness: 0.8, holdStrength: 0.85 } as HookStats }
];

export const ALL_EQUIPMENT: EquipmentDef[] = [...RODS, ...REELS, ...LINES, ...BAITS, ...BOBBERS, ...HOOKS];

export function getEquipment(id: string): EquipmentDef {
    const e = ALL_EQUIPMENT.find(x => x.id === id);
    if (!e) throw new Error(`Unknown equipment: ${id}`);
    return e;
}

export const DEFAULT_EQUIPPED = {
    rod: 'rod-old',
    reel: 'reel-basic',
    line: 'line-cotton',
    bait: 'bait-bread',
    bobber: 'bobber-red',
    hook: 'hook-rusty'
};
