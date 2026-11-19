'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import { dayMapStyleFailureNote, type DayMapPin } from '@/lib/schedule/dayMap';
import styles from './dayMap.module.scss';
import 'maplibre-gl/dist/maplibre-gl.css';

function popupNode(pin: DayMapPin, popupClass: string): HTMLElement {
  const root = document.createElement('div');
  root.className = popupClass;

  const customer = document.createElement('p');
  customer.className = styles.popupCustomer ?? '';
  customer.textContent = pin.customerName;

  const time = document.createElement('p');
  time.textContent = pin.timeLabel;

  const crew = document.createElement('p');
  crew.textContent =
    pin.assigneeLabel === 'Unassigned' ? 'Unassigned' : `Assigned to ${pin.assigneeLabel}`;

  const link = document.createElement('a');
  link.href = pin.href;
  link.textContent = 'Open visit';

  const nodes = [customer, time, crew, link];
  if (pin.siteLine) {
    const site = document.createElement('p');
    site.textContent = pin.siteLine;
    nodes.splice(1, 0, site);
  }
  if (pin.status === 'completed') {
    const status = document.createElement('p');
    status.textContent = 'Completed';
    nodes.push(status);
  }
  root.append(...nodes);
  return root;
}

export default function DayMapCanvas({ styleUrl, pins }: { styleUrl: string; pins: DayMapPin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilesNote, setTilesNote] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pinsById = new Map(pins.map((pin) => [pin.visitId, pin]));
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style: styleUrl,
        center: [-98.5, 39.5],
        zoom: 3,
        transformRequest: (url) => ({ url }),
      });
    } catch {
      setTilesNote(dayMapStyleFailureNote(false));
      return;
    }

    let styleLoaded = false;
    const onStyleError = () => {
      const note = dayMapStyleFailureNote(styleLoaded);
      if (note) setTilesNote(note);
    };

    const onLoad = () => {
      styleLoaded = true;
      setTilesNote(null);
      map.addSource('visits', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: pins.map((pin) => ({
            type: 'Feature',
            id: pin.visitId,
            geometry: {
              type: 'Point',
              coordinates: [pin.pinLongitude, pin.pinLatitude],
            },
            properties: {
              visitId: pin.visitId,
              color: pin.color,
            },
          })),
        },
      });
      map.addLayer({
        id: 'visits',
        type: 'circle',
        source: 'visits',
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      if (pins.length > 0) {
        const bounds = new LngLatBounds();
        for (const pin of pins) {
          bounds.extend([pin.pinLongitude, pin.pinLatitude]);
        }
        map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
      }

      map.on('click', 'visits', (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const visitId = feature?.properties?.visitId;
        if (typeof visitId !== 'string') return;
        const pin = pinsById.get(visitId);
        if (!pin) return;
        const coordinates =
          feature?.geometry.type === 'Point' ? feature.geometry.coordinates : null;
        const longitude = coordinates?.[0];
        const latitude = coordinates?.[1];
        if (typeof longitude !== 'number' || typeof latitude !== 'number') return;
        new Popup({ closeButton: true, maxWidth: '16rem', offset: 12 })
          .setLngLat([longitude, latitude])
          .setDOMContent(popupNode(pin, styles.popup ?? ''))
          .addTo(map);
      });

      map.on('mouseenter', 'visits', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'visits', () => {
        map.getCanvas().style.cursor = '';
      });
    };

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', onStyleError);
    map.on('load', onLoad);

    const observer = new ResizeObserver(() => {
      map.resize();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      map.remove();
    };
  }, [pins, styleUrl]);

  return (
    <div className={styles.mapFrame}>
      <div ref={containerRef} className={styles.canvas} role="region" aria-label="Day map" />
      {pins.length === 0 ? (
        <p className={styles.mapEmpty}>No visits with a map point this day.</p>
      ) : null}
      {tilesNote ? <p className={styles.mapEmpty}>{tilesNote}</p> : null}
    </div>
  );
}
