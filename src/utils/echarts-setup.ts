import * as echarts from 'echarts/core';

import {
	BarChart,
	LineChart,
	TreemapChart,
	HeatmapChart,
	ScatterChart,
	SunburstChart
} from 'echarts/charts';

import {
	TitleComponent,
	TooltipComponent,
	GridComponent,
	LegendComponent,
	DataZoomComponent,
	VisualMapComponent,
	MarkLineComponent,
	CalendarComponent
} from 'echarts/components';

import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
	TitleComponent,
	TooltipComponent,
	GridComponent,
	LegendComponent,
	DataZoomComponent,
	VisualMapComponent,
	MarkLineComponent,
	CalendarComponent,
	BarChart,
	LineChart,
	TreemapChart,
	HeatmapChart,
	ScatterChart,
	SunburstChart,
	CanvasRenderer
]);

export default echarts;
