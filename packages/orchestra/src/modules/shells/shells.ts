import { CorrelationHeatmapShell } from "@/modules/shells/heatmap_correlation";
import type { ShellInterface } from "@/modules/shells/types";

export const shells: Record<string, ShellInterface> = {
    heatmap_correlation: new CorrelationHeatmapShell(),
};
