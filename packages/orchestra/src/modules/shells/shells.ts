import { CorrelationHeatmapShell } from "@/modules/shells/heatmap_correlation";
import type { ShellType } from "@/modules/shells/types";

export const shells: Record<string, ShellType> = {
    heatmap_correlation: new CorrelationHeatmapShell(),
};
