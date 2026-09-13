import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const out = 'output/pull-release-browser';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const advance = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const click = async (x, y) => {
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.click(box.x + box.width * x / 1600, box.y + box.height * y / 900);
    await advance(34);
};
const shot = name => page.screenshot({ path: out + '/' + name + '.png' });
const clear = async () => { await page.keyboard.up('Space'); await page.mouse.up(); };
const startFight = async () => {
    await clear();
    await click(420, 860);
    await page.keyboard.down('b'); await advance(17); await page.keyboard.up('b');
    assert.equal((await state()).fishingState, 'fighting');
};
function checkLayout(s) {
    const r = s.visuals.rod, h = s.visuals.fightHud, f = s.visuals.fish;
    assert.ok(r.x + r.width < h.x, 'rod must stay outside HUD even at full bend');
    assert.ok(r.y > 110 && r.y + r.height < 820, 'rod clears top HUD and bottom navigation');
    if (f.visible) {
        assert.equal(f.tinted, false, 'fight fish is full color');
        assert.ok(f.y > 110 && f.y + f.height < h.y, 'fish stays inside water lane');
    }
}
try {
    await page.goto('http://127.0.0.1:5174/');
    await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
    await advance(17);
    await click(800, 558);
    assert.ok((await state()).activeScenes.includes('FishingScene'));
    await shot('idle');

    if (!process.argv.includes('--layout-only')) {
    // Ordinary cast, bite, and hook: no encounter shortcut for the first catch.
    await page.keyboard.down('Space'); await advance(600); await page.keyboard.up('Space');
    await advance(550);
    assert.equal((await state()).fishingState, 'waiting');
    for (let i = 0; i < 160 && (await state()).fishingState === 'waiting'; i++) await advance(100);
    for (let i = 0; i < 300; i++) {
        if (await page.evaluate(() => window.__game.scene.getScene('FishingScene').fishing.isInStrikeWindow())) break;
        await advance(25);
    }
    await page.keyboard.down('Space'); await advance(17); await page.keyboard.up('Space');
    assert.equal((await state()).fishingState, 'fighting');
    const early = (await state()).visuals.fish;
    let capturedRelease = false, capturedNear = false, currentHeld = false;
    for (let i = 0; i < 600; i++) {
        const s = await state();
        if (s.fishingState !== 'fighting') break;
        checkLayout(s);
        const shouldHold = s.reel.requiredAction === 'pull';
        if (shouldHold !== currentHeld) {
            await page.keyboard[shouldHold ? 'down' : 'up']('Space'); currentHeld = shouldHold;
        }
        await advance(100);
        const after = await state();
        if (after.fishingState !== 'fighting') break;
        if (!capturedRelease && after.reel.requiredAction === 'release') {
            await shot('release'); capturedRelease = true;
        }
        if (!capturedNear && after.reel.distance < 0.22) {
            assert.ok(after.visuals.fish.y > early.y + 70, 'fish approaches player');
            assert.ok(after.visuals.fish.width > early.width, 'fish grows with perspective');
            await shot('near'); capturedNear = true;
        }
    }
    await clear(); await advance(1700);
    assert.ok((await state()).visuals.resultOpen, 'correct input reaches catch card');
    assert.ok(capturedRelease && capturedNear);
    await shot('catch');
    await click(800, 600);
    assert.equal((await state()).totalCaught, 1, 'catch is awarded once');

    // Mouse input: wrong pull, recovery, safe release, then a missed pull.
    await startFight();
    await page.mouse.move(760, 380); await page.mouse.down();
    for (let i = 0; i < 50 && (await state()).reel.requiredAction === 'pull'; i++) await advance(100);
    const beforeWrong = await state(); await advance(700);
    const wrong = await state();
    assert.ok(wrong.reel.escapeRisk > 0 && wrong.reel.distance > beforeWrong.reel.distance);
    checkLayout(wrong); await shot('wrong-pull');
    await page.mouse.up(); await advance(100);
    assert.equal((await state()).reel.feedback, 'safe-release');
    for (let i = 0; i < 40 && (await state()).reel.requiredAction === 'release'; i++) await advance(50);
    const beforeMiss = await state(); await advance(650);
    const missed = await state();
    assert.ok(missed.reel.escapeRisk > beforeMiss.reel.escapeRisk);
    assert.ok(missed.reel.distance > beforeMiss.reel.distance);
    await shot('missed-pull');

    // Overlay pause must freeze the fight and clear held input on return.
    await page.keyboard.down('Space'); await advance(17);
    await click(610, 860);
    const paused = await state(); await advance(1500);
    assert.equal((await state()).reel.elapsedSec, paused.reel.elapsedSec);
    await page.keyboard.up('Space');
    await click(1456, 123); await advance(34);
    assert.ok((await state()).activeScenes.includes('FishingScene'));
    assert.equal((await state()).reel.holding, false);

    for (const [name, hold] of [['always-pull', true], ['never-pull', false]]) {
        await startFight();
        if (hold) await page.keyboard.down('Space');
        for (let i = 0; i < 600 && (await state()).fishingState === 'fighting'; i++) await advance(100);
        await clear();
        assert.equal((await state()).fishingState, 'idle', name + ' must end');
        assert.equal((await state()).visuals.resultOpen, false, name + ' cannot win');
        await shot(name);
    }

    }
    // Layout at narrower aspect ratios and with every equipped rod frame.
    for (const viewport of [{ width: 1024, height: 768 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport); await advance(50);
        await startFight();
        const rods = await page.evaluate(async () => (await import('/src/game/data/equipment.ts')).RODS.map(rod => rod.id));
        for (const id of rods) {
            await page.evaluate(id => {
                const scene = window.__game.scene.getScene('FishingScene');
                window.__HOOKED__.services.save.equipped.rod = id;
                scene.applyRodSkin();
            }, id);
            await advance(17); checkLayout(await state());
        }
        // Video textures arrive asynchronously, independently of manual time.
        await page.waitForTimeout(700); await advance(34);
        await shot('layout-' + viewport.width);
    }
    assert.deepEqual(errors, []);
    if (!process.argv.includes('--layout-only')) await fs.writeFile(out + '/verification.json', JSON.stringify({ passed: true, checks: ['normal cast and hook', 'keyboard catch and reward', 'color and approach', 'mouse mistakes', 'safe release', 'pause and resume', 'always/never pull escape', 'all six rod bounds', 'three viewport sizes'], errors }, null, 2));
    console.log('Browser fight checks passed. Screenshots: ' + out);
} catch (error) {
    await shot('failure');
    await fs.writeFile(out + '/failure.json', JSON.stringify({ state: await state(), errors }, null, 2));
    throw error;
} finally { await browser.close(); }
