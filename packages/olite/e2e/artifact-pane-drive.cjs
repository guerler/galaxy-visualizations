// The chat/artifact split must be adjustable: drag, toggle, shortcut, and a narrow
// window must collapse the pane without overwriting the stored preference.
const { chromium } = require("playwright");
const APP = process.env.APP_URL || "http://localhost:4173/";

const results = [];
function check(name, ok, detail) {
    results.push({ name, ok });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}
const collapsed = (p) => p.evaluate(() => document.body.classList.contains("artifact-collapsed"));
const stored = (p) => p.evaluate(() => localStorage.getItem("olite.artifactCollapsed"));

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.goto(APP);
    await page.waitForSelector("#cred-overlay:not(.hidden)", { timeout: 20000 });
    await page.selectOption("#cred-provider", "openrouter");
    await page.fill("#cred-key", "demo");
    await page.click("#cred-save");
    await page.waitForFunction(() => (document.querySelector("#model-btn")?.textContent||"").includes("·"));

    check("starts collapsed", await collapsed(page));

    await page.click("#artifact-btn");
    check("toggle button expands", !(await collapsed(page)));
    check("expansion is persisted", (await stored(page)) === "0");

    await page.click("#artifact-btn");
    check("toggle button collapses again", await collapsed(page));

    await page.keyboard.press("Control+\\");
    check("Ctrl+\\ toggles", !(await collapsed(page)));

    // Drag the divider; the chat pane's flex basis should change and stay clamped.
    const before = await page.evaluate(() => document.querySelector("#chat-pane").style.flex || "");
    const box = await page.locator("#divider").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(300, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    const after = await page.evaluate(() => document.querySelector("#chat-pane").style.flex || "");
    check("divider drag resizes the chat pane", after !== before && after.includes("%"), `${before || "(none)"} -> ${after}`);

    const pct = parseFloat(after.match(/([\d.]+)%/)[1]);
    check("drag is clamped to 25-75%", pct >= 25 && pct <= 75, `${pct.toFixed(1)}%`);

    // The clamp alone would pass even if the maths were wrong, so drag to a middle
    // position and check the pane actually tracks the pointer.
    const box2 = await page.locator("#divider").boundingBox();
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
    await page.mouse.down();
    await page.mouse.move(720, box2.y + box2.height / 2, { steps: 8 });
    await page.mouse.up();
    const mid = parseFloat(
        (await page.evaluate(() => document.querySelector("#chat-pane").style.flex)).match(/([\d.]+)%/)[1]);
    check("drag tracks the pointer between the clamps", mid > 50 && mid < 70, `${mid.toFixed(1)}% for x=720 of 1200`);

    check("drag releases the cursor and text selection",
        await page.evaluate(() => !document.body.style.cursor && !document.body.style.userSelect));

    // Narrow the window: collapses visually, must not rewrite the preference.
    const prefBefore = await stored(page);
    await page.setViewportSize({ width: 600, height: 800 });
    await page.waitForTimeout(300);
    check("narrow window collapses the pane", await collapsed(page));
    check("narrow window leaves the preference alone", (await stored(page)) === prefBefore,
        `${prefBefore} -> ${await stored(page)}`);

    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(300);
    check("widening restores the stored preference", !(await collapsed(page)));

    await browser.close();
    const failed = results.filter(r => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
