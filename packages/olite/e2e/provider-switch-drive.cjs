// Switching provider after boot must not require clearing browser storage by hand,
// and must not discard the conversation (session memory lives in IndexedDB).
const { chromium } = require("playwright");
const APP = process.env.APP_URL || "http://localhost:4173/";

const results = [];
function check(name, ok, detail) {
    results.push({ name, ok });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(APP);

    await page.waitForSelector("#cred-overlay:not(.hidden)", { timeout: 20000 });
    await page.selectOption("#cred-provider", "openrouter");
    await page.fill("#cred-key", "k1");
    await page.click("#cred-save");
    // The overlay is removed inside the save handler, a tick before main.ts labels
    // the button — so wait for the label, not for the overlay to vanish.
    await page.waitForFunction(
        () => (document.querySelector("#model-btn")?.textContent || "").includes("·"),
        null, { timeout: 10000 });

    const label = await page.textContent("#model-btn");
    check("button names the active provider and model", /openrouter/.test(label), label);

    await page.click("#model-btn");
    await page.waitForSelector("#cred-overlay:not(.hidden)", { timeout: 10000 });
    check("picker reopens without clearing storage", true);
    check("previous provider is preselected",
        (await page.inputValue("#cred-provider")) === "openrouter");

    await page.selectOption("#cred-provider", "deepseek");
    await page.fill("#cred-key", "k2");
    await page.click("#cred-save");
    await page.waitForSelector("#model-btn", { timeout: 20000 });
    await page.waitForFunction(
        () => (document.querySelector("#model-btn")?.textContent || "").includes("deepseek"),
        null, { timeout: 20000 });

    check("switch took effect after reload", true, await page.textContent("#model-btn"));
    const stored = await page.evaluate(() => sessionStorage.getItem("olite.credentials"));
    check("stored credentials replaced", stored.includes("deepseek") && !stored.includes("k1"), stored);
    check("overlay does not reappear once switched",
        await page.evaluate(() => {
            const el = document.querySelector("#cred-overlay");
            return !el || el.classList.contains("hidden");
        }));

    await browser.close();
    const failed = results.filter(r => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
