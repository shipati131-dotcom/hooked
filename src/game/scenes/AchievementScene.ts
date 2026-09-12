import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '../constants';
import { getServices } from '../core/services';
import { listen } from '../core/listen';
import { EVENTS } from '../core/events';
import { buildSheet } from '../ui/Sheet';
import { ScrollList } from '../ui/ScrollList';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { COLORS } from '../ui/theme';
import { ACHIEVEMENTS } from '../data/achievements';
import { BALANCE } from '../data/balance';
import { formatCoins, padTime } from '../utils/format';

type Tab = 'achievements' | 'challenges' | 'stats';

export class AchievementScene extends Phaser.Scene {
    private list!: ScrollList;
    private tabButtons: Phaser.GameObjects.Container[] = [];
    private activeTab: Tab = 'challenges';

    constructor() { super(SCENE_KEYS.ACHIEVEMENT); }

    create(): void {
        // Phaser reuses this same Scene instance every time it's relaunched (it
        // isn't recreated from scratch), but `create()` runs fresh each time --
        // without resetting this array, every reopen pushed 3 more button
        // references onto it while the previous ones were already destroyed by
        // the prior shutdown. rebuild() then iterated those dead containers and
        // crashed on `.list[0].clear()`, which froze the whole game (an
        // uncaught exception inside Phaser's scene-boot step halts its loop).
        this.tabButtons = [];
        const services = getServices(this);
        const sheet = buildSheet(this, 'Achievements & Challenges', () => this.close());
        const left = GAME_WIDTH / 2 - sheet.width / 2;
        const top = GAME_HEIGHT / 2 - sheet.height / 2;

        const tabs: { key: Tab; label: string }[] = [
            { key: 'challenges', label: 'Challenges' },
            { key: 'achievements', label: 'Achievements' },
            { key: 'stats', label: 'Stats' }
        ];
        tabs.forEach((tab, i) => {
            const btn = this.add.container(left + 130 + i * 200, top + 130);
            const bg = this.add.graphics();
            const label = this.add.text(0, 0, tab.label, { fontFamily: 'Fredoka, sans-serif', fontSize: '18px', color: '#f4e8cf', fontStyle: '700' }).setOrigin(0.5);
            btn.add([bg, label]);
            btn.setSize(180, 44).setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => { this.activeTab = tab.key; this.rebuild(services); });
            sheet.content.add(btn);
            this.tabButtons.push(btn);
        });

        this.list = new ScrollList(this, left + 40, top + 170, sheet.width - 80, sheet.height - 210);
        sheet.content.add(this.list);

        this.rebuild(services);

