// CIAAW abridged standard atomic weights (2024), for protein atoms and common
// cofactors/ions: https://ciaaw.org/abridged-atomic-weights.htm .
const ATOMIC_MASS = Object.freeze({
    H: 1.008,
    C: 12.011,
    N: 14.007,
    O: 15.999,
    F: 18.998,
    NA: 22.99,
    MG: 24.305,
    AL: 26.982,
    SI: 28.085,
    P: 30.974,
    S: 32.06,
    CL: 35.45,
    K: 39.098,
    CA: 40.078,
    MN: 54.938,
    FE: 55.845,
    CO: 58.933,
    NI: 58.693,
    CU: 63.546,
    ZN: 65.38,
    SE: 78.971,
    BR: 79.904,
    I: 126.9,
});

export function atomMassForPdb(line) {
    const explicit = line.slice(76, 78).trim().toUpperCase();
    if (explicit) return ATOMIC_MASS[explicit] ?? null;
    const name = line.slice(12, 16);
    // Protein atom names such as CA, CB and OT1 denote C/C/O, not calcium.
    // PDB's right-aligned one-letter element names and numbered H names also
    // keep their first alphabetic character when the element field is absent.
    const letters = name.replace(/[^a-z]/gi, "").toUpperCase();
    if (line.startsWith("ATOM") || /^\s|^\d/.test(name)) {
        return ATOMIC_MASS[letters[0]] ?? null;
    }
    return ATOMIC_MASS[letters.slice(0, 2)] ?? ATOMIC_MASS[letters[0]] ?? null;
}

// Use the complete lane before mask splitting so all its representations
// rotate around the same pivot. Unknown elements retain the legacy centroid
// for the whole lane instead of silently assigning made-up atomic masses.
export function structureStats(pdb) {
    const stats = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity,
        sumX: 0,
        sumY: 0,
        sumZ: 0,
        count: 0,
        mass: 0,
        massX: 0,
        massY: 0,
        massZ: 0,
        unknownMass: false,
    };
    pdb.split(/\r?\n/).forEach((line) => {
        if (!line.startsWith("ATOM") && !line.startsWith("HETATM")) {
            return;
        }
        const x = Number(line.slice(30, 38));
        const y = Number(line.slice(38, 46));
        const z = Number(line.slice(46, 54));
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
            return;
        }
        stats.minX = Math.min(stats.minX, x);
        stats.maxX = Math.max(stats.maxX, x);
        stats.minY = Math.min(stats.minY, y);
        stats.maxY = Math.max(stats.maxY, y);
        stats.minZ = Math.min(stats.minZ, z);
        stats.maxZ = Math.max(stats.maxZ, z);
        stats.sumX += x;
        stats.sumY += y;
        stats.sumZ += z;
        stats.count += 1;
        const mass = atomMassForPdb(line);
        if (mass === null) {
            stats.unknownMass = true;
        } else {
            stats.mass += mass;
            stats.massX += mass * x;
            stats.massY += mass * y;
            stats.massZ += mass * z;
        }
    });
    if (!stats.count) {
        return {
            ...stats,
            width: 30,
            height: 30,
            depth: 30,
            center: { x: 0, y: 0, z: 0 },
        };
    }
    return {
        ...stats,
        width: Math.max(1, stats.maxX - stats.minX),
        height: Math.max(1, stats.maxY - stats.minY),
        depth: Math.max(1, stats.maxZ - stats.minZ),
        centerKind: stats.unknownMass ? "geometric-fallback" : "center-of-mass",
        center: {
            x: stats.unknownMass ? stats.sumX / stats.count : stats.massX / stats.mass,
            y: stats.unknownMass ? stats.sumY / stats.count : stats.massY / stats.mass,
            z: stats.unknownMass ? stats.sumZ / stats.count : stats.massZ / stats.mass,
        },
    };
}
