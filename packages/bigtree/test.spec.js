import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TREE = { id: "1", hid: 1, name: "tree", extension: "newick", history_id: "h1" };

function viewerState(page) {
    return page
        .frame({ url: /\/viewer\/index\.html/ })
        ?.evaluate(() => window.__BIG_TREE_VIEWER_APP_TEST__?.getState() ?? null);
}

/** A Galaxy holding the tree. */
async function galaxy(page) {
    const json = (body) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    const text = (file) => ({ status: 200, body: readFileSync(join(__dirname, "test-data", file), "utf8") });
    await page.route("**/api/**", (route) => {
        const url = new URL(route.request().url());
        const routes = {
            "/api/datasets/1/display": () => text("1.newick"),
            "/api/datasets/1": () => json(TREE),
            "/api/version": () => json({ version_major: "26.1" }),
        };
        return route.fulfill(routes[url.pathname]?.() ?? { status: 404, body: "" });
    });
}

test("basic", async ({ page }) => {
    await galaxy(page);
    await page.goto("/?dataset_id=1");
    await expect.poll(async () => (await viewerState(page))?.treeLoaded, { timeout: 30_000 }).toBe(true);
    await expect(page.locator("#bt-status")).toBeHidden();
    await expect(page.locator("#bt-error")).toBeHidden();
});

test("reports a failed fetch", async ({ page }) => {
    await page.route("**/api/datasets/*/display", (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto("/?dataset_id=missing");
    await expect(page.locator("#bt-error")).toContainText("Could not fetch dataset: HTTP 404");
});
