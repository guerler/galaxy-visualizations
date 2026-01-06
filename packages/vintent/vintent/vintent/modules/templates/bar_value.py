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
class BarValueShell:
    """Bar Values shell implementation for visualizing individual quantitative values."""

    # ShellType interface implementation
    analysis: Optional[AnalysisType] = None
    name: str = "Bar Values"
    description: Optional[str] = None
    signatures: List[List[FieldType]] = field(default_factory=lambda: [["quantitative"]])
    required: EncodingMapType = field(default_factory=lambda: {"y": {"type": "quantitative"}})
    optional: Union[EncodingMapType, Literal["any"], None] = field(default_factory=lambda: {"tooltip": {"type": "any"}})
    rowSemantics: Literal["rowwise", "aggregate"] = "rowwise"

    def compile(
        self, params: ShellParamsType, values: List[Dict[str, Any]], renderer: RendererType = "vega-lite"
    ) -> Dict[str, Any]:
        """Compile shell parameters into a Vega-Lite specification."""
        if renderer != "vega-lite":
            raise ValueError("Unsupported renderer")

        # Build base encoding
        encoding: Dict[str, Any] = {
            "x": {"aggregate": "count", "type": "ordinal"},
            "y": {"field": params.get("y", ""), "type": "quantitative"},
        }

        # Add optional tooltip if provided
        if params.get("tooltip"):
            encoding["tooltip"] = {"field": params["tooltip"]}

        return {"$schema": VEGA_LITE_SCHEMA, "data": {"values": values}, "encoding": encoding, "mark": {"type": "bar"}}

    def validate(self, params: ShellParamsType, profile: DatasetProfile) -> ValidationResult:
        """Validate parameters against dataset profile."""
        y_field = params.get("y")

        # Check required field is present
        if not y_field:
            return {"errors": [{"code": "missing_required_encoding"}], "ok": False, "warnings": []}

        # Check if field exists in profile
        y_meta = profile.get("fields", {}).get(y_field)
        if not y_meta:
            return {"errors": [{"code": "unknown_field"}], "ok": False, "warnings": []}

        # Check if field is quantitative
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
