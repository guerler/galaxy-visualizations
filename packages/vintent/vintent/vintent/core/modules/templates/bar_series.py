from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Union

from .types import (
    VEGA_LITE_SCHEMA,
    AnalysisType,
    DatasetProfile,
    EncodingMapType,
    FieldType,
    RendererType,
    ShellParamsType,
    ValidationResult,
)


@dataclass
class BarSeriesShell:
    """Multi-Series Bar Chart shell implementation."""

    # ShellType interface implementation
    analysis: Optional[AnalysisType] = None
    name: str = "Multi-Series Bar Chart"
    description: str = """
        Compare multiple quantitative fields per row using grouped bars.
        Each dataset row becomes a category on the x axis.
        Each selected field becomes a colored bar within that category.
        Useful for comparing measurements side by side across records.
        Not for aggregations over categories.
    """
    signatures: List[List[FieldType]] = field(default_factory=lambda: [["quantitative"]])
    required: EncodingMapType = field(default_factory=lambda: {"values": {"type": "quantitative"}})
    optional: Union[EncodingMapType, Literal["any"], None] = field(default_factory=lambda: {"tooltip": {"type": "any"}})
    rowSemantics: Literal["rowwise", "aggregate"] = "rowwise"

    def compile(
        self, params: ShellParamsType, values: List[Dict[str, Any]], renderer: RendererType = "vega-lite"
    ) -> Dict[str, Any]:
        """Compile shell parameters into a Vega-Lite specification."""
        if renderer != "vega-lite":
            raise ValueError("Unsupported renderer")

        fields: List[str] = params.get("values", [])

        # Build the Vega-Lite specification with transformations
        spec: Dict[str, Any] = {
            "$schema": VEGA_LITE_SCHEMA,
            "data": {"values": values},
            "transform": [
                {"window": [{"op": "row_number", "as": "category"}]},
                {"fold": fields, "as": ["group", "value"]},
            ],
            "mark": "bar",
            "encoding": {
                "x": {"field": "category", "type": "ordinal"},
                "xOffset": {"field": "group", "type": "nominal"},
                "y": {"field": "value", "type": "quantitative"},
                "color": {"field": "group", "type": "nominal"},
            },
        }

        # Add optional tooltip if provided
        if params.get("tooltip"):
            spec["encoding"]["tooltip"] = {"field": params["tooltip"]}

        return spec

    def validate(self, params: ShellParamsType, profile: DatasetProfile) -> ValidationResult:
        """Validate parameters against dataset profile."""
        fields = params.get("values")

        # Check if fields is a list with at least 2 items
        if not isinstance(fields, list) or len(fields) < 2:
            return {"errors": [{"code": "not_enough_fields"}], "ok": False, "warnings": []}

        # Validate each field
        for f in fields:
            meta = profile.get("fields", {}).get(f)

            # Check if field exists
            if not meta:
                return {"errors": [{"code": "unknown_field", "details": {"field": f}}], "ok": False, "warnings": []}

            # Check if field is quantitative
            if meta.get("type") != "quantitative":
                return {
                    "errors": [
                        {
                            "code": "invalid_field_type",
                            "details": {"actual": meta.get("type"), "expected": "quantitative", "field": f},
                        }
                    ],
                    "ok": False,
                    "warnings": [],
                }

        return {"errors": [], "ok": True, "warnings": []}
