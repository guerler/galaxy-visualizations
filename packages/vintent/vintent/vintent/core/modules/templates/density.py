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
class DensityShell:
    """Density Plot shell implementation for visualizing probability density."""

    # ShellType interface implementation
    analysis: Optional[AnalysisType] = None
    name: str = "Density Plot"
    description: Optional[str] = None
    signatures: List[List[FieldType]] = field(default_factory=lambda: [["quantitative"]])
    required: EncodingMapType = field(default_factory=lambda: {"x": {"type": "quantitative"}})
    optional: Union[EncodingMapType, Literal["any"], None] = field(
        default_factory=lambda: {"color": {"type": "nominal"}, "tooltip": {"type": "any"}}
    )
    rowSemantics: Literal["rowwise", "aggregate"] = "aggregate"

    def compile(
        self, params: ShellParamsType, values: List[Dict[str, Any]], renderer: RendererType = "vega-lite"
    ) -> Dict[str, Any]:
        """Compile shell parameters into a Vega-Lite specification."""
        if renderer != "vega-lite":
            raise ValueError("Unsupported renderer")

        # Build base encoding - note: uses transformed fields
        encoding: Dict[str, Any] = {
            "x": {"field": "value", "type": "quantitative"},
            "y": {"field": "density", "type": "quantitative"},
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
            "mark": {"type": "area"},
            "transform": [{"density": params.get("x", ""), "as": ["value", "density"]}],
        }

    def validate(self, params: ShellParamsType, profile: DatasetProfile) -> ValidationResult:
        """Validate parameters against dataset profile."""
        x_field = params.get("x")

        # Check required field is present
        if not x_field:
            return {"errors": [{"code": "missing_required_encoding"}], "ok": False, "warnings": []}

        # Check if field exists in profile
        x_meta = profile.get("fields", {}).get(x_field)
        if not x_meta:
            return {"errors": [{"code": "unknown_field"}], "ok": False, "warnings": []}

        # Check if field is quantitative
        if x_meta.get("type") != "quantitative":
            return {
                "errors": [
                    {
                        "code": "invalid_field_type",
                        "details": {
                            "actual": x_meta.get("type"),
                            "encoding": "x",
                            "expected": "quantitative",
                            "field": x_field,
                        },
                    }
                ],
                "ok": False,
                "warnings": [],
            }

        return {"errors": [], "ok": True, "warnings": []}
