import { test, expect } from "@playwright/test";
import { bestFitGrid, gridCapacity } from "./src/grid.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const maxDiffPixelRatio = 0.01;

const TESTS = {
    1: { file: "1.smi", molecules: 2, failed: 0, columns: 2 },
    test: { file: "test.smi", molecules: 6, failed: 1, columns: 3 },
};

test("basic", async ({ page }) => {
    await page.route("**/api/datasets/*/display", async (route) => {
        const name = new URL(route.request().url()).pathname.split("/").at(-2);
        const fixture = TESTS[name];
        if (!fixture) {
            return route.continue();
        }
        const body = readFileSync(join(__dirname, "test-data", fixture.file), "utf8");
        await route.fulfill({ status: 200, contentType: "text/plain", body });
    });
    for (const [name, fixture] of Object.entries(TESTS)) {
        await page.goto(`/?dataset_id=${name}`);
        await expect(page.locator(".sd-card")).toHaveCount(fixture.molecules);
        await expect(page.locator(".sd-parse-error")).toHaveCount(fixture.failed);
        await expect(page.locator("svg.sd-drawing")).toHaveCount(fixture.molecules - fixture.failed);
        expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
        await expect(page.locator("#sd-grid")).toHaveCSS(
            "grid-template-columns",
            new RegExp(`^(\\S+ ){${fixture.columns - 1}}\\S+$`),
        );
        await expect(page).toHaveScreenshot(`${name}.png`, { maxDiffPixelRatio });
    }
});

test("search and theme", async ({ page }) => {
    await page.route("**/api/datasets/*/display", (route) =>
        route.fulfill({ status: 200, body: readFileSync(join(__dirname, "test-data", "test.smi"), "utf8") }),
    );
    await page.goto("/?dataset_id=test");
    await expect(page.locator(".sd-card")).toHaveCount(6);
    await page.fill("#sd-search", "caffeine");
    await expect(page.locator(".sd-card")).toHaveCount(1);
    await expect(page.locator("#sd-count")).toHaveText("1 / 6 molecules");
    expect(await page.locator("#sd-theme-select option").count()).toBeGreaterThan(2);
    await page.selectOption("#sd-theme-select", "dark");
    await expect(page.locator("body")).toHaveClass(/theme-dark/);
});

test("fits the window and pages the rest", async ({ page }) => {
    const body = Array.from({ length: 120 }, (_, i) => `${"C".repeat((i % 8) + 1)}O\tAlcohol ${i}`).join("\n");
    await page.route("**/api/datasets/*/display", (route) => route.fulfill({ status: 200, body }));
    await page.setViewportSize({ width: 1000, height: 600 });
    await page.goto("/?dataset_id=many");
    const cards = page.locator(".sd-card");
    await expect(cards.first()).toBeVisible();
    const perPage = await cards.count();
    expect(perPage).toBeLessThan(120);
    await expect(page.locator("#sd-pagination button", { hasText: "Next" })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    await page.setViewportSize({ width: 500, height: 400 });
    await expect.poll(() => cards.count()).toBeLessThan(perPage);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
});

test("best-fit grid", () => {
    expect(bestFitGrid(6, 1200, 600)).toEqual({ columns: 3, rows: 2, size: 300 });
    expect(bestFitGrid(6, 600, 1200)).toEqual({ columns: 2, rows: 3, size: 300 });
    expect(bestFitGrid(1, 800, 300)).toEqual({ columns: 1, rows: 1, size: 300 });
    expect(bestFitGrid(5, 1000, 200)).toEqual({ columns: 5, rows: 1, size: 200 });
    expect(bestFitGrid(4, 210, 210, 10)).toEqual({ columns: 2, rows: 2, size: 100 });
    expect(bestFitGrid(0, 500, 500)).toEqual({ columns: 0, rows: 0, size: 0 });
    expect(gridCapacity(1000, 600, 160)).toBe(18);
    expect(gridCapacity(330, 160, 160, 10)).toBe(2);
    expect(gridCapacity(100, 100, 160)).toBe(1);
});
