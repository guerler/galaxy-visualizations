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
class HeatmapCorrelationShell:
    """Correlation Heatmap shell implementation for visualizing correlation matrices."""

    # ShellType interface implementation
    analysis: Optional[AnalysisType] = field(default_factory=lambda: {"language": "python", "id": "correlation_matrix"})
    name: str = "Correlation Heatmap"
    description: Optional[str] = None
    signatures: List[List[FieldType]] = field(default_factory=lambda: [["quantitative", "quantitative"]])
    required: EncodingMapType = field(default_factory=dict)  # Empty dict
    optional: Union[EncodingMapType, Literal["any"], None] = field(default_factory=dict)  # Empty dict
    rowSemantics: Literal["rowwise", "aggregate"] = "aggregate"

    def compile(
        self, params: ShellParamsType, values: List[Dict[str, Any]], renderer: RendererType = "vega-lite"
    ) -> Dict[str, Any]:
        """Compile shell parameters into a Vega-Lite specification."""
        if renderer != "vega-lite":
            raise ValueError("Unsupported renderer")

        # Note: This shell expects pre-computed correlation data
        # The values should already be in "long" format with columns: x, y, value
        return {
            "$schema": VEGA_LITE_SCHEMA,
            "data": {"values": values},
            "encoding": {
                "x": {"field": "x", "type": "nominal"},
                "y": {"field": "y", "type": "nominal"},
                "color": {
                    "aggregate": "mean",
                    "field": "value",
                    "type": "quantitative",
                    "scale": {"scheme": "redblue", "domain": [-1, 1]},
                },
                "tooltip": [
                    {"field": "x", "type": "nominal"},
                    {"field": "y", "type": "nominal"},
                    {"field": "value", "type": "quantitative", "format": ".2f"},
                ],
            },
            "mark": {"type": "rect"},
        }

    def validate(self, params: ShellParamsType, profile: DatasetProfile) -> ValidationResult:
        """Validate parameters against dataset profile."""
        # Count quantitative fields
        quantitative_count = 0
        for field_info in profile.get("fields", {}).values():
            if field_info.get("type") == "quantitative":
                quantitative_count += 1

        # Need at least 2 quantitative fields for correlation
        if quantitative_count < 2:
            return {"errors": [{"code": "not_enough_quantitative_fields"}], "ok": False, "warnings": []}

        return {"errors": [], "ok": True, "warnings": []}
