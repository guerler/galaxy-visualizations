/**
 * Best-fit grid: lays out `count` equal cells in a `width` x `height` area, choosing the
 * column count whose largest square cell is biggest. Returns the columns, rows and cell size.
 */
export function bestFitGrid(count, width, height, gap = 0) {
    let best = { columns: 0, rows: 0, size: 0 };
    for (let columns = 1; columns <= count; columns++) {
        const rows = Math.ceil(count / columns);
        const size = Math.min((width - gap * (columns - 1)) / columns, (height - gap * (rows - 1)) / rows);
        if (columns === 1 || size > best.size) {
            best = { columns, rows, size };
        }
    }
    return best;
}

/**
 * How many square cells of at least `minSize` fit in a `width` x `height` area, at least one.
 */
export function gridCapacity(width, height, minSize, gap = 0) {
    const fit = (length) => Math.max(1, Math.floor((length + gap) / (minSize + gap)));
    return fit(width) * fit(height);
}
