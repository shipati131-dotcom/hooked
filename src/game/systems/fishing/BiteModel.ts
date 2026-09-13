import { BALANCE } from '../../data/balance';
import { Rng, rng as defaultRng } from '../../utils/rng';
import type { BaitStats, BiteStyle, HookStats } from '../../data/types';
import { MECHANIC_UNLOCKS } from '../../data/fishBehaviors';

export type CueKind = 'nibble' | 'tug' | 'drag' | 'falsePlunge' | 'plunge';

export interface CueEvent {
    atMs: number;
    kind: CueKind;
    durationMs: number;
    dir: -1 | 1;
    heavy?: boolean;
}

export type StrikeOutcome = 'solidHook' | 'lightHook' | 'spooked' | 'warned' | 'idleCancel' | 'wrongDirection';

export interface StrikeResult {
    outcome: StrikeOutcome;
    hookThrowRiskBonus: number; // added to the fight's baseline hook-throw chance on the first jump (0 = solid, higher = light)
}

/**
 * Builds and runs a fish's bite-cue script (nibbles/tugs/drags/false plunges,
 * then the real plunge), and resolves the player's strike into a
 * solid/light/spooked/missed hook-set. Pure logic -- see data/fishBehaviors.ts
 * for the per-style cue shapes this reads.
 */
export class BiteModel {
    private r: Rng;
    private script: CueEvent[] = [];
    private cueIndex = 0;
    private elapsedMs = 0;
    private plungeAtMs = 0;
    private strikeWindowStartMs = 0;
    private strikeWindowDurationMs = 0;
    private doublePullFlipMs = 0;
    private requiresDirection: boolean;
    private strikeMade = false;
    private falsePlungeActiveUntilMs = -1;

    constructor(
        private style: BiteStyle,
        private hookDifficulty: number,
        bait: BaitStats,
        private hook: HookStats,
        totalCaught: number,
        r: Rng = defaultRng
    ) {
        this.r = r;
        this.requiresDirection = totalCaught >= MECHANIC_UNLOCKS.steering && hookDifficulty >= 0.35;
        this.buildScript(bait);
    }

    private buildScript(bait: BaitStats): void {
        const c = BALANCE.biteCues;
        const greedy = bait.biteSpeed >= 1.2;
        const dir = (): -1 | 1 => (this.r.chance(0.5) ? 1 : -1);
        const events: CueEvent[] = [];
        let t = 0;

        const addNibbles = (count: number) => {
            for (let i = 0; i < count; i++) {
                t += this.r.range(300, 550);
                events.push({ atMs: t, kind: 'nibble', durationMs: c.nibbleDurationMs, dir: dir() });
            }
        };

        switch (this.style) {
            case 'timid': {
                addNibbles(Math.max(0, this.r.int(2, 4) - (greedy ? 1 : 0)));
                if (this.r.chance(0.4)) { t += 250; events.push({ atMs: t, kind: 'tug', durationMs: c.tugDurationMs, dir: dir() }); }
                t += this.r.range(300, 500);
                break;
            }
            case 'greedy': {
                addNibbles(greedy ? 0 : this.r.chance(0.5) ? 1 : 0);
                t += this.r.range(150, 350);
                break;
            }
            case 'cautious': {
                addNibbles(Math.max(0, this.r.int(1, 2) - (greedy ? 1 : 0)));
                const dragDir = dir();
                t += 200;
                events.push({ atMs: t, kind: 'drag', durationMs: c.dragDurationMs, dir: dragDir });
                t += c.dragDurationMs;
                break;
            }
            case 'runner': {
                if (this.r.chance(0.7)) { t += 150; events.push({ atMs: t, kind: 'tug', durationMs: c.tugDurationMs, dir: dir() }); }
                const runDir = dir();
                const dragStart = t + 200;
                events.push({ atMs: dragStart, kind: 'drag', durationMs: c.dragDurationMs, dir: runDir });
                t = dragStart + c.dragDurationMs * 0.6; // the real plunge cuts the drag short, mid-run
                break;
            }
            case 'trickster': {
                addNibbles(Math.max(0, this.r.int(1, 3) - (greedy ? 1 : 0)));
                if (!greedy || this.r.chance(0.5)) {
                    t += 300;
                    events.push({ atMs: t, kind: 'falsePlunge', durationMs: c.falsePlungeDurationMs, dir: dir() });
                    t += c.falsePlungeDurationMs + 200;
                }
                break;
            }
            case 'ominous': {
                t += this.r.range(800, 1400); // the hush
                const heavyCount = this.r.int(2, 3);
                for (let i = 0; i < heavyCount; i++) {
                    t += this.r.range(350, 550);
                    events.push({ atMs: t, kind: 'tug', durationMs: c.tugDurationMs * 1.4, dir: dir(), heavy: true });
                }
                t += 300;
                break;
            }
        }

        this.plungeAtMs = t;
        events.push({ atMs: t, kind: 'plunge', durationMs: 0, dir: dir(), heavy: this.style === 'ominous' });
        this.script = events;

        const windowMult = this.hook.windowMult * (greedy ? 1.2 : 1);
        this.strikeWindowStartMs = t + c.plungeTelegraphMs;
        this.strikeWindowDurationMs = BALANCE.hookSet.baseWindowMs * windowMult;
        this.doublePullFlipMs = this.strikeWindowStartMs + BALANCE.hookSet.doublePullDelayMs;
    }

