import select_numeric_columns from "@/python/select_numeric_columns.py?raw";
import missing_value_report from "@/python/missing_value_report.py?raw";
import cardinality_report from "@/python/cardinality_report.py?raw";
import summary_statistics from "@/python/summary_statistics.py?raw";
import correlation_matrix from "@/python/correlation_matrix.py?raw";
import linear_regression from "@/python/linear_regression.py?raw";
import group_aggregate from "@/python/group_aggregate.py?raw";
import rank_top_k from "@/python/rank_top_k.py?raw";
import compute_bins from "@/python/compute_bins.py?raw";
import pivot_long_to_wide from "@/python/pivot_long_to_wide.py?raw";

const PYTHON_ANALYSES: Record<string, string> = {
    select_numeric_columns,
    missing_value_report,
    cardinality_report,
    summary_statistics,
    correlation_matrix,
    linear_regression,
    group_aggregate,
    rank_top_k,
    compute_bins,
    pivot_long_to_wide,
};

export async function runShellAnalysis(
    pyodide: any,
    analysisId: string,
    datasetPath = "dataset.csv",
): Promise<Record<string, unknown>[]> {
    const analysis = PYTHON_ANALYSES[analysisId];
    if (analysis) {
        const code = `${analysis}run("${datasetPath}")`;
        const result = await pyodide.runPythonAsync(code);
        const jsResult = result.toJs({ dict_converter: Object.fromEntries });
        result.destroy();
        if (!Array.isArray(jsResult)) {
            throw new Error("Python analysis did not return array");
        }
        return jsResult as Record<string, unknown>[];
    } else {
        throw new Error(`Unknown analysis: ${analysisId}`);
    }
}
