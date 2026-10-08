'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Chart tokens: one brand hue for single-series charts; recessive hairline grid; text in ink tokens.
const SERIES_COLOR = '#722F37';
const GRID_COLOR = '#E7E3DF';
const AXIS_TEXT = '#78716C';

interface ColumnChartProps {
  // Recharts reads rows by key, so any plain object row works.
  data: object[];
  xKey: string;
  yKey: string;
  /** Formats the value shown in the tooltip. */
  formatValue?: (value: number) => string;
  formatLabel?: (label: string) => string;
  /** Show every Nth x tick to avoid collisions on dense axes. */
  tickInterval?: number | 'preserveStartEnd';
  layout?: 'vertical' | 'horizontal';
  height?: number;
  valueLabel: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
  formatLabel,
  valueLabel,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
  formatValue?: (value: number) => string;
  formatLabel?: (label: string) => string;
  valueLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const raw = Number(payload[0].value ?? 0);
  const text = String(label ?? '');

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-raised">
      <p className="font-medium text-ink">{formatLabel ? formatLabel(text) : text}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-ink-muted">
        <span className="size-2 rounded-sm" style={{ backgroundColor: SERIES_COLOR }} aria-hidden="true" />
        {valueLabel}: <span className="tabular font-semibold text-ink">{formatValue ? formatValue(raw) : raw.toLocaleString()}</span>
      </p>
    </div>
  );
}

export function ColumnChart({
  data,
  xKey,
  yKey,
  formatValue,
  formatLabel,
  tickInterval = 'preserveStartEnd',
  layout = 'horizontal',
  height = 260,
  valueLabel,
}: ColumnChartProps) {
  const isBars = layout === 'vertical';

  return (
    <div style={{ height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={layout}
          margin={{ top: 8, right: isBars ? 16 : 4, bottom: 0, left: isBars ? 0 : -16 }}
          barCategoryGap={isBars ? 6 : 2}
        >
          <CartesianGrid stroke={GRID_COLOR} strokeWidth={1} vertical={isBars} horizontal={!isBars} />
          {isBars ? (
            <>
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT, fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey={xKey}
                width={132}
                tickLine={false}
                axisLine={false}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                tickFormatter={(value: string) => (value.length > 18 ? `${value.slice(0, 17)}…` : value)}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                interval={tickInterval}
                tickFormatter={formatLabel}
                minTickGap={8}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT, fontSize: 12 }} width={48} />
            </>
          )}
          <Tooltip
            cursor={{ fill: 'rgb(114 47 55 / 0.06)' }}
            content={<ChartTooltip formatValue={formatValue} formatLabel={formatLabel} valueLabel={valueLabel} />}
          />
          <Bar
            dataKey={yKey}
            fill={SERIES_COLOR}
            maxBarSize={24}
            radius={isBars ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
