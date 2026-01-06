from .templates.bar_aggregate import BarAggregateShell
from .templates.bar_count import BarCountShell
from .templates.bar_series import BarSeriesShell
from .templates.bar_value import BarValueShell
from .templates.box_plot import BoxPlotShell
from .templates.density import DensityShell
from .templates.heatmap_correlation import HeatmapCorrelationShell
from .templates.histogram import HistogramShell
from .templates.line_generic import LineGenericShell
from .templates.line_time import LineTimeShell
from .templates.scatter import ScatterShell
from .templates.stacked_area import StackedAreaShell

shells = {
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
