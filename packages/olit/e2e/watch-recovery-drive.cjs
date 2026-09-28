// A reload loses the watch list; the transcript it was derived from survives.
//
// Submits a workflow, reloads the page, and asserts the restored session takes the invocation
// back and continues by itself when Galaxy settles it -- with no user message in between.
const { chromium } = require("playwright");

const OUT = process.env.OUT || "/tmp";
const APP = process.env.APP_URL || "http://localhost:5173/";
const STUB = process.env.STUB_URL || "http://127.0.0.1:8099";
const HISTORY = "e2ewatch0001";
const URL = `${APP}?history_id=${HISTORY}`;

let failed = 0;
const check = (name, ok, detail) => {
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

(async () => {
    await fetch(`${STUB}/__script?name=invocation`);
    await fetch(`${STUB}/__invocation?state=new`);

    const browser = await chromium.launch();
    // One context across the reload, so IndexedDB survives it as it would for a user.
    const context = await browser.newContext({ viewport: { width: 1100, height: 700 } });
    const page = await context.newPage();
    const logs = [];
    page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));

    const wait = async (fn, ms) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await page.evaluate(fn)) return true;
            await page.waitForTimeout(500);
        }
        return false;
    };
    const booted = () => wait(() => /olit ready|Resumed this history/i.test(document.body.innerText), 240000);
    const idle = () => wait(() => !document.querySelector("#send-btn").classList.contains("hidden"), 120000);
    const text = () => page.evaluate(() => document.body.innerText);

    await page.goto(URL, { waitUntil: "domcontentloaded" });
    if (!(await booted())) {
        check("booted", false, "never became ready");
        console.log(logs.slice(-15).join("\n"));
        await browser.close();
        process.exit(1);
    }

    await page.fill("#input", "run the workflow");
    await page.click("#send-btn");
    check("the submitting turn completed", await idle());
    const seen = await (await fetch(`${STUB}/__seen`)).json();
    check("the workflow was invoked", seen.seen.some((s) => s.includes("/invocations")),
          seen.seen.slice(-3).join(" | "));

    // The reload is the whole point: a new document, a new worker, an empty watcher.
    await page.reload({ waitUntil: "domcontentloaded" });
    check("resumed after the reload", await booted());
    const recovered = await wait(() => /Watching 1 Galaxy run/i.test(document.body.innerText), 60000);
    check("the invocation is watched again", recovered);
    await page.screenshot({ path: `${OUT}/watch-recovered.png` });

    // Settling it is Galaxy's to do; the restored session has to notice on its own.
    await fetch(`${STUB}/__invocation?state=completed`);
    const settled = await wait(() => /finished \(completed\)/i.test(document.body.innerText), 60000);
    check("the settled run is reported", settled);
    const continued = await wait(
        () => /Checking the Galaxy results that just landed/i.test(document.body.innerText),
        60000,
    );
    check("the agent continued without being asked", continued);
    check("no traceback", !/Traceback|PythonError/.test(await text()));
    await page.screenshot({ path: `${OUT}/watch-continued.png` });

    if (failed) console.log(logs.slice(-20).join("\n"));
    await browser.close();
    process.exit(failed ? 1 : 0);
})();
