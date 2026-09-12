import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

async function loadProtease(page) {
    const manifest = readFileSync(new URL("./test-data/protease-galaxy.rmsx.json", import.meta.url));
    await page.route("**/api/datasets/**/display", (route) =>
        route.fulfill({ contentType: "application/json", body: manifest }),
    );
    await page.setViewportSize({ width: 2000, height: 1100 });
    await page.goto("/?dataset_id=protease");
    await expect(page.locator("#status")).toContainText("9/9 slices visible", { timeout: 90000 });
}

async function redPixels(canvas) {
    return canvas.evaluate((element) => {
        const pixels = element.getContext("2d").getImageData(0, 0, element.width, element.height).data;
        let count = 0;
        for (let index = 0; index < pixels.length; index += 4) {
            if (pixels[index] > 120 && pixels[index + 1] < 80 && pixels[index + 2] < 70 && pixels[index + 3] > 0)
                count++;
        }
        return count;
    });
}

async function clickPlot(canvas, fractionX = 0.5, fractionY = 0.5) {
    const point = await canvas.evaluate(
        (element, { fractionX, fractionY }) => {
            const { plot } = element.analysisGeometry || element.heatmapGeometry;
            return { x: plot.x + plot.width * fractionX, y: plot.y + plot.height * fractionY };
        },
        { fractionX, fractionY },
    );
    await canvas.click({ position: point });
}

async function exportRegions(page, download, regions) {
    const data = readFileSync(await download.path()).toString("base64");
    return page.evaluate(
        async ({ data, regions }) => {
            const image = new Image();
            image.src = `data:image/png;base64,${data}`;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            return {
                width: canvas.width,
                height: canvas.height,
                regions: regions.map((region) => {
                    let colored = 0,
                        dark = 0,
                        red = 0;
                    for (
                        let y = Math.max(0, Math.floor(region.y));
                        y < Math.min(canvas.height, Math.ceil(region.y + region.height));
                        y++
                    ) {
                        for (
                            let x = Math.max(0, Math.floor(region.x));
                            x < Math.min(canvas.width, Math.ceil(region.x + region.width));
                            x++
                        ) {
                            const index = (y * canvas.width + x) * 4;
                            const [r, g, b] = pixels.slice(index, index + 3);
                            if (Math.max(r, g, b) - Math.min(r, g, b) > 18 && Math.min(r, g, b) < 220) colored++;
                            if (Math.max(r, g, b) < 160) dark++;
                            if (r > 120 && g < 80 && b < 70) red++;
                        }
                    }
                    return { colored, dark, red };
                }),
            };
        },
        { data, regions },
    );
}

async function heatmapDrawn(page) {
    // The chain canvases are sized and painted after the tab switch, so measuring or
    // exporting before that captures the default 300x150 buffer. heatmapGeometry is
    // assigned at the end of the draw.
    await expect
        .poll(() =>
            page
                .locator(".heatmap-chains canvas")
                .evaluateAll(
                    (canvases) => canvases.length > 0 && canvases.every((canvas) => Boolean(canvas.heatmapGeometry)),
                ),
        )
        .toBe(true);
}

async function regionsInView(page, selector) {
    return page.locator(selector).evaluateAll((elements) => {
        const root = document.getElementById("viewerRegion").getBoundingClientRect();
        return elements.map((element) => {
            const box = element.getBoundingClientRect();
            return { x: box.left - root.left, y: box.top - root.top, width: box.width, height: box.height };
        });
    });
}

async function saveImage(page, testInfo, filename) {
    const downloaded = page.waitForEvent("download", { timeout: 60000 });
    await page.getByTestId("save-image").click();
    const download = await downloaded;
    await download.saveAs(testInfo.outputPath(filename));
    await expect(page.getByTestId("save-image")).toBeEnabled();
    await expect(page.locator(".rmsx-app")).not.toHaveAttribute("inert", "");
    return download;
}

