/**
 * Parse CSV text into an array of row objects suitable for Vega-Lite `data.values`.
 */
export function valuesFromCsv(
    csvText: string,
    options?: {
        maxRows?: number;
    },
): Record<string, unknown>[] {
    const lines = csvText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (lines.length === 0) {
        return [];
    }

    const headers = splitCsvLine(lines[0]);
    const rows = lines.slice(1);

    const values: Record<string, unknown>[] = [];

    for (let i = 0; i < rows.length; i++) {
        if (options?.maxRows && values.length >= options.maxRows) {
            break;
        }

        const cols = splitCsvLine(rows[i]);
        const row: Record<string, unknown> = {};

        headers.forEach((header, index) => {
            const raw = cols[index];
            if (raw == null || raw === "") {
                return;
            }

            row[header] = parseValue(raw);
        });

        values.push(row);
    }

    return values;
}

/**
 * Parse an individual CSV value.
 * Numbers are parsed as numbers.
 * Everything else is left as string.
 */
function parseValue(value: string): unknown {
    if (isNumeric(value)) {
        return Number(value);
    }
    return value;
}

/**
 * Split a single CSV line into values.
 * Handles quoted values and commas inside quotes.
 */
function splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
            continue;
        }

        if (char === "," && !inQuotes) {
            result.push(current);
            current = "";
        } else {
            current += char;
        }
    }

    result.push(current);
    return result.map((v) => v.trim());
}

/**
 * Check if a value is numeric.
 */
function isNumeric(value: string): boolean {
    return value !== "" && !isNaN(Number(value));
}
