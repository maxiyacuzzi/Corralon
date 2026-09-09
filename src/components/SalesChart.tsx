import { useRef, useState } from 'react';
import { formatCurrency } from '../lib/format';
import { useTheme } from '../context/ThemeContext';

interface SalesChartPoint {
  date: string; // 'YYYY-MM-DD', local calendar day
  total: number;
}

interface SalesChartProps {
  data: SalesChartPoint[];
}

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 16, right: 72, bottom: 28, left: 56 };
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;
const SERIES_COLOR = '#f97316'; // orange-500, matches the app's accent

function niceNumber(value: number, round: boolean) {
  if (value === 0) return 0;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * 10 ** exponent;
}

function formatAxisValue(value: number) {
  return `$${Math.round(value).toLocaleString('es-AR')}`;
}

function formatShortDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function formatTooltipDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function SalesChart({ data }: SalesChartProps) {
  const { theme } = useTheme();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gridColor = theme === 'dark' ? '#374151' : '#e5e7eb';
  const hoverLineColor = theme === 'dark' ? '#4b5563' : '#9ca3af';

  const hasData = data.length > 0 && data.some((point) => point.total > 0);

  const rawMax = Math.max(...data.map((point) => point.total), 0);
  const step = niceNumber(rawMax / 3, true) || 1;
  const niceMax = step * 3;
  const ticks = [0, step, step * 2, step * 3];

  const xScale = (index: number) =>
    data.length <= 1 ? PADDING.left + PLOT_WIDTH / 2 : PADDING.left + (index / (data.length - 1)) * PLOT_WIDTH;
  const yScale = (value: number) => PADDING.top + PLOT_HEIGHT - (value / niceMax) * PLOT_HEIGHT;

  const linePath = data.map((point, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(point.total)}`).join(' ');
  const areaPath =
    data.length > 0
      ? `${linePath} L${xScale(data.length - 1)},${yScale(0)} L${xScale(0)},${yScale(0)} Z`
      : '';

  const labelStep = Math.max(1, Math.ceil(data.length / 6));
  const lastIndex = data.length - 1;

  function handlePointerMove(event: React.PointerEvent<SVGRectElement>) {
    if (!svgRef.current || data.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    const xSvg = fraction * WIDTH;
    const plotFraction = (xSvg - PADDING.left) / PLOT_WIDTH;
    const index = Math.round(plotFraction * (data.length - 1));
    setHoverIndex(Math.min(data.length - 1, Math.max(0, index)));
  }

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const tooltipLeftPercent = hoverIndex !== null ? Math.min(90, Math.max(10, (xScale(hoverIndex) / WIDTH) * 100) ) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Ventas de los últimos {data.length} días</h2>
        {hasData && (
          <button
            type="button"
            onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {view === 'chart' ? 'Ver tabla' : 'Ver gráfico'}
          </button>
        )}
      </div>

      {!hasData ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Sin ventas registradas en este período.</p>
      ) : view === 'table' ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.date} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
                  <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{formatTooltipDate(point.date)}</td>
                  <td className="py-2 text-gray-900 dark:text-white">{formatCurrency(point.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full h-auto"
            role="img"
            aria-label={`Gráfico de ventas diarias de los últimos ${data.length} días`}
            onPointerLeave={() => setHoverIndex(null)}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PADDING.left}
                  x2={WIDTH - PADDING.right}
                  y1={yScale(tick)}
                  y2={yScale(tick)}
                  stroke={gridColor}
                  strokeWidth={1}
                />
                <text x={PADDING.left - 8} y={yScale(tick)} textAnchor="end" dominantBaseline="middle" className="fill-gray-500 dark:fill-gray-400" fontSize={10}>
                  {formatAxisValue(tick)}
                </text>
              </g>
            ))}

            {data.map((point, i) =>
              i % labelStep === 0 || i === lastIndex ? (
                <text
                  key={point.date}
                  x={xScale(i)}
                  y={PADDING.top + PLOT_HEIGHT + 18}
                  textAnchor="middle"
                  className="fill-gray-500 dark:fill-gray-400"
                  fontSize={10}
                >
                  {formatShortDate(point.date)}
                </text>
              ) : null,
            )}

            <path d={areaPath} fill={SERIES_COLOR} fillOpacity={0.1} stroke="none" />
            <path d={linePath} fill="none" stroke={SERIES_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            <circle cx={xScale(lastIndex)} cy={yScale(data[lastIndex].total)} r={6} className="fill-white dark:fill-gray-800" />
            <circle cx={xScale(lastIndex)} cy={yScale(data[lastIndex].total)} r={4} fill={SERIES_COLOR} />
            <text
              x={xScale(lastIndex) + 8}
              y={yScale(data[lastIndex].total)}
              dominantBaseline="middle"
              className="fill-gray-600 dark:fill-gray-300"
              fontSize={11}
            >
              {formatCurrency(data[lastIndex].total)}
            </text>

            {hovered && hoverIndex !== null && (
              <g>
                <line
                  x1={xScale(hoverIndex)}
                  x2={xScale(hoverIndex)}
                  y1={PADDING.top}
                  y2={PADDING.top + PLOT_HEIGHT}
                  stroke={hoverLineColor}
                  strokeWidth={1}
                />
                <circle cx={xScale(hoverIndex)} cy={yScale(hovered.total)} r={6} className="fill-white dark:fill-gray-800" />
                <circle cx={xScale(hoverIndex)} cy={yScale(hovered.total)} r={4} fill={SERIES_COLOR} />
              </g>
            )}

            <rect
              x={PADDING.left}
              y={PADDING.top}
              width={PLOT_WIDTH}
              height={PLOT_HEIGHT}
              fill="transparent"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoverIndex(null)}
            />
          </svg>

          {hovered && (
            <div
              className="pointer-events-none absolute top-0 -translate-y-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-xs shadow-lg"
              style={{ left: `${tooltipLeftPercent}%`, transform: 'translate(-50%, -100%)' }}
            >
              <p className="text-gray-500 dark:text-gray-400 capitalize">{formatTooltipDate(hovered.date)}</p>
              <p className="text-gray-900 dark:text-white font-medium">{formatCurrency(hovered.total)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
