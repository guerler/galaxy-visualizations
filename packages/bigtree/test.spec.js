import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TREE = { id: "1", hid: 1, name: "tree", extension: "newick", history_id: "h1" };
const TABLE = { id: "2", hid: 2, name: "metadata.tsv", extension: "tabular", history_id: "h1" };

function viewerState(page) {
    return page
        .frame({ url: /\/viewer\/index\.html/ })
        ?.evaluate(() => window.__BIG_TREE_VIEWER_APP_TEST__?.getState() ?? null);
}

/** A Galaxy holding the tree and a metadata table in one history. */
async function galaxy(page) {
    const json = (body) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    const text = (file) => ({ status: 200, body: readFileSync(join(__dirname, "test-data", file), "utf8") });
    await page.route("**/api/**", (route) => {
        const url = new URL(route.request().url());
        const routes = {
            "/api/datasets/1/display": () => text("1.newick"),
            "/api/datasets/2/display": () => text("metadata.tsv"),
            "/api/datasets/1": () => json(TREE),
            "/api/histories/h1/contents": () => json([TABLE]),
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

test("colors the tree by a metadata table from the history", async ({ page }) => {
    await galaxy(page);
    await page.goto("/?dataset_id=1");
    await expect.poll(async () => (await viewerState(page))?.treeLoaded, { timeout: 30_000 }).toBe(true);
    await page.click(".n-button");
    await page.locator(".n-base-selection", { hasText: "Select a dataset" }).click();
    await page.locator(".n-base-select-option", { hasText: "metadata.tsv" }).click();
    await expect
        .poll(async () => {
            const state = await viewerState(page);
            return [
                state?.metadataEnabled,
                state?.metadataRowCount,
                state?.metadataKeyColumn,
                state?.metadataValueColumn,
            ];
        })
        .toEqual([true, 7, "species", "habitat"]);
    await expect(page.locator("#bt-error")).toBeHidden();
});

test("reports a failed fetch", async ({ page }) => {
    await page.route("**/api/datasets/*/display", (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto("/?dataset_id=missing");
    await expect(page.locator("#bt-error")).toContainText("Could not fetch dataset: HTTP 404");
});
