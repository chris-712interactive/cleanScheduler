'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './HeadingHint.module.scss';

export interface HeadingHintProps {
  text: string;
}

export function HeadingHint({ text }: HeadingHintProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button type="button" className={styles.trigger}>
          <Info size={16} strokeWidth={2} aria-hidden />
          <span className={styles.srOnly}>{text}</span>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className={styles.tooltip}
          side="top"
          align="center"
          sideOffset={6}
          collisionPadding={12}
        >
          {text}
          <Tooltip.Arrow className={styles.arrow} width={10} height={5} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export interface TitleWithHintProps {
  children: ReactNode;
  hint?: string;
}

export function TitleWithHint({ children, hint }: TitleWithHintProps) {
  const row = (
    <span className={styles.titleRow}>
      <span>{children}</span>
      {hint ? <HeadingHint text={hint} /> : null}
    </span>
  );

  if (!hint) {
    return row;
  }

  return (
    <Tooltip.Provider delayDuration={250} skipDelayDuration={0}>
      {row}
    </Tooltip.Provider>
  );
}
