// Generates a minimal but valid rmsx.json manifest fixture for tests.
// The structure is synthetic (a short poly-ALA backbone) — enough for molstar's
// putty representation to render a canvas. Replace with a real workflow manifest
// when available and regenerate the screenshot baseline via `npm run test:update`.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CHAIN = "A";
const RESIDUE_COUNT = 8;
const SLICE_COUNT = 3;

// Fixed-width PDB ATOM record (standard columns).
function atom(serial, name, resName, chain, resSeq, x, y, z, element) {
    const rec =
        "ATOM  " +
        String(serial).padStart(5) +
        " " +
        name.padEnd(4).slice(0, 4) +
        " " +
        resName.padEnd(3) +
        " " +
        chain +
        String(resSeq).padStart(4) +
        "    " +
        x.toFixed(3).padStart(8) +
        y.toFixed(3).padStart(8) +
        z.toFixed(3).padStart(8) +
        "  1.00  0.00          " +
        element.padStart(2);
    return rec;
}

// Straight-ish backbone: one N/CA/C/O per residue, ~3.8A CA-CA spacing.
function backbonePdb() {
    const lines = [];
    let serial = 1;
    for (let i = 0; i < RESIDUE_COUNT; i++) {
        const resSeq = i + 1;
        const cx = i * 3.8;
        lines.push(atom(serial++, "N", "ALA", CHAIN, resSeq, cx - 1.2, 0.5, 0, "N"));
        lines.push(atom(serial++, "CA", "ALA", CHAIN, resSeq, cx, 0, 0, "C"));
        lines.push(atom(serial++, "C", "ALA", CHAIN, resSeq, cx + 1.2, 0.5, 0, "C"));
        lines.push(atom(serial++, "O", "ALA", CHAIN, resSeq, cx + 1.2, 1.7, 0, "O"));
    }
    lines.push("TER");
    lines.push("END");
    return lines.join("\n");
}

const pdb = backbonePdb();

// rmsxColumn keys, one per slice; each residue carries a value per column.
const rmsxColumns = Array.from({ length: SLICE_COUNT }, (_, s) => `rmsx${s}`);

const residues = Array.from({ length: RESIDUE_COUNT }, (_, i) => {
    const resSeq = i + 1;
    const values = {};
    rmsxColumns.forEach((col, s) => {
        // Deterministic 0..1 wave so slices differ visibly.
        values[col] = Number((0.5 + 0.5 * Math.sin((i + s) * 0.7)).toFixed(3));
    });
    return { key: `${CHAIN}:${resSeq}`, id: String(resSeq), label: `ALA${resSeq}`, values };
});

const slices = Array.from({ length: SLICE_COUNT }, (_, s) => ({
    index: s + 1,
    id: `slice-${s + 1}`,
    label: `Frame ${s + 1}`,
    filename: `frame_${s + 1}.pdb`,
    rmsxColumn: rmsxColumns[s],
    pdb,
}));

const palette = { name: "viridis", colors: ["#440154", "#21918c", "#fde725"] };

const manifest = {
    schemaVersion: "flipbook-molstar-viewer/v1",
    title: "RMSX Flipbook Example",
    slices,
    residues,
    summaries: {},
    domain: { min: 0, max: 1 },
    maskSummary: { maskedResidues: 0, totalResidues: RESIDUE_COUNT, maskedKeys: [] },
    maskOpacity: 0.3,
    palette,
    availablePalettes: { viridis: palette.colors },
    presentation: { defaultLayout: "tiled" },
    visualMapping: {
        defaultColorMin: 0,
        defaultColorMax: 1,
        defaultRadiusMin: 0.63,
        defaultRadiusMax: 3.18,
        defaultThicknessScale: 1,
        colorDomainStep: 0.1,
        radiusStep: 0.05,
    },
    rotationModel: { defaultRotation: { x: 90, y: 0, z: 0 } },
    molstarRenderStyle: { preset: "clean-interactive", outline: true },
    flipbookReference: {
        defaultColumns: SLICE_COUNT,
        defaultSpacingFactor: 1,
        minimumSpacingFactor: 0.1,
        maximumSpacingFactor: 2.5,
        tilePaddingFactor: 1.55,
    },
};

const outDir = join(__dirname, "..", "test-data");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "example.rmsx.json");
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
