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
class StackedAreaShell:
    """Stacked Area Chart shell implementation for visualizing composition over time/categories."""

    # ShellType interface implementation
    analysis: Optional[AnalysisType] = None
    name: str = "Stacked Area Chart"
    description: Optional[str] = None
    signatures: List[List[FieldType]] = field(
        default_factory=lambda: [["ordinal", "quantitative", "nominal"], ["temporal", "quantitative", "nominal"]]
    )
    required: EncodingMapType = field(
        default_factory=lambda: {"color": {"type": "nominal"}, "x": {"type": "any"}, "y": {"type": "quantitative"}}
    )
    optional: Union[EncodingMapType, Literal["any"], None] = field(default_factory=lambda: {"tooltip": {"type": "any"}})
    rowSemantics: Literal["rowwise", "aggregate"] = "rowwise"

    def compile(
        self, params: ShellParamsType, values: List[Dict[str, Any]], renderer: RendererType = "vega-lite"
    ) -> Dict[str, Any]:
        """Compile shell parameters into a Vega-Lite specification."""
        if renderer != "vega-lite":
            raise ValueError("Unsupported renderer")

        # Build base encoding with stacking
        encoding: Dict[str, Any] = {
            "color": {"field": params.get("color", ""), "type": "nominal"},
            "x": {"field": params.get("x", "")},
            "y": {"aggregate": "sum", "field": params.get("y", ""), "stack": "zero", "type": "quantitative"},
        }

        # Add optional tooltip if provided
        if params.get("tooltip"):
            encoding["tooltip"] = {"field": params["tooltip"]}

        return {"$schema": VEGA_LITE_SCHEMA, "data": {"values": values}, "encoding": encoding, "mark": {"type": "area"}}

    def validate(self, params: ShellParamsType, profile: DatasetProfile) -> ValidationResult:
        """Validate parameters against dataset profile."""
        color_field = params.get("color")
        x_field = params.get("x")
        y_field = params.get("y")

        # Check all required fields are present
        if not x_field or not y_field or not color_field:
            return {"errors": [{"code": "missing_required_encoding"}], "ok": False, "warnings": []}

        # Check if fields exist in profile
        x_meta = profile.get("fields", {}).get(x_field)
        y_meta = profile.get("fields", {}).get(y_field)
        c_meta = profile.get("fields", {}).get(color_field)

        if not x_meta or not y_meta or not c_meta:
            return {"errors": [{"code": "unknown_field"}], "ok": False, "warnings": []}

        # Check if y field is quantitative
        if y_meta.get("type") != "quantitative":
            return {
                "errors": [
                    {
                        "code": "invalid_field_type",
                        "details": {"encoding": "y", "expected": "quantitative", "field": y_field},
                    }
                ],
                "ok": False,
                "warnings": [],
            }

        # Check if color field is nominal or ordinal
        c_type = c_meta.get("type")
        if c_type not in ["nominal", "ordinal"]:
            return {
                "errors": [
                    {
                        "code": "invalid_field_type",
                        "details": {"encoding": "color", "expected": ["nominal", "ordinal"], "field": color_field},
                    }
                ],
                "ok": False,
                "warnings": [],
            }

        return {"errors": [], "ok": True, "warnings": []}
