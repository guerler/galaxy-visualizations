from .cardinality_report import run as cardinality_report
from .compute_bins import run as compute_bins
from .correlation_matrix import run as correlation_matrix
from .group_aggregate import run as group_aggregate
from .linear_regression import run as linear_regression
from .missing_value_report import run as missing_value_report
from .pivot_long_to_wide import run as pivot_long_to_wide
from .rank_top_k import run as rank_top_k
from .select_numeric_columns import run as select_numeric_columns
from .summary_statistics import run as summary_statistics

ANALYSES = {
    "cardinality_report": cardinality_report,
    "correlation_matrix": correlation_matrix,
    "compute_bins": compute_bins,
    "group_aggregate": group_aggregate,
    "linear_regression": linear_regression,
    "missing_value_report": missing_value_report,
    "pivot_long_to_wide": pivot_long_to_wide,
    "rank_top_k": rank_top_k,
    "select_numeric_columns": select_numeric_columns,
    "summary_statistics": summary_statistics,
}


def run_analysis(analysis_id: str, dataset_path: str):
    analysis = ANALYSES.get(analysis_id)
    if analysis:
        try:
            result = analysis(dataset_path)
        except Exception as e:
            raise Exception(f"Analysis with {analysis_id} failed: {e}.")
    else:
        raise Exception(f"Unknown analysis method: {analysis_id}.")
    return result
