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
class LineTimeShell:
    """Trend Line shell implementation specifically for time series data."""

    # ShellType interface implementation
    analysis: Optional[AnalysisType] = None
    name: str = "Trend Line"
    description: Optional[str] = None
    signatures: List[List[FieldType]] = field(default_factory=lambda: [["temporal", "quantitative"]])
    required: EncodingMapType = field(
        default_factory=lambda: {"x": {"type": "temporal"}, "y": {"type": "quantitative"}}
    )
    optional: Union[EncodingMapType, Literal["any"], None] = field(
        default_factory=lambda: {"color": {"type": "nominal"}, "tooltip": {"type": "any"}}
    )
    rowSemantics: Literal["rowwise", "aggregate"] = "rowwise"

    def compile(
        self, params: ShellParamsType, values: List[Dict[str, Any]], renderer: RendererType = "vega-lite"
    ) -> Dict[str, Any]:
        """Compile shell parameters into a Vega-Lite specification."""
        if renderer != "vega-lite":
            raise ValueError("Unsupported renderer")

        # Build base encoding
        encoding: Dict[str, Any] = {
            "x": {"field": params.get("x", ""), "type": "temporal"},
            "y": {"field": params.get("y", ""), "type": "quantitative"},
        }

        # Add optional color encoding if provided
        if params.get("color"):
            encoding["color"] = {"field": params["color"], "type": "nominal"}

        # Add optional tooltip encoding if provided
        if params.get("tooltip"):
            encoding["tooltip"] = {"field": params["tooltip"]}

        return {"$schema": VEGA_LITE_SCHEMA, "data": {"values": values}, "encoding": encoding, "mark": {"type": "line"}}

    def validate(self, params: ShellParamsType, profile: DatasetProfile) -> ValidationResult:
        """Validate parameters against dataset profile."""
        x_field = params.get("x")
        y_field = params.get("y")

        # Check required fields are present
        if not x_field or not y_field:
            return {"errors": [{"code": "missing_required_encoding"}], "ok": False, "warnings": []}

        # Check if fields exist in profile
        x_meta = profile.get("fields", {}).get(x_field)
        y_meta = profile.get("fields", {}).get(y_field)

        if not x_meta or not y_meta:
            return {"errors": [{"code": "unknown_field"}], "ok": False, "warnings": []}

        # Check if x field is temporal
        if x_meta.get("type") != "temporal":
            return {
                "errors": [
                    {
                        "code": "invalid_field_type",
                        "details": {
                            "actual": x_meta.get("type"),
                            "encoding": "x",
                            "expected": "temporal",
                            "field": x_field,
                        },
                    }
                ],
                "ok": False,
                "warnings": [],
            }

        # Check if y field is quantitative
        if y_meta.get("type") != "quantitative":
            return {
                "errors": [
                    {
                        "code": "invalid_field_type",
                        "details": {
                            "actual": y_meta.get("type"),
                            "encoding": "y",
                            "expected": "quantitative",
                            "field": y_field,
                        },
                    }
                ],
                "ok": False,
                "warnings": [],
            }

        return {"errors": [], "ok": True, "warnings": []}
