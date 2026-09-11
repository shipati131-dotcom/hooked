import type { SaveData } from '../core/GameState';
import { GameBus } from '../core/GameState';
import { EVENTS } from '../core/events';
import { BALANCE } from '../data/balance';
import { CHALLENGE_TEMPLATES } from '../data/challenges';
import type { ActiveChallenge } from '../data/types';
import type { CatchResult } from '../core/events';
import { RARITY_ORDER, RARITY_LABEL, type Rarity } from '../constants';
import { Rng, rng as defaultRng } from '../utils/rng';

/**
 * Rotating short-term challenges. Data-driven so a future DailySource (seeded
 * by date) can slot in beside this without touching consumers.
 */
export class ChallengeSystem {
    constructor(
        private save: SaveData,
        private bus: GameBus,
        private awardCoins: (n: number) => void,
        private awardXp: (n: number) => void,
        private r: Rng = defaultRng
    ) {
        this.ensureFilled();
    }

    private ensureFilled(): void {
        while (this.save.activeChallenges.filter(c => !c.completed).length < BALANCE.challenges.activeSlots) {
            this.save.activeChallenges.push(this.generate());
        }
    }

    private generate(): ActiveChallenge {
        const level = this.save.level;
        const template = this.r.pick(CHALLENGE_TEMPLATES);
        const scale = 1 + level * 0.06;
        const [lo, hi] = template.targetRange;
        const target = Math.max(1, Math.round(this.r.range(lo, hi) * Math.min(3, scale)));
        let extra: string | undefined;
        if (template.goal === 'catchRarityAtLeast') {
            extra = this.r.pick(template.extraPool ?? ['rare']);
        }
        const rewardCoins = Math.round(template.rewardCoinsPer * target * (template.goal === 'earnCoins' ? 1 : 4));
        const rewardXp = Math.round(template.rewardXpPer * target * (template.goal === 'earnCoins' ? 1 : 4));
        const label = extra ? RARITY_LABEL[extra as Rarity] ?? extra : undefined;
        return {
            id: `${template.id}-${Date.now()}-${Math.floor(this.r.next() * 10000)}`,
            templateId: template.id,
            goal: template.goal,
            target,
            progress: 0,
            extra,
            description: template.describe(target, label),
            rewardCoins,
            rewardXp,
            completed: false
        };
    }

    reroll(id: string, spend: (price: number) => boolean): boolean {
        if (!spend(BALANCE.challenges.rerollCost)) return false;
        const idx = this.save.activeChallenges.findIndex(c => c.id === id);
        if (idx === -1) return false;
        this.save.activeChallenges.splice(idx, 1);
        this.ensureFilled();
        this.bus.emit(EVENTS.CHALLENGES_REROLLED, undefined);
        return true;
    }

    /** Update all active challenges against a fresh catch. */
    onCatch(result: CatchResult): void {
        for (const c of this.save.activeChallenges) {
            if (c.completed) continue;
            switch (c.goal) {
                case 'catchAny': c.progress += 1; break;
                case 'catchSpecies': if (c.extra === result.fish.id) c.progress += 1; break;
                case 'catchRarityAtLeast': {
                    const idx = RARITY_ORDER.indexOf(result.fish.rarity);
                    const reqIdx = RARITY_ORDER.indexOf((c.extra as Rarity) ?? 'rare');
                    if (idx >= reqIdx) c.progress += 1;
                    break;
                }
                case 'catchWeightAtLeast': if (result.weight >= c.target) c.progress = c.target; break;
                case 'perfectCatches': if (result.perfect) c.progress += 1; break;
                default: break;
            }
            this.completeIfReady(c);
        }
        this.ensureFilled();
    }

    onCoinsEarned(total: number): void {
        for (const c of this.save.activeChallenges) {
            if (c.completed || c.goal !== 'earnCoins') continue;
            c.progress = total; // absolute-earned tracking simplifies reroll logic
            this.completeIfReady(c);
        }
    }

    private completeIfReady(c: ActiveChallenge): void {
        if (c.completed) return;
        if (c.progress >= c.target) {
            c.completed = true;
            if (c.rewardCoins) this.awardCoins(c.rewardCoins);
            if (c.rewardXp) this.awardXp(c.rewardXp);
            this.bus.emit(EVENTS.CHALLENGE_COMPLETED, { id: c.id });
        }
    }

    active(): ActiveChallenge[] {
        return this.save.activeChallenges.filter(c => !c.completed).slice(0, BALANCE.challenges.activeSlots);
    }
}
