from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Protocol, TypedDict, Union


# Type definitions (sorted alphabetically)
class AnalysisType(TypedDict, total=False):
    id: str
    language: "LanguageType"


CompletionsMessage = Dict[str, str]
CompletionsReply = Dict[str, Any]


class DatasetProfile(TypedDict):
    fields: Dict[str, Dict[str, Any]]
    rowCount: int


EncodingMapType = Dict[str, "EncodingSpecType"]


class EncodingSpecType(TypedDict, total=False):
    aggregate: Union[bool, str]
    bin: bool
    type: "FieldType"


class FieldInfo(TypedDict):
    cardinality: int
    type: "FieldType"


FieldType = Literal["any", "nominal", "ordinal", "quantitative", "temporal"]
LanguageType = Literal["python"]
RendererType = Literal["vega-lite"]
ShellParamsType = Dict[str, Any]

TRANSCRIPT_VARIANT = {"DATA": "data", "INFO": "info"}
TranscriptMessageType = Dict[str, Any]


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
        "unknown_shell",
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
    optional: Union[EncodingMapType, Literal["any"], None]
    required: EncodingMapType
    rowSemantics: Literal["aggregate", "rowwise"]
    signatures: List[List[FieldType]]

    # behavior
    def compile(self, params: ShellParamsType, values: List[Dict[str, Any]], renderer: RendererType) -> Any: ...

    def validate(self, params: ShellParamsType, profile: DatasetProfile) -> ValidationResult: ...


# Constants (sorted alphabetically)
VEGA_LITE_SCHEMA = "https://vega.github.io/schema/vega-lite/v5.json"
