import type { ShellType } from "@/modules/shells/types";
import { HeatmapCorrelationShell } from "@/modules/shells/heatmap_correlation";
import { HistogramShell } from "@/modules/shells/histogram";
import { BoxPlotShell } from "@/modules/shells/boxplot";
import { DensityShell } from "@/modules/shells//density";
import { ScatterShell } from "@/modules/shells//scatter";
import { BarCountShell } from "@/modules/shells/bar_count";

export const shells: Record<string, ShellType> = {
    barcount: new BarCountShell(),
    boxplot: new BoxPlotShell(),
    density: new DensityShell(),
    heatmap_correlation: new HeatmapCorrelationShell(),
    histogram: new HistogramShell(),
    scatter: new ScatterShell(),
};
