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
class BarCountShell:
    """Bar Count shell implementation for counting occurrences."""

    # ShellType interface implementation
    analysis: Optional[AnalysisType] = None
    name: str = "Bar Count"
    description: Optional[str] = None
    signatures: List[List[FieldType]] = field(default_factory=lambda: [["nominal"], ["ordinal"], ["quantitative"]])
    required: EncodingMapType = field(default_factory=lambda: {"x": {"type": "any"}})
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

        encoding: Dict[str, Any] = {
            "x": {"field": params.get("x", ""), "type": "nominal"},
            "y": {"aggregate": "count", "type": "quantitative"},
        }

        # Add optional color encoding if provided
        if params.get("color"):
            encoding["color"] = {"field": params["color"], "type": "nominal"}

        # Add optional tooltip encoding if provided
        if params.get("tooltip"):
            encoding["tooltip"] = {"field": params["tooltip"]}

        return {"$schema": VEGA_LITE_SCHEMA, "data": {"values": values}, "encoding": encoding, "mark": {"type": "bar"}}

    def validate(self, params: ShellParamsType, profile: DatasetProfile) -> ValidationResult:
        """Validate parameters against dataset profile."""
        x_field = params.get("x")

        # Check required field is present
        if not x_field:
            return {"errors": [{"code": "missing_required_encoding"}], "ok": False, "warnings": []}

        # Check if field exists in profile
        if x_field not in profile.get("fields", {}):
            return {"errors": [{"code": "unknown_field"}], "ok": False, "warnings": []}

        return {"errors": [], "ok": True, "warnings": []}
