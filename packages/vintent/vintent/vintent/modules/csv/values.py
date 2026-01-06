import csv
import io
from typing import Any, Dict, List, Optional


def values_from_csv(csv_text: str, max_rows: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Parse CSV text into an array of row objects suitable for Vega-Lite `data.values`.
    """
    # Split lines and remove empty ones
    lines = [line.strip() for line in csv_text.strip().splitlines() if line.strip()]

    if not lines:
        return []

    # Use Python's built-in csv reader for robust parsing
    csv_reader = csv.reader(io.StringIO(csv_text.strip()))
    rows = list(csv_reader)

    if not rows:
        return []

    headers = rows[0]
    data_rows = rows[1:]

    values: List[Dict[str, Any]] = []

    for i, row in enumerate(data_rows):
        if max_rows is not None and len(values) >= max_rows:
            break

        # Ensure row has same number of columns as headers (pad with empty strings if needed)
        row = list(row) + [""] * (len(headers) - len(row))

        row_dict: Dict[str, Any] = {}

        for header, raw in zip(headers, row):
            if raw is None or raw == "":
                continue

            row_dict[header] = parse_value(raw)

        values.append(row_dict)

    return values


def parse_value(value: str) -> Any:
    """
    Parse an individual CSV value.
    Numbers are parsed as numbers.
    Everything else is left as string.
    """
    if is_numeric(value):
        # Try to parse as int first, then float
        try:
            if "." in value:
                return float(value)
            else:
                return int(value)
        except (ValueError, TypeError):
            return float(value)
    return value


def is_numeric(value: str) -> bool:
    """Check if a value is numeric."""
    try:
        float(value)
        return True
    except (ValueError, TypeError):
        return False
