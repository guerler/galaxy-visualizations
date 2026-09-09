import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { atomMassForPdb, structureStats } from "./src/structure-geometry.js";

function atom(name, x, element = "", record = "ATOM  ") {
    return (
        `${record}    1 ${name.padEnd(4)} GLY A   1    ${x.toFixed(3).padStart(8)}${"0.000".padStart(8)}${"0.000".padStart(8)}`.padEnd(
            76,
        ) + element.padStart(2)
    );
}

test("mass center distinguishes backbone elements and calcium from C-alpha", () => {
    const n = atom(" N  ", 0),
        c = atom(" CA ", 10),
        o = atom(" OT1", 20);
    expect(atomMassForPdb(c)).toBe(12.011);
    expect(atomMassForPdb(atom("CA  ", 0, "CA", "HETATM"))).toBe(40.078);
    expect(atomMassForPdb(atom("1HB ", 0))).toBe(1.008);
    const stats = structureStats([n, c, o].join("\n"));
    expect(stats.centerKind).toBe("center-of-mass");
    expect(stats.center.x).toBeCloseTo((12.011 * 10 + 15.999 * 20) / (14.007 + 12.011 + 15.999), 10);
    expect(stats.center.x).not.toBeCloseTo(10, 2);
    const unknown = structureStats([n, atom(" XX ", 20, "XX")].join("\n"));
    expect(unknown.centerKind).toBe("geometric-fallback");
    expect(unknown.center.x).toBe(10);
});

test("all nine real ubiquitin pivots equal independently calculated backbone mass centers", () => {
    const manifest = JSON.parse(readFileSync(new URL("./test-data/example.rmsx.json", import.meta.url)));
    expect(manifest.slices).toHaveLength(9);
    for (const slice of manifest.slices) {
        const points = slice.pdb
            .split(/\r?\n/)
            .filter((l) => l.startsWith("ATOM"))
            .map((l) => ({
                // Independent fixture-specific N/C/O reference, not the production lookup.
                mass: { N: 14.007, C: 12.011, O: 15.999 }[l.slice(12, 16).trim()[0]],
                x: Number(l.slice(30, 38)),
                y: Number(l.slice(38, 46)),
                z: Number(l.slice(46, 54)),
            }));
        expect(points.every((p) => p.mass > 0)).toBe(true);
        const mass = points.reduce((total, p) => total + p.mass, 0);
        const stats = structureStats(slice.pdb);
        expect(stats.centerKind).toBe("center-of-mass");
        for (const axis of ["x", "y", "z"])
            expect(stats.center[axis]).toBeCloseTo(points.reduce((total, p) => total + p.mass * p[axis], 0) / mass, 10);
    }
});
