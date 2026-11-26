import { BarChart, FunnelChart, HeatmapChart, LineChart, PieChart, ScatterChart, TreemapChart } from "echarts/charts";
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  HeatmapChart,
  FunnelChart,
  TreemapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  VisualMapComponent,
  TitleComponent,
  ToolboxComponent,
  AriaComponent,
  CanvasRenderer,
]);

export const PALETTE = ["#141c52", "#008ae0", "#3fcce3", "#5bc500", "#c0e021", "#44437f", "#ffc844", "#d31205", "#8a90b8", "#00748f"];

echarts.registerTheme("entreprise", {
  color: PALETTE,
  backgroundColor: "transparent",
  textStyle: { fontFamily: '"Noto Sans Variable", "Noto Sans", system-ui, sans-serif', color: "#4f6b78" },
  categoryAxis: { axisLine: { lineStyle: { color: "#cddeef" } }, axisTick: { show: false }, axisLabel: { color: "#4f6b78" }, splitLine: { show: false } },
  valueAxis: { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#4f6b78" }, splitLine: { lineStyle: { color: "#e3ecf5" } } },
  legend: { textStyle: { color: "#003d4c" }, icon: "roundRect", itemWidth: 10, itemHeight: 10 },
  tooltip: {
    backgroundColor: "#ffffff",
    borderColor: "#cddeef",
    borderWidth: 1,
    textStyle: { color: "#003d4c", fontSize: 12 },
    extraCssText: "box-shadow:0 8px 24px rgba(20,28,82,.16);border-radius:10px;padding:10px 12px;",
  },
});

export { echarts };
