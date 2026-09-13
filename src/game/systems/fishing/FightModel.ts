import { BALANCE } from '../../data/balance';
import { clamp } from '../../utils/format';
import { Rng, rng as defaultRng } from '../../utils/rng';
import type { FightProfile, HookStats, LineStats, ReelStats, RodStats, MoveId } from '../../data/types';
import { MOVES } from './fightMoves';

export type FightResult = 'none' | 'landed' | 'lineSnapped' | 'hookThrown' | 'slackEscape';
export type MovePhase = 'telegraph' | 'active' | 'cooldown';
export type FightAction = 'pull' | 'release';
export interface FightGear { rod: RodStats; reel: ReelStats; line: LineStats; hook: HookStats; }
export interface FightOptions { startingStaminaFrac?: number; hookThrowRiskBonus?: number; }
export interface FightSnapshot {
    tension: number;
    tensionZone: 'safe' | 'power' | 'redline';
    staminaFrac: number;
    distance: number;
    lateralPos: number;
    runDir: number;
    move: MoveId;
    movePhase: MovePhase;
    moveLabel: string;
    telegraphDir: number;
    airborne: boolean;
    snapGraceFrac: number;
    slackFrac: number;
    phaseIndex: number;
    phaseAnnouncing: boolean;
    phaseLabel: string;
    everRedlined: boolean;
    elapsedSec: number;
    result: FightResult;
    requiredAction: FightAction;
    nextActionIn: number;
    actionDuration: number;
    reactionGraceRemaining: number;
    escapeRisk: number;
    holding: boolean;
    feedback: 'pulling' | 'safe-release' | 'wrong-pull' | 'missed-pull' | 'ready';
    successfulReleases: number;
}

/** One button, two readable windows. Only mistakes give the fish ground.
 * Moves change the animation and cadence, never the meaning of the cue.
 * The pure simulation is shared by the scene and deterministic balance tests. */
export class FightModel {
    private tension = 0;
    private staminaFrac: number;
    private distance = 0.82;
    private lateralPos = 0;
    private escapeRisk = 0;
    private everRedlined = false;
    private mistakeSeconds = 0;
    private elapsedSec = 0;
    private result: FightResult = 'none';
    private move: MoveId = 'cruise';
    private movePhase: MovePhase = 'active';
    private action: FightAction = 'pull';
    private actionElapsed = 0;
    private actionDuration = 2.4;
    private telegraphDuration = 0;
    private runDir = 1;
    private holding = false;
    private feedback: FightSnapshot['feedback'] = 'ready';
    private pullGain = 0;
    private releaseCorrectSec = 0;
    private successfulReleases = 0;
    private phaseIndex = 0;
    private phaseAnnounceTimer = 0;
    private phaseLabel = '';
    private aggression: number;
    private unlockedMoves: Set<MoveId>;

    constructor(private profile: FightProfile, private gear: FightGear, private fishWeightKg: number,
        private options: FightOptions = {}, private r: Rng = defaultRng) {
        this.staminaFrac = clamp(options.startingStaminaFrac ?? 1, 0, 1);
        this.aggression = profile.aggression;
        this.unlockedMoves = new Set(profile.moves);
        this.beginAction('pull');
    }

    private grace(): number {
        return clamp(0.32 - this.aggression * 0.10 + this.gear.rod.control * 0.25, 0.22, 0.48);
    }

    update(dtSec: number, holding: boolean, _steer = 0): void {
        // A stalled/background frame cannot consume a whole reaction window
        // before the new cue is drawn. Normal frames use identical substeps.
        let remaining = clamp(dtSec, 0, 0.25);
        while (remaining > 0.000001 && !this.isDone()) {
            const step = Math.min(remaining, 1 / 60);
            this.step(step, holding);
            remaining -= step;
        }
    }

