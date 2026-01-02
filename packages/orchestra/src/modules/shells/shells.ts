import { CorrelationHeatmapShell } from "@/modules/shells/heatmap_correlation";
import { HistogramShell } from "@/modules/shells/histogram";
import type { ShellType } from "@/modules/shells/types";

export const shells: Record<string, ShellType> = {
    heatmap_correlation: new CorrelationHeatmapShell(),
    histogram: new HistogramShell(),
};
