export function formatCoins(n: number): string {
    const v = Math.round(n);
    if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(v % 1_000_000_000 === 0 ? 0 : 1) + 'B';
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1) + 'M';
    if (v >= 10_000) return (v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1) + 'K';
    return v.toLocaleString('en-US');
}

export function formatWeight(kg: number): string {
    return `${kg.toFixed(2)} kg`;
}

export function formatWeightShort(kg: number): string {
    return kg >= 10 ? `${kg.toFixed(1)} kg` : `${kg.toFixed(2)} kg`;
}

export function padTime(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const two = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

export function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}
