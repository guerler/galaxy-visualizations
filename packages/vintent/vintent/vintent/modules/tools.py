from typing import Any, Dict, List

from .csv.profiler import DatasetProfile  # Assuming you have this import

# Import shells from your shells module
from .shells import SHELLS


def build_choose_shell_tool(profile: DatasetProfile) -> Dict[str, Any]:
    """
    Build a tool for choosing the appropriate visualization shell.
    """
    compatible_shells = []

    # Filter shells based on field type compatibility
    for shell_id, shell in SHELLS.items():
        # Check if any signature matches the available field types
        signature_matches = False
        for sig in shell.signatures:
            # Check if every type in signature has at least one matching field
            type_matches = True
            for sig_type in sig:
                if not any(field["type"] == sig_type for field in profile["fields"].values()):
                    type_matches = False
                    break
            if type_matches:
                signature_matches = True
                break

        if signature_matches:
            description = (shell.description or "").replace(r"\s+", " ").strip()
            compatible_shells.append(
                {"id": shell_id, "label": f"{shell_id}: {description}" if description else shell_id}
            )

    return {
        "type": "function",
        "function": {
            "name": "choose_shell",
            "description": "Select the most appropriate visualization shell for the user request.",
            "parameters": {
                "type": "object",
                "properties": {
                    "shellId": {
                        "type": "string",
                        "enum": [s["id"] for s in compatible_shells],
                        "description": "\n".join(s["label"] for s in compatible_shells),
                    }
                },
                "required": ["shellId"],
                "additionalProperties": False,
            },
        },
    }


def build_fill_shell_params_tool(shell: Dict[str, Any], profile: DatasetProfile) -> Dict[str, Any]:
    """
    Build a tool for filling parameters for the selected visualization shell.
    """
    properties: Dict[str, Any] = {}
    required: List[str] = []

    def fields_for_type(expected_type: str) -> List[str]:
        """Get all field names of a specific type from the profile."""
        if expected_type == "any":
            return list(profile["fields"].keys())

        if expected_type == "temporal":
            return [name for name, meta in profile["fields"].items() if meta["type"] == "temporal"]

        return [name for name, meta in profile["fields"].items() if meta["type"] == expected_type]

    # Process required encodings
    print(shell)
    for encoding, spec in (shell.required or {}).items():
        if is_encoding_spec(spec):
            # Skip if it's an aggregate string (e.g., "count")
            if isinstance(spec.get("aggregate"), str):
                continue

            fields = fields_for_type(spec["type"])
            if fields:
                if encoding == "values":
                    properties[encoding] = {"type": "array", "items": {"type": "string", "enum": fields}, "minItems": 2}
                else:
                    properties[encoding] = {"type": "string", "enum": fields}
                    required.append(encoding)

    # Process optional encodings
    for encoding, spec in (shell.optional or {}).items():
        if is_encoding_spec(spec):
            fields = fields_for_type(spec["type"])
            if fields:
                properties[encoding] = {"type": "string", "enum": fields}

    # Add bin parameter if needed
    if has_bin(shell):
        properties["bin"] = {"type": "boolean"}

    return {
        "type": "function",
        "function": {
            "name": "fill_shell_params",
            "description": "Fill parameters for the selected visualization shell",
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
                "additionalProperties": False,
            },
        },
    }


def has_bin(shell: Dict[str, Any]) -> bool:
    """Check if the shell has any required encoding with bin=true."""
    required = shell.required or {}
    return any(isinstance(spec, dict) and spec.get("bin") is True for spec in required.values())


def is_encoding_spec(spec: Any) -> bool:
    """Check if an object is a valid encoding specification."""
    return isinstance(spec, dict) and "type" in spec and isinstance(spec["type"], str)
