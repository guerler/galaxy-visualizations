import type { ShellType } from "@/modules/shells/types";
import { HeatmapCorrelationShell } from "@/modules/shells/heatmap-correlation";
import { HistogramShell } from "@/modules/shells/histogram";
import { BoxPlotShell } from "@/modules/shells/boxplot";
import { DensityShell } from "@/modules/shells/density";
import { ScatterShell } from "@/modules/shells/scatter";
import { BarCountShell } from "@/modules/shells/bar-count";
import { BarSeriesShell } from "./shells/bar-series";
import { BarValueShell } from "./shells/bar-value";
import { BarAggregateShell } from "./shells/bar-aggregate";
import { LineTimeShell } from "./shells/line-time";
import { LineGenericShell } from "./shells/line-generic";
import { StackedAreaShell } from "./shells/stacked-area";

export const shells: Record<string, ShellType> = {
    bar_aggregate: new BarAggregateShell(),
    bar_count: new BarCountShell(),
    bar_series: new BarSeriesShell(),
    bar_value: new BarValueShell(),
    boxplot: new BoxPlotShell(),
    density: new DensityShell(),
    heatmap_correlation: new HeatmapCorrelationShell(),
    histogram: new HistogramShell(),
    line_generic: new LineGenericShell(),
    line_time: new LineTimeShell(),
    scatter: new ScatterShell(),
    stacked_area: new StackedAreaShell(),
};
