from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Union

from ..schemas import (
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
class ScatterShell:
    """Scatter Plot shell implementation for visualizing relationships between two quantitative variables."""

    # ShellType interface implementation
    analysis: Optional[AnalysisType] = None
    name: str = "Scatter Plot"
    description: Optional[str] = None
    signatures: List[List[FieldType]] = field(default_factory=lambda: [["quantitative", "quantitative"]])
    required: EncodingMapType = field(
        default_factory=lambda: {"x": {"type": "quantitative"}, "y": {"type": "quantitative"}}
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
            "x": {"field": params.get("x", ""), "type": "quantitative"},
            "y": {"field": params.get("y", ""), "type": "quantitative"},
        }

        # Add optional color encoding if provided
        if params.get("color"):
            encoding["color"] = {"field": params["color"], "type": "nominal"}

        # Add optional tooltip encoding if provided
        if params.get("tooltip"):
            encoding["tooltip"] = {"field": params["tooltip"]}

        return {
            "$schema": VEGA_LITE_SCHEMA,
            "data": {"values": values},
            "encoding": encoding,
            "mark": {"type": "point"},
        }

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

        # Check if both fields are quantitative
        x_type = x_meta.get("type")
        y_type = y_meta.get("type")

        if x_type != "quantitative" or y_type != "quantitative":
            return {
                "errors": [
                    {
                        "code": "invalid_field_type",
                        "details": {
                            "actual": {"x": x_type, "y": y_type},
                            "expected": {"x": "quantitative", "y": "quantitative"},
                        },
                    }
                ],
                "ok": False,
                "warnings": [],
            }

        return {"errors": [], "ok": True, "warnings": []}
