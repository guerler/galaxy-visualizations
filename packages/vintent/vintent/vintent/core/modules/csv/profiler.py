import csv
import io
from datetime import datetime
from typing import Dict, Literal, Set, TypedDict
from ..schemas import FieldType, FieldInfo, DatasetProfile


def profile_csv(csv_text: str) -> DatasetProfile:
    """
    Given raw CSV text, compute a lightweight dataset profile.
    The profile is used for validation and shell selection only.
    """
    # Split lines and remove empty ones
    lines = [line.strip() for line in csv_text.strip().splitlines() if line.strip()]

    if not lines:
        return {"fields": {}, "rowCount": 0}

    # Parse CSV properly using Python's csv module
    csv_reader = csv.reader(io.StringIO(csv_text.strip()))
    rows = list(csv_reader)

    if not rows:
        return {"fields": {}, "rowCount": 0}

    headers = rows[0]
    data_rows = rows[1:]

    field_values: Dict[str, Set[str]] = {header: set() for header in headers}
    field_types: Dict[str, Set[str]] = {header: set() for header in headers}

    for row in data_rows:
        # Ensure row has same number of columns as headers (pad with empty strings if needed)
        row = list(row) + [""] * (len(headers) - len(row))

        for header, raw in zip(headers, row):
            if raw is None or raw == "":
                continue

            field_values[header].add(raw)

            if is_numeric(raw):
                field_types[header].add("number")
            elif is_date_like(raw):
                field_types[header].add("date")
            else:
                field_types[header].add("string")

    fields: Dict[str, FieldInfo] = {}

    for header in headers:
        observed_types = field_types[header]
        cardinality = len(field_values[header])

        if len(observed_types) == 1 and "number" in observed_types:
            field_type: FieldType = "quantitative"
        elif len(observed_types) == 1 and "date" in observed_types:
            field_type = "temporal"
        else:
            # Note: Python version only distinguishes nominal vs others
            # You might want to add ordinal detection logic here
            field_type = "nominal"

        fields[header] = {"type": field_type, "cardinality": cardinality}

    return {"fields": fields, "rowCount": len(data_rows)}


def is_numeric(value: str) -> bool:
    """Check if a value is numeric."""
    try:
        float(value)
        return True
    except (ValueError, TypeError):
        return False


def is_date_like(value: str) -> bool:
    """Check if a value looks like a date."""
    # Try multiple common date formats
    date_formats = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%m-%d-%Y",
        "%m/%d/%Y",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%d-%m-%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
    ]

    for fmt in date_formats:
        try:
            datetime.strptime(value, fmt)
            return True
        except ValueError:
            continue

    # Also try the generic date parsing
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return True
    except ValueError:
        pass

    return False