    /** Advance time and return any cues that fired since the last call (for the scene to animate). */
    update(dtMs: number): CueEvent[] {
        this.elapsedMs += dtMs;
        const fired: CueEvent[] = [];
        while (this.cueIndex < this.script.length && this.script[this.cueIndex].atMs <= this.elapsedMs) {
            const cue = this.script[this.cueIndex];
            fired.push(cue);
            if (cue.kind === 'falsePlunge') this.falsePlungeActiveUntilMs = this.elapsedMs + cue.durationMs;
            this.cueIndex++;
        }
        if (this.elapsedMs > this.falsePlungeActiveUntilMs) this.falsePlungeActiveUntilMs = -1;
        return fired;
    }

    isRealPlungeFired(): boolean { return this.elapsedMs >= this.plungeAtMs; }
    isInStrikeWindow(): boolean {
        return this.isRealPlungeFired() && this.elapsedMs >= this.strikeWindowStartMs
            && this.elapsedMs < this.strikeWindowStartMs + this.strikeWindowDurationMs && !this.strikeMade;
    }
    hasMissedWindow(): boolean {
        return !this.strikeMade && this.isRealPlungeFired() && this.elapsedMs >= this.strikeWindowStartMs + this.strikeWindowDurationMs;
    }
    private isFalsePlungeActive(): boolean { return this.elapsedMs <= this.falsePlungeActiveUntilMs; }

    /** The direction the fish is currently pulling (for the strike arrow / correctness check). */
    currentPullDir(): -1 | 1 {
        const plunge = this.script[this.script.length - 1];
        if (this.requiresDirection && this.elapsedMs >= this.doublePullFlipMs && this.hookDifficulty >= BALANCE.hookSet.doublePullThreshold) {
            return (plunge.dir * -1) as -1 | 1;
        }
        return plunge.dir;
    }

    /** Player struck (tapped, or swiped in `swipeDir`; null = a plain tap with no drag direction). */
    attemptStrike(swipeDir: -1 | 1 | null, tutorialSpookGraceRemaining: boolean): StrikeResult {
        if (!this.isRealPlungeFired()) {
            if (this.isFalsePlungeActive()) {
                return { outcome: tutorialSpookGraceRemaining ? 'warned' : 'spooked', hookThrowRiskBonus: 0 };
            }
            return { outcome: 'idleCancel', hookThrowRiskBonus: 0 };
        }
        if (!this.isInStrikeWindow()) {
            // Real plunge fired but window already closed, or already struck -- treat as idle/no-op upstream.
            return { outcome: 'idleCancel', hookThrowRiskBonus: 0 };
        }
        this.strikeMade = true;
        const elapsed = this.elapsedMs - this.strikeWindowStartMs;
        const fast = elapsed <= BALANCE.hookSet.solidSpeedMs;
        const required = this.currentPullDir();

        if (!this.requiresDirection) {
            return { outcome: fast ? 'solidHook' : 'lightHook', hookThrowRiskBonus: fast ? 0 : BALANCE.hookSet.lightHookThrowBonus };
        }
        if (swipeDir === null) {
            return { outcome: 'lightHook', hookThrowRiskBonus: BALANCE.hookSet.lightHookThrowBonus };
        }
        if (swipeDir === -required) {
            return { outcome: fast ? 'solidHook' : 'lightHook', hookThrowRiskBonus: fast ? 0 : BALANCE.hookSet.lightHookThrowBonus };
        }
        // Wrong direction: forgiving hooks downgrade this to a light hook instead of losing the fish.
        if (this.r.chance(this.hook.directionForgiveness)) {
            return { outcome: 'lightHook', hookThrowRiskBonus: BALANCE.hookSet.lightHookThrowBonus * 1.5 };
        }
        return { outcome: 'wrongDirection', hookThrowRiskBonus: 0 };
    }

    windowRemainingMs(): number {
        return Math.max(0, this.strikeWindowStartMs + this.strikeWindowDurationMs - this.elapsedMs);
    }
}
