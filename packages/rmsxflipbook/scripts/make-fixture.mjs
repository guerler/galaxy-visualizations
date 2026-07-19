// Normalize a Galaxy-generated 1UBQ/mon_sys manifest into the checked-in
// development and Playwright fixture.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcePath = process.argv[2] || process.env.RMSX_EXAMPLE_MANIFEST;

if (!sourcePath) {
    throw new Error("Usage: npm run fixture -- /path/to/1ubq-mon_sys.rmsx.json");
}

const manifest = JSON.parse(readFileSync(sourcePath, "utf8"));

if (manifest.schemaVersion !== "flipbook-molstar-viewer/v1") {
    throw new Error(`Unexpected RMSX manifest schema: ${manifest.schemaVersion || "missing"}`);
}
if (manifest.slices?.length !== 9 || manifest.residues?.length !== 76) {
    throw new Error(
        `Expected the 1UBQ/mon_sys 9-slice, 76-residue example; received ${manifest.slices?.length || 0} slices and ${manifest.residues?.length || 0} residues.`,
    );
}

manifest.title = "RMSX Flipbook Example: 1UBQ + mon_sys";
manifest.exampleData = {
    topology: "1UBQ.pdb",
    trajectory: "mon_sys.xtc",
    trajectoryFrames: 316,
    selectedSegment: "7",
    requestedSlices: 9,
    source: {
        name: "TCBG Ubiquitin case study",
        url: "https://www.ks.uiuc.edu/Training/CaseStudies/",
        archive: "ubq-files.tgz",
        attribution: "Cruz-Chu, E. and Gumbart, J. C. Case study: Ubiquitin (2016).",
        redistribution:
            "Derived educational test fixture distributed with source attribution under the TCBG educational-use statement.",
    },
};

const outDir = join(__dirname, "..", "test-data");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "example.rmsx.json");
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
