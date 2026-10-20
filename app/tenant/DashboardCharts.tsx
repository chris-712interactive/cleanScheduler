import type { DashboardChart } from '@/lib/tenant/dashboardCharts';
import { donutArcs } from '@/lib/tenant/donutArcs';
import styles from './dashboard.module.scss';

const DONUT_RADIUS = 40;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export function DashboardCharts({ charts }: { charts: DashboardChart[] }) {
  if (charts.length === 0) return null;

  return (
    <div className={styles.chartGrid}>
      {charts.map((chart) => {
        const arcs = donutArcs(chart.slices.map((slice) => slice.value));
        let arcIndex = 0;
        return (
          <figure key={chart.title} className={styles.chartCard}>
            <figcaption className={styles.chartTitle}>{chart.title}</figcaption>
            <div className={styles.chartBody}>
              <svg className={styles.chartDonut} viewBox="0 0 120 120" aria-hidden="true">
                <g transform="rotate(-90 60 60)">
                  {chart.slices.map((slice) => {
                    if (slice.value <= 0) return null;
                    const arc = arcs[arcIndex];
                    arcIndex += 1;
                    if (!arc) return null;
                    const fullCircle = arcs.length === 1 && arc.lengthShare === 1;
                    return (
                      <circle
                        key={slice.label}
                        className={styles.chartSlice}
                        data-tone={slice.tone}
                        cx="60"
                        cy="60"
                        r={DONUT_RADIUS}
                        fill="none"
                        strokeWidth="14"
                        strokeDasharray={
                          fullCircle
                            ? undefined
                            : `${arc.lengthShare * DONUT_CIRCUMFERENCE} ${DONUT_CIRCUMFERENCE}`
                        }
                        strokeDashoffset={
                          fullCircle ? undefined : -arc.offsetShare * DONUT_CIRCUMFERENCE
                        }
                      />
                    );
                  })}
                </g>
              </svg>
              <ul className={styles.chartLegend}>
                {chart.slices.map((slice) => (
                  <li key={slice.label}>
                    <span
                      className={styles.chartSwatch}
                      data-tone={slice.tone}
                      aria-hidden="true"
                    />
                    <span className={styles.chartSliceLabel}>{slice.label}</span>
                    <span className={styles.chartSliceValue}>{slice.valueLabel}</span>
                  </li>
                ))}
              </ul>
            </div>
          </figure>
        );
      })}
    </div>
  );
}
