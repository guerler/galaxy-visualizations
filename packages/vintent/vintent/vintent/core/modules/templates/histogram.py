from __future__ import annotations
from typing import TypedDict, Literal, Optional, List, Dict, Any, Protocol, Union
from dataclasses import dataclass, field

# Type definitions
FieldType = Literal["nominal", "ordinal", "quantitative", "temporal", "any"]
LanguageType = Literal["python"]
RendererType = Literal["vega-lite"]


class DatasetProfile(TypedDict):
    fields: Dict[str, Dict[str, Any]]
    rowCount: int


class AnalysisType(TypedDict, total=False):
    id: str
    language: LanguageType


class EncodingSpecType(TypedDict, total=False):
    type: FieldType
    aggregate: Union[bool, str]
    bin: bool


EncodingMapType = Dict[str, EncodingSpecType]
ShellParamsType = Dict[str, Any]


class ValidationError(TypedDict, total=False):
    code: Literal[
        "aggregate_missing",
        "bin_missing",
        "invalid_aggregate_target",
        "invalid_bin_target",
        "invalid_field_type",
        "invalid_signature",
        "missing_required_encoding",
        "not_enough_fields",
        "not_enough_quantitative_fields",
        "unknown_field",
        "unknown_shell"
    ]
    details: Dict[str, Any]


class ValidationWarning(TypedDict, total=False):
    code: Literal["high_cardinality_color", "high_cardinality_x", "large_dataset_embedded"]
    details: Dict[str, Any]


class ValidationResult(TypedDict):
    errors: List[ValidationError]
    ok: bool
    warnings: List[ValidationWarning]


# Shell interface as a Protocol
class ShellType(Protocol):
    # identity
    name: str
    
    # planning / orchestration contracts
    analysis: Optional[AnalysisType]
    description: Optional[str]
    signatures: List[List[FieldType]]
    required: EncodingMapType
    optional: Union[EncodingMapType, Literal["any"], None]
    
    # semantic declaration
    rowSemantics: Literal["rowwise", "aggregate"]
    
    # behavior
    def validate(self, params: ShellParamsType, profile: DatasetProfile) -> ValidationResult:
        ...
    
    def compile(self, params: ShellParamsType, values: List[Dict[str, Any]], 
                renderer: RendererType) -> Any:
        ...


# Constants
VEGA_LITE_SCHEMA = "https://vega.github.io/schema/vega-lite/v5.json"


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