test("clears linked guides and markers on click-away and Escape without changing view controls", async ({ page }) => {
    await loadProtease(page);
    await page.getByTestId("analysis-tab").click();
    const rmsd = page.getByTestId("rmsx-analysis-rmsd");
    const rmsf = page.getByTestId("rmsx-analysis-rmsf");
    await expect.poll(() => redPixels(rmsd.first())).toBeGreaterThan(50);
    await clickPlot(rmsf.nth(1), 0.5, 0.995);
    await expect(page.locator("#analysisSelection")).toContainText("Chain B · Residue 1");
    await expect.poll(() => redPixels(rmsf.nth(1))).toBeGreaterThan(50);
    expect(await redPixels(rmsf.first())).toBe(0);
    await expect(page.locator("#heatmapView")).not.toHaveAttribute("data-marker-records", "0");
    await page.getByText("Rotation", { exact: true }).click();
    await expect.poll(() => redPixels(rmsf.nth(1))).toBeGreaterThan(50);
    // This is horizontally inside the RMSD plot but below its vertical bounds.
    const rmsdBox = await rmsd.first().boundingBox();
    await rmsd.first().click({ position: { x: rmsdBox.width / 2, y: rmsdBox.height - 2 } });
    for (const canvas of await rmsd.all()) await expect.poll(() => redPixels(canvas)).toBe(0);
    for (const canvas of await rmsf.all()) await expect.poll(() => redPixels(canvas)).toBe(0);
    await expect(page.locator("#heatmapView")).toHaveAttribute("data-marker-records", "0");
    await expect(page.locator("#analysisSelection")).toHaveText("No selection");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByTestId("structures-tab").click();
    await page.getByTestId("analysis-tab").click();
    await expect.poll(() => redPixels(rmsd.first())).toBe(0);
    await clickPlot(rmsf.first());
    await expect.poll(() => redPixels(rmsf.first())).toBeGreaterThan(50);
    // This is vertically inside RMSF but to the left of its horizontal bounds.
    await rmsf.first().click({ position: { x: 1, y: 60 } });
    await expect.poll(() => redPixels(rmsf.first())).toBe(0);
    await clickPlot(rmsd.first());
    await expect.poll(() => redPixels(rmsd.first())).toBeGreaterThan(50);
    await page.keyboard.press("Escape");
    await expect.poll(() => redPixels(rmsd.first())).toBe(0);
    await expect(page.getByTestId("molstar-rotation-x-number")).toHaveValue("90");
    await expect(page.getByTestId("molstar-spacing-number")).toHaveValue("0.5");
});

test("saves a clean multi-chain Analysis PNG with all molecular lanes and plots after a drag", async ({
    page,
}, testInfo) => {
    const errors = [];
    test.setTimeout(180000);
    page.on("pageerror", (error) => errors.push(error.message));
    await loadProtease(page);
    await page.getByTestId("analysis-tab").click();
    const lanes = page.locator(".analysis-structure-lane");
    for (const lane of await lanes.all())
        await expect(lane).toHaveAttribute("data-cluster-count", "9", { timeout: 30000 });
    await clickPlot(page.getByTestId("rmsx-analysis-rmsf").nth(1));
    const box = await lanes.first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 20, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => redPixels(page.getByTestId("rmsx-analysis-rmsf").nth(1))).toBeGreaterThan(50);
    await page.locator(".analysis-header h2").click();
    await expect.poll(() => redPixels(page.getByTestId("rmsx-analysis-rmsd").first())).toBe(0);
    const anchors = await regionsInView(page, ".analysis-slice-anchor");
    const plots = await regionsInView(page, ".analysis-rmsd, .analysis-rmsf, .analysis-heatmap");
    const download = await saveImage(page, testInfo, "protease-analysis-clean.png");
    expect(download.suggestedFilename()).toBe("rmsx-flipbook-analysis.png");
    const image = await exportRegions(page, download, [...anchors, ...plots]);
    const view = await page.getByTestId("molstar-report").boundingBox();
    expect(image.width).toBe(Math.round(view.width));
    expect(image.height).toBe(Math.round(view.height));
    expect(anchors).toHaveLength(27);
    image.regions.slice(0, 27).forEach((region) => expect(region.colored).toBeGreaterThan(15));
    image.regions.slice(27).forEach((region) => {
        expect(region.dark).toBeGreaterThan(50);
        expect(region.red).toBe(0);
    });
    await page.screenshot({ path: testInfo.outputPath("protease-analysis-screen.png") });
    expect(errors).toEqual([]);
    // A scrolled narrow viewport exports what is visible at that scroll position.
    await page.setViewportSize({ width: 552, height: 993 });
    await page.getByTestId("rmsx-analysis-assembly-lane").scrollIntoViewIfNeeded();
    const narrowAnchors = await regionsInView(page, ".assembly-lane .analysis-slice-anchor");
    const narrow = await saveImage(page, testInfo, "protease-analysis-narrow.png");
    const narrowImage = await exportRegions(page, narrow, narrowAnchors);
    narrowImage.regions.forEach((region) => expect(region.colored).toBeGreaterThan(10));
});

