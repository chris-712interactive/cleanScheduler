'use client';

import dynamic from 'next/dynamic';
import type { DayMapPin } from '@/lib/schedule/dayMap';
import styles from './dayMap.module.scss';

const DayMapCanvas = dynamic(() => import('./DayMapCanvas'), {
  ssr: false,
  loading: () => <p className={styles.mapLoading}>Loading map…</p>,
});

export function DayMap(props: { styleUrl: string; pins: DayMapPin[] }) {
  return <DayMapCanvas styleUrl={props.styleUrl} pins={props.pins} />;
}
