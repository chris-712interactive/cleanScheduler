'use client';

import { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import statesTopology from 'us-atlas/states-10m.json';
import {
  OUTREACH_HEAT_METRIC_LABEL,
  OUTREACH_HEAT_METRICS,
  heatValueForMetric,
  type OutreachGeoAggregate,
  type OutreachHeatMetric,
  type OutreachStateMetric,
} from '@/lib/admin/outreachGeoMetrics';
import { formatOutreachRate } from '@/lib/admin/outreachDisplay';
import styles from '@/app/admin/outreach/outreach.module.scss';

type Props = {
  data: OutreachGeoAggregate;
  title?: string;
  description?: string;
};

type HoverInfo = {
  metric: OutreachStateMetric;
  x: number;
  y: number;
};

function stateCodeFromGeo(geo: {
  id?: string | number;
  properties?: { name?: string };
}): string | null {
  const name = geo.properties?.name?.trim();
  if (!name) return null;
  // Match by full state name from us-atlas
  const entries: Record<string, string> = {
    Alabama: 'AL',
    Alaska: 'AK',
    Arizona: 'AZ',
    Arkansas: 'AR',
    California: 'CA',
    Colorado: 'CO',
    Connecticut: 'CT',
    Delaware: 'DE',
    'District of Columbia': 'DC',
    Florida: 'FL',
    Georgia: 'GA',
    Hawaii: 'HI',
    Idaho: 'ID',
    Illinois: 'IL',
    Indiana: 'IN',
    Iowa: 'IA',
    Kansas: 'KS',
    Kentucky: 'KY',
    Louisiana: 'LA',
    Maine: 'ME',
    Maryland: 'MD',
    Massachusetts: 'MA',
    Michigan: 'MI',
    Minnesota: 'MN',
    Mississippi: 'MS',
    Missouri: 'MO',
    Montana: 'MT',
    Nebraska: 'NE',
    Nevada: 'NV',
    'New Hampshire': 'NH',
    'New Jersey': 'NJ',
    'New Mexico': 'NM',
    'New York': 'NY',
    'North Carolina': 'NC',
    'North Dakota': 'ND',
    Ohio: 'OH',
    Oklahoma: 'OK',
    Oregon: 'OR',
    Pennsylvania: 'PA',
    'Rhode Island': 'RI',
    'South Carolina': 'SC',
    'South Dakota': 'SD',
    Tennessee: 'TN',
    Texas: 'TX',
    Utah: 'UT',
    Vermont: 'VT',
    Virginia: 'VA',
    Washington: 'WA',
    'West Virginia': 'WV',
    Wisconsin: 'WI',
    Wyoming: 'WY',
    'Puerto Rico': 'PR',
  };
  return entries[name] ?? null;
}

function lerpColor(t: number): string {
  // Slate muted → brand teal (approx brand primary #0f766e family)
  const clamped = Math.max(0, Math.min(1, t));
  const from = { r: 226, g: 232, b: 240 }; // slate-200-ish
  const to = { r: 15, g: 118, b: 110 }; // teal-700-ish
  const r = Math.round(from.r + (to.r - from.r) * clamped);
  const g = Math.round(from.g + (to.g - from.g) * clamped);
  const b = Math.round(from.b + (to.b - from.b) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

function formatMetricValue(row: OutreachStateMetric, metric: OutreachHeatMetric): string {
  if (metric === 'openRate') return formatOutreachRate(row.opened, row.sent);
  if (metric === 'bounceRate') return formatOutreachRate(row.bounced, row.sent);
  if (metric === 'delivered') return String(row.delivered);
  return String(row.sent);
}

export function OutreachUsHeatMap({
  data,
  title = 'Where we’ve emailed',
  description = 'State heat map from recipient State fields. Toggle the metric to recolor the map.',
}: Props) {
  const [metric, setMetric] = useState<OutreachHeatMetric>('sent');
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const byCode = useMemo(() => {
    const map = new Map<string, OutreachStateMetric>();
    for (const row of data.states) map.set(row.state, row);
    return map;
  }, [data.states]);

  const maxValue = useMemo(() => {
    const values = data.states.map((s) => heatValueForMetric(s, metric));
    return Math.max(0, ...values);
  }, [data.states, metric]);

  const ranked = useMemo(() => {
    return [...data.states]
      .filter((s) => heatValueForMetric(s, metric) > 0 || s.sent > 0)
      .sort(
        (a, b) =>
          heatValueForMetric(b, metric) - heatValueForMetric(a, metric) ||
          b.sent - a.sent ||
          a.state.localeCompare(b.state),
      )
      .slice(0, 8);
  }, [data.states, metric]);

  const hasMapData = data.states.some((s) => s.recipientCount > 0);
  const empty = !hasMapData && !data.unknown;

  return (
    <section className={styles.heatMapCard} aria-label={title}>
      <div className={styles.heatMapHeader}>
        <div>
          <h2 className={styles.heatMapTitle}>{title}</h2>
          <p className={styles.heatMapDescription}>{description}</p>
        </div>
        <div className={styles.heatMetricToggle} role="group" aria-label="Heat map metric">
          {OUTREACH_HEAT_METRICS.map((key) => (
            <button
              key={key}
              type="button"
              className={metric === key ? styles.heatMetricActive : styles.heatMetricButton}
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
            >
              {OUTREACH_HEAT_METRIC_LABEL[key]}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <p className={styles.muted}>
          No recipient states to map yet. Import contacts with a State column.
        </p>
      ) : (
        <div className={styles.heatMapBody}>
          <div className={styles.heatMapCanvas}>
            <ComposableMap
              projection="geoAlbersUsa"
              projectionConfig={{ scale: 1000 }}
              width={800}
              height={500}
              style={{ width: '100%', height: 'auto' }}
            >
              <Geographies geography={statesTopology}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const code = stateCodeFromGeo(geo);
                    const row = code ? byCode.get(code) : undefined;
                    const value = row ? heatValueForMetric(row, metric) : 0;
                    const intensity = maxValue > 0 ? value / maxValue : 0;
                    const fill =
                      row && (row.sent > 0 || row.recipientCount > 0)
                        ? lerpColor(Math.max(0.12, intensity))
                        : 'var(--color-surface-muted, #e2e8f0)';

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="var(--color-border, #cbd5e1)"
                        strokeWidth={0.6}
                        style={{
                          default: { outline: 'none' },
                          hover: { outline: 'none', cursor: row ? 'pointer' : 'default' },
                          pressed: { outline: 'none' },
                        }}
                        onMouseEnter={(event) => {
                          if (!row) {
                            setHover(null);
                            return;
                          }
                          setHover({
                            metric: row,
                            x: event.clientX,
                            y: event.clientY,
                          });
                        }}
                        onMouseMove={(event) => {
                          if (!row) return;
                          setHover({
                            metric: row,
                            x: event.clientX,
                            y: event.clientY,
                          });
                        }}
                        onMouseLeave={() => setHover(null)}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>

            <div className={styles.heatLegend} aria-hidden>
              <span>Low</span>
              <span className={styles.heatLegendBar} />
              <span>High ({OUTREACH_HEAT_METRIC_LABEL[metric]})</span>
            </div>
          </div>

          <aside className={styles.heatMapSidebar}>
            <h3 className={styles.heatSidebarTitle}>Top states</h3>
            {ranked.length ? (
              <ol className={styles.heatStateList}>
                {ranked.map((row) => (
                  <li key={row.state}>
                    <span className={styles.heatStateName}>
                      {row.label} ({row.state})
                    </span>
                    <span className={styles.heatStateValue}>{formatMetricValue(row, metric)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.muted}>No sent volume yet for this metric.</p>
            )}
            {data.unknown ? (
              <p className={styles.heatUnknown}>
                Unknown / missing state: {data.unknown.recipientCount} recipient
                {data.unknown.recipientCount === 1 ? '' : 's'}
                {data.unknown.sent > 0 ? ` · ${data.unknown.sent} sent` : ''}
              </p>
            ) : null}
          </aside>
        </div>
      )}

      {hover ? (
        <div
          className={styles.heatTooltip}
          style={{ top: hover.y + 12, left: hover.x + 12 }}
          role="tooltip"
        >
          <strong>
            {hover.metric.label} ({hover.metric.state})
          </strong>
          <div>Sent: {hover.metric.sent}</div>
          <div>Delivered: {hover.metric.delivered}</div>
          <div>Open rate: {formatOutreachRate(hover.metric.opened, hover.metric.sent)}</div>
          <div>Bounce rate: {formatOutreachRate(hover.metric.bounced, hover.metric.sent)}</div>
        </div>
      ) : null}
    </section>
  );
}
