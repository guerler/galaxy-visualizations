from .bar_aggregate import BarAggregateShell
from .bar_count import BarCountShell
from .bar_series import BarSeriesShell
from .bar_value import BarValueShell
from .box_plot import BoxPlotShell
from .density import DensityShell
from .heatmap_correlation import HeatmapCorrelationShell
from .histogram import HistogramShell
from .line_generic import LineGenericShell
from .line_time import LineTimeShell
from .scatter import ScatterShell
from .stacked_area import StackedAreaShell

SHELLS = {
    "bar_aggregate": BarAggregateShell(),
    "bar_count": BarCountShell(),
    "bar_series": BarSeriesShell(),
    "bar_value": BarValueShell(),
    "box_plot": BoxPlotShell(),
    "density": DensityShell(),
    "heatmap_correlation": HeatmapCorrelationShell(),
    "histogram": HistogramShell(),
    "line_generic": LineGenericShell(),
    "line_time": LineTimeShell(),
    "scatter": ScatterShell(),
    "stacked_area": StackedAreaShell(),
}
