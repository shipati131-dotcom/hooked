/** Small seedable PRNG (mulberry32) so gameplay can be deterministic when seeded, and simulations reproducible. */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class Rng {
    private fn: () => number;
    constructor(seed?: number) {
        this.fn = seed !== undefined ? mulberry32(seed) : Math.random;
    }
    next(): number { return this.fn(); }
    range(min: number, max: number): number { return min + this.next() * (max - min); }
    int(min: number, max: number): number { return Math.floor(this.range(min, max + 1)); }
    pick<T>(arr: T[]): T { return arr[this.int(0, arr.length - 1)]; }
    chance(p: number): boolean { return this.next() < p; }
    /** Weighted pick from a list of [item, weight] pairs. */
    weighted<T>(entries: [T, number][]): T {
        const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
        if (total <= 0) return entries[0][0];
        let r = this.next() * total;
        for (const [item, w] of entries) {
            r -= Math.max(0, w);
            if (r <= 0) return item;
        }
        return entries[entries.length - 1][0];
    }
}

export const rng = new Rng();