        listen(this, services.bus, EVENTS.ACHIEVEMENT_UNLOCKED, () => this.rebuild(services));
        listen(this, services.bus, EVENTS.CHALLENGE_COMPLETED, () => this.rebuild(services));
        listen(this, services.bus, EVENTS.CATCH, () => this.rebuild(services));
    }

    private rebuild(services: ReturnType<typeof getServices>): void {
        const tabs: Tab[] = ['challenges', 'achievements', 'stats'];
        this.tabButtons.forEach((btn, i) => {
            const active = tabs[i] === this.activeTab;
            const bg = btn.list[0] as Phaser.GameObjects.Graphics;
            bg.clear();
            bg.fillStyle(active ? COLORS.gold : 0x16333f, active ? 1 : 0.6);
            bg.fillRoundedRect(-90, -22, 180, 44, 12);
            (btn.list[1] as Phaser.GameObjects.Text).setColor(active ? '#17252b' : '#f4e8cf');
        });

        if (this.activeTab === 'challenges') this.buildChallenges(services);
        else if (this.activeTab === 'achievements') this.buildAchievements(services);
        else this.buildStats(services);
    }

    private buildChallenges(services: ReturnType<typeof getServices>): void {
        const rowH = 110;
        const active = services.challenges.active();
        const items = active.map((c, i) => {
            const cont = this.add.container(0, i * rowH);
            const w = GAME_WIDTH - 200 - 80;
            const bg = this.add.graphics();
            bg.fillStyle(0x0d232c, 0.5);
            bg.fillRoundedRect(0, 6, w, 92, 14);
            const desc = this.add.text(28, 22, c.description, { fontFamily: 'Fredoka, sans-serif', fontSize: '20px', color: '#f4e8cf', fontStyle: '700' });
            const reward = this.add.text(28, 54, `Reward: ${formatCoins(c.rewardCoins)} coins  •  ${c.rewardXp} XP`, { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#5ecdbd', fontStyle: '800' });
            const bar = new ProgressBar(this, 28, 78, { width: 340, height: 12, fillColor: COLORS.accent });
            bar.setValueImmediate(Math.min(1, c.progress / c.target));
            const progressLabel = this.add.text(28 + 340 + 12, 72, `${Math.min(c.progress, c.target)}/${c.target}`, { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#d8c9a3', fontStyle: '800' });
            const affordable = services.economy.canAfford(BALANCE.challenges.rerollCost);
            const reroll = new Button(this, w - 110, 50, `REROLL ${BALANCE.challenges.rerollCost}`, () => {
                if (services.challenges.reroll(c.id, p => services.economy.spend(p))) { services.audio.play('click'); services.requestSave(); this.rebuild(services); }
            }, { width: 170, height: 44, fontSize: 13, color: affordable ? COLORS.muted : 0x3a4a4e, disabled: !affordable });
            cont.add([bg, desc, reward, bar, progressLabel, reroll]);
            return cont;
        });
        this.list.setContent(items, active.length * rowH);
    }

    private buildAchievements(services: ReturnType<typeof getServices>): void {
        const rowH = 90;
        const sorted = [...ACHIEVEMENTS].sort((a, b) => {
            const ua = services.achievements.isUnlocked(a.id) ? 1 : 0;
            const ub = services.achievements.isUnlocked(b.id) ? 1 : 0;
            return ua - ub;
        });
        const items = sorted.map((a, i) => {
            const unlocked = services.achievements.isUnlocked(a.id);
            const cont = this.add.container(0, i * rowH);
            const w = GAME_WIDTH - 200 - 80;
            const bg = this.add.graphics();
            bg.fillStyle(0x0d232c, unlocked ? 0.5 : 0.25);
            bg.fillRoundedRect(0, 4, w, 74, 12);
            const bar = this.add.rectangle(0, 41, 8, 66, unlocked ? COLORS.gold : 0x3a4a4e).setOrigin(0, 0.5);
            const name = this.add.text(28, 16, a.name, { fontFamily: 'Fredoka, sans-serif', fontSize: '19px', color: unlocked ? '#f4e8cf' : '#7a8a90', fontStyle: '700' });
            const desc = this.add.text(28, 44, a.description, { fontFamily: 'Nunito, sans-serif', fontSize: '13px', color: '#b3a488', fontStyle: '800' });
            const reward = this.add.text(w - 180, 41, unlocked ? 'UNLOCKED' : `+${formatCoins(a.rewardCoins)}`, {
                fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: unlocked ? '#e7b94f' : '#d8c9a3', fontStyle: '800'
            }).setOrigin(0, 0.5);
            cont.add([bg, bar, name, desc, reward]);
            return cont;
        });
        this.list.setContent(items, sorted.length * rowH);
    }

    private buildStats(services: ReturnType<typeof getServices>): void {
        const s = services.save.stats;
        const favorite = services.stats.favoriteSpecies();
        const rows: [string, string][] = [
            ['Total fish caught', s.totalCaught.toString()],
            ['Total fish escaped', s.totalEscaped.toString()],
            ['Total weight caught', `${s.totalWeightKg.toFixed(1)} kg`],
            ['Biggest fish', s.biggestFishId ? `${s.biggestFishId} (${s.biggestFishKg.toFixed(2)} kg)` : '—'],
            ['Total coins earned', formatCoins(s.totalCoinsEarned)],
            ['Legendary catches', s.legendaryCaught.toString()],
            ['Mythic catches', s.mythicCaught.toString()],
            ['Perfect catches', s.perfectCatches.toString()],
            ['Best catch streak', s.bestCatchStreak.toString()],
            ['Favorite fish', favorite ?? '—'],
            ['Cast attempts', s.castAttempts.toString()],
            ['Playtime', padTime(s.playtimeMs / 1000)]
        ];
        const rowH = 46;
        const items = rows.map(([label, value], i) => {
            const cont = this.add.container(0, i * rowH);
            const l = this.add.text(20, 0, label, { fontFamily: 'Nunito, sans-serif', fontSize: '16px', color: '#b3a488', fontStyle: '800' });
            const v = this.add.text(500, 0, value, { fontFamily: 'Fredoka, sans-serif', fontSize: '18px', color: '#f4e8cf', fontStyle: '700' });
            cont.add([l, v]);
            return cont;
        });
        this.list.setContent(items, rows.length * rowH);
    }

    private close(): void {
        this.scene.stop();
        this.scene.resume(SCENE_KEYS.FISHING);
    }
}
