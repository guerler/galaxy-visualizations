from .correlation_matrix import run as correlation_matrix

PYTHON_ANALYSES = {
    "correlation_matrix": correlation_matrix,
}


async def runAnalysis(analysisId: str, datasetPath="dataset.csv"):
    analysis = PYTHON_ANALYSES.get(analysisId)
    if not analysis:
        raise Exception("Invalid analysis")
    return await analysis(datasetPath)
