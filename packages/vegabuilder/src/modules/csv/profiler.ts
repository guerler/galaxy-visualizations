export type FieldType = "nominal" | "ordinal" | "quantitative" | "temporal";

export interface DatasetProfile {
    fields: Record<
        string,
        {
            type: FieldType;
            cardinality: number;
        }
    >;
    rowCount: number;
}

/**
 * Given raw CSV text, compute a lightweight dataset profile.
 * The profile is used for validation and shell selection only.
 */
export function profileCsv(csvText: string): DatasetProfile {
    const lines = csvText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (lines.length === 0) {
        return { fields: {}, rowCount: 0 };
    }

    const headers = splitCsvLine(lines[0]);
    const rows = lines.slice(1).map(splitCsvLine);

    const fieldValues: Record<string, Set<string>> = {};
    const fieldTypes: Record<string, Set<"number" | "string" | "date">> = {};

    for (const header of headers) {
        fieldValues[header] = new Set();
        fieldTypes[header] = new Set();
    }

    for (const row of rows) {
        headers.forEach((header, index) => {
            const raw = row[index];
            if (raw == null || raw === "") {
                return;
            }

            fieldValues[header].add(raw);

            if (isNumeric(raw)) {
                fieldTypes[header].add("number");
            } else if (isDateLike(raw)) {
                fieldTypes[header].add("date");
            } else {
                fieldTypes[header].add("string");
            }
        });
    }

    const fields: DatasetProfile["fields"] = {};

    for (const header of headers) {
        const observedTypes = fieldTypes[header];
        const cardinality = fieldValues[header].size;

        let type: FieldType;

        if (observedTypes.size === 1 && observedTypes.has("number")) {
            type = "quantitative";
        } else if (observedTypes.size === 1 && observedTypes.has("date")) {
            type = "temporal";
        } else {
            type = "nominal";
        }

        fields[header] = {
            type,
            cardinality,
        };
    }

    return {
        fields,
        rowCount: rows.length,
    };
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
    return result.map((value) => value.trim());
}

/**
 * Check if a value is numeric.
 */
function isNumeric(value: string): boolean {
    return value !== "" && !isNaN(Number(value));
}

/**
 * Check if a value looks like a date.
 */
function isDateLike(value: string): boolean {
    const timestamp = Date.parse(value);
    return !isNaN(timestamp);
}
