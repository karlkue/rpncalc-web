const assert = require('assert');
const { chromium } = require('playwright-core');
const path = require('path');

const ARTIFACT_DIR = '/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/b932af31-10d7-4086-b681-2f570be8c9c4';
const URL = process.env.TEST_URL || 'http://localhost:8080';

async function runE2E() {
    const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(URL, { waitUntil: 'networkidle' });

    // 1. Test "1 + on empty stack" preserves "1" in display
    await page.click('.keypad-adaptive .btn[data-val="1"]');
    await page.click('.keypad-adaptive .btn[data-op="ADD"]');
    const displayAfterEmptyAdd = await page.inputValue('#display');
    assert.strictEqual(displayAfterEmptyAdd, '1', 'Empty stack + 1 should preserve 1 in display');
    console.log('✓ 1. Empty stack "1 +" preserves entry');

    // Clear entry
    await page.click('.keypad-adaptive .btn[data-action="clr"]');

    // 2. Test "1 Enter 1 -" = 0
    await page.click('.keypad-adaptive .btn[data-val="1"]');
    await page.click('.keypad-adaptive .btn[data-action="enter"]');
    await page.click('.keypad-adaptive .btn[data-val="1"]');
    await page.click('.keypad-adaptive .btn[data-op="SUB"]');
    const stackText = await page.textContent('#stackContainer');
    assert.ok(stackText.includes('0'), '1 Enter 1 - should result in 0 on stack');
    console.log('✓ 2. "1 Enter 1 -" = 0');

    // 3. Test "5 Enter 0 ÷" preserves 0 in display
    await page.click('.keypad-adaptive .btn[data-action="cla"]');
    await page.click('.keypad-adaptive .btn[data-val="5"]');
    await page.click('.keypad-adaptive .btn[data-action="enter"]');
    await page.click('.keypad-adaptive .btn[data-val="0"]');
    await page.click('.keypad-adaptive .btn[data-op="DIV"]');
    const displayAfterDivZero = await page.inputValue('#display');
    assert.strictEqual(displayAfterDivZero, '0', '5 Enter 0 ÷ should preserve 0 in display');
    console.log('✓ 3. "5 Enter 0 ÷" preserves entry');

    // 4. Test in-place CHS (±) on entry
    await page.click('.keypad-adaptive .btn[data-action="clr"]');
    await page.click('.keypad-adaptive .btn[data-val="1"]');
    await page.click('.keypad-adaptive .btn[data-val="2"]');
    await page.click('.keypad-adaptive .btn[data-op="NEG"]');
    assert.strictEqual(await page.inputValue('#display'), '-12', '± should negate entry in-place');
    console.log('✓ 4. In-place CHS (±) on entry');

    // 5. Check no horizontal overflow & capture screenshots across viewports
    const viewports = [
        { name: 'mobile-390', width: 390, height: 844 },
        { name: 'pixel-412', width: 412, height: 915 },
        { name: 'landscape-844', width: 844, height: 390 },
        { name: 'desktop-1440', width: 1440, height: 900 }
    ];

    for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(150);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        assert.strictEqual(overflow, false, `Horizontal overflow detected at ${vp.name}`);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `${vp.name}.png`) });
        console.log(`✓ 5. Viewport ${vp.name} (${vp.width}x${vp.height}) — no overflow, screenshot saved`);
    }

    assert.strictEqual(errors.length, 0, `Uncaught page errors: ${errors.join('; ')}`);
    await browser.close();
    console.log('\nALL E2E TESTS PASSED!');
}

runE2E().catch((err) => {
    console.error('E2E FAILED:', err);
    process.exit(1);
});