    private step(dt: number, holding: boolean): void {
        this.elapsedSec += dt;
        this.holding = holding;
        this.phaseAnnounceTimer = Math.max(0, this.phaseAnnounceTimer - dt);
        this.actionElapsed += dt;
        if (this.actionElapsed >= this.actionDuration) {
            if (this.action === 'release' && this.releaseCorrectSec >= (this.actionDuration - this.grace()) * 0.65) {
                this.successfulReleases++;
            }
            this.beginAction(this.action === 'pull' ? 'release' : 'pull');
        }
        this.movePhase = this.action === 'release' && this.actionElapsed < this.telegraphDuration ? 'telegraph' : 'active';
        const correct = holding === (this.action === 'pull');
        const grace = this.actionElapsed < this.grace();
        const load = clamp(this.fishWeightKg / Math.max(1, this.gear.line.maxTension), 0, 3);
        const protection = clamp(1 + this.gear.rod.flex * 0.3 + (this.gear.reel.tensionResist - 1) * 0.2
            + (this.gear.line.snapResist - 1) * 0.2 + this.gear.hook.holdStrength * 0.2, 1, 1.8);
        const difficulty = clamp(0.8 + this.profile.stamina * 0.55 + this.profile.strength * 0.18, 1, 2.5);

        if (correct) {
            this.feedback = holding ? 'pulling' : 'safe-release';
            this.escapeRisk = Math.max(0, this.escapeRisk - dt * 0.035);
            if (holding) {
                const speed = 0.15 * Math.pow(this.gear.reel.captureSpeed * this.gear.rod.power, 0.45) / difficulty;
                // Elite gear must still play through the release windows.
                const gain = Math.min(speed * dt, Math.max(0, 0.27 - this.pullGain));
                this.pullGain += gain;
                this.distance = Math.max(0, this.distance - gain);
                this.staminaFrac = Math.max(0, this.staminaFrac - gain / 0.82);
            } else {
                this.releaseCorrectSec += dt;
            }
        } else if (!grace) {
            this.feedback = holding ? 'wrong-pull' : 'missed-pull';
            this.mistakeSeconds += dt;
            const danger = holding ? (0.38 + this.aggression * 0.12 + load * 0.035) / protection
                : 0.29 / (1 + this.gear.hook.holdStrength * 0.25);
            this.escapeRisk = clamp(this.escapeRisk + danger * dt + (holding ? (this.options.hookThrowRiskBonus ?? 0) * dt * 0.1 : 0), 0, 1);
            this.distance = clamp(this.distance + (holding ? 0.16 : 0.115) * dt, 0, 1.15);
            this.staminaFrac = clamp(this.staminaFrac + this.profile.recoveryRate * dt, 0, 1);
        } else {
            this.feedback = 'ready';
        }

        const targetTension = holding ? (this.action === 'pull' ? 0.48 : grace ? 0.65 : 1.05) : 0.12;
        const rate = holding ? 5 * (1 - this.gear.rod.flex * 0.4) : 7 * this.gear.reel.tensionResist;
        this.tension += (targetTension - this.tension) * Math.min(1, rate * dt);
        if (this.tension > 0.85) this.everRedlined = true;
        const targetX = Math.sin(this.elapsedSec * (this.action === 'release' ? 2.6 : 1.15)) * (this.action === 'release' ? 0.85 : 0.38);
        this.runDir = Math.sign(targetX - this.lateralPos);
        this.lateralPos += (targetX - this.lateralPos) * Math.min(1, dt * 3);
        this.checkPhaseTransition();

        if (this.escapeRisk >= 1) this.result = holding ? 'lineSnapped' : 'slackEscape';
        else if (this.distance <= BALANCE.fight.landedDistanceThreshold && this.successfulReleases > 0) this.result = 'landed';
    }

    private beginAction(action: FightAction): void {
        this.action = action;
        this.actionElapsed = 0;
        this.pullGain = 0;
        this.releaseCorrectSec = 0;
        if (action === 'pull') {
            this.move = this.elapsedSec === 0 ? 'cruise' : 'rest';
            this.telegraphDuration = 0;
            this.actionDuration = this.r.range(2.1, 2.8) * (1 - this.aggression * 0.25);
        } else {
            const offensive = [...this.unlockedMoves].filter(m => m !== 'cruise' && m !== 'rest');
            // Gentle fish also teach release before advanced moves unlock.
            this.move = offensive.length ? this.r.pick(offensive) : 'run';
            const config = MOVES[this.move];
            this.telegraphDuration = Math.max(0.45, config.telegraphSec);
            this.actionDuration = this.telegraphDuration + this.r.range(config.activeSecMin, config.activeSecMax);
        }
        this.movePhase = this.telegraphDuration ? 'telegraph' : 'active';
    }

    private checkPhaseTransition(): void {
        const phase = this.profile.phases?.[this.phaseIndex];
        if (!phase || this.staminaFrac > phase.staminaThreshold) return;
        this.phaseIndex++;
        this.aggression = clamp(this.aggression * phase.aggressionMult, 0, 1);
        phase.addMoves.forEach(move => this.unlockedMoves.add(move));
        this.phaseLabel = phase.label;
        this.phaseAnnounceTimer = 1.2;
    }

    snapshot(): FightSnapshot {
        return {
            tension: clamp(this.tension, 0, 1), tensionZone: this.tension > 0.85 ? 'redline' : this.tension > 0.55 ? 'power' : 'safe',
            staminaFrac: this.staminaFrac, distance: this.distance, lateralPos: this.lateralPos, runDir: this.runDir,
            move: this.move, movePhase: this.movePhase, moveLabel: MOVES[this.move].label, telegraphDir: this.runDir,
            airborne: !!MOVES[this.move].airborne && this.movePhase === 'active',
            snapGraceFrac: this.feedback === 'wrong-pull' ? this.escapeRisk : 0,
            slackFrac: this.feedback === 'missed-pull' ? this.escapeRisk : 0,
            phaseIndex: this.phaseIndex, phaseAnnouncing: this.phaseAnnounceTimer > 0, phaseLabel: this.phaseLabel,
            everRedlined: this.everRedlined, elapsedSec: this.elapsedSec, result: this.result,
            requiredAction: this.action, nextActionIn: Math.max(0, this.actionDuration - this.actionElapsed),
            actionDuration: this.actionDuration, reactionGraceRemaining: Math.max(0, this.grace() - this.actionElapsed),
            escapeRisk: this.escapeRisk, holding: this.holding, feedback: this.feedback, successfulReleases: this.successfulReleases
        };
    }
    isDone(): boolean { return this.result !== 'none'; }
    isPerfect(): boolean { return this.result === 'landed' && this.mistakeSeconds < 0.15; }
}