test("saves Structures immediately after spacing changes and Heatmap without a molecular canvas", async ({
    page,
}, testInfo) => {
    await loadProtease(page);
    await page.getByTestId("molstar-spacing-number").fill("0.7");
    const structures = await saveImage(page, testInfo, "protease-structures-wide.png");
    const view = await page.getByTestId("molstar-report").boundingBox();
    const image = await exportRegions(page, structures, [{ x: 0, y: 0, width: view.width, height: view.height }]);
    expect(image.regions[0].colored).toBeGreaterThan(3000);
    await expect(page.getByTestId("molstar-spacing-number")).toHaveValue("0.7");
    await page.getByTestId("heatmap-tab").click();
    await heatmapDrawn(page);
    const heatmaps = await regionsInView(page, ".heatmap-chains canvas");
    const heatmap = await saveImage(page, testInfo, "protease-heatmap.png");
    const heatmapImage = await exportRegions(page, heatmap, heatmaps);
    heatmapImage.regions.forEach((region) => expect(region.colored).toBeGreaterThan(10000));
});

test("saves the legacy Analysis fallback without optional metrics", async ({ page }, testInfo) => {
    const manifest = JSON.parse(readFileSync(new URL("./test-data/example.rmsx.json", import.meta.url)));
    delete manifest.analysis;
    manifest.slices.forEach((slice) => {
        delete slice.time;
        delete slice.chainAtomRanges;
    });
    await page.route("**/api/datasets/**/display", (route) =>
        route.fulfill({ contentType: "application/json", body: JSON.stringify(manifest) }),
    );
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/?dataset_id=legacy");
    await expect(page.locator("#status")).toContainText("9/9 slices visible", { timeout: 90000 });
    await page.getByTestId("analysis-tab").click();
    await expect(page.getByTestId("rmsx-analysis-chain-panel")).toHaveAttribute("data-metrics", "missing");
    await expect(page.getByTestId("rmsx-analysis-rmsd")).toHaveCount(0);
    await expect(page.getByTestId("rmsx-analysis-rmsf")).toHaveCount(0);
    await expect(page.getByTestId("rmsx-analysis-chain-lane")).toHaveAttribute("data-cluster-count", "9", {
        timeout: 30000,
    });
    const anchors = await regionsInView(page, ".analysis-slice-anchor");
    const download = await saveImage(page, testInfo, "legacy-analysis.png");
    const image = await exportRegions(page, download, anchors);
    image.regions.forEach((region) => expect(region.colored).toBeGreaterThan(10));
    await expect(page.locator("#status")).not.toHaveClass(/error/);
});
