import type { ShellType } from "@/modules/shells/types";
import { HeatmapCorrelationShell } from "@/modules/shells/heatmap_correlation";
import { HistogramShell } from "@/modules/shells/histogram";
import { BoxPlotShell } from "@/modules/shells/boxplot";
import { DensityShell } from "@/modules/shells//density";
import { ScatterShell } from "@/modules/shells//scatter";
import { BarCountShell } from "@/modules/shells/bar_count";
import { BarValueShell } from "./shells/bar_value";
import { BarAggregateShell } from "./shells/bar_aggregate";
import { LineTimeShell } from "./shells/line_time";
import { LineGenericShell } from "./shells/line_generic";

export const shells: Record<string, ShellType> = {
    bar_aggregate: new BarAggregateShell(),
    bar_count: new BarCountShell(),
    bar_value: new BarValueShell(),
    boxplot: new BoxPlotShell(),
    density: new DensityShell(),
    heatmap_correlation: new HeatmapCorrelationShell(),
    histogram: new HistogramShell(),
    line_generic: new LineGenericShell(),
    line_time: new LineTimeShell(),
    scatter: new ScatterShell(),
};
