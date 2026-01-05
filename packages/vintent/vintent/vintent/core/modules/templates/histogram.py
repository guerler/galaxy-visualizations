from __future__ import annotations
from typing import TypedDict, Literal, Optional, List, Dict, Any, Protocol, Union
from dataclasses import dataclass, field

from .types import VEGA_LITE_SCHEMA, FieldType, RendererType, DatasetProfile, AnalysisType, EncodingMapType, ShellParamsType, ValidationResult, ShellType

@dataclass
class HistogramShell:
    """Histogram shell implementation."""
    
    # ShellType interface implementation
    analysis: Optional[AnalysisType] = None
    name: str = "Histogram"
    description: Optional[str] = None
    signatures: List[List[FieldType]] = field(default_factory=lambda: [["quantitative"]])
    required: EncodingMapType = field(default_factory=lambda: {
        "x": {"bin": True, "type": "quantitative"},
        "y": {"aggregate": "count", "type": "quantitative"}
    })
    optional: Union[EncodingMapType, Literal["any"], None] = field(default_factory=lambda: {
        "tooltip": {"type": "any"}
    })
    rowSemantics: Literal["rowwise", "aggregate"] = "aggregate"
    
    def compile(self, params: ShellParamsType, 
                values: List[Dict[str, Any]], 
                renderer: RendererType = "vega-lite") -> Dict[str, Any]:
        """Compile shell parameters into a Vega-Lite specification."""
        if renderer != "vega-lite":
            raise ValueError("Unsupported renderer")
        
        x_field = params.get("x", "")
        
        return {
            "$schema": VEGA_LITE_SCHEMA,
            "data": {"values": values},
            "encoding": {
                "x": {
                    "bin": True,
                    "field": x_field,
                    "type": "quantitative"
                },
                "y": {
                    "aggregate": "count",
                    "type": "quantitative"
                }
            },
            "mark": {"type": "bar"}
        }
    
    def validate(self, params: ShellParamsType, 
                 profile: DatasetProfile) -> ValidationResult:
        """Validate parameters against dataset profile."""
        # Count quantitative fields
        quantitative_count = 0
        for field_info in profile.get("fields", {}).values():
            if field_info.get("type") == "quantitative":
                quantitative_count += 1
        
        if quantitative_count < 1:
            return {
                "errors": [{"code": "not_enough_quantitative_fields"}],
                "ok": False,
                "warnings": []
            }
        
        return {
            "errors": [],
            "ok": True,
            "warnings": []
        }
