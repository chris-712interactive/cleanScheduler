'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import type { QuoteListEmbedRow } from '@/lib/tenant/quoteEmbedTypes';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { formatQuoteMoney } from '@/lib/tenant/quoteMoney';
import { QUOTE_STATUS_LABEL, type QuoteStatus } from '@/lib/tenant/quoteLabels';
import { columnDroppableId, QUOTE_BOARD_COLUMN_ORDER } from '@/lib/tenant/quoteBoardColumns';
import { moveTenantQuoteStatus } from './actions';
import styles from './quotes.module.scss';

function sortInColumn(a: QuoteListEmbedRow, b: QuoteListEmbedRow): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function groupQuotesByStatus(
  quotes: QuoteListEmbedRow[],
): Record<QuoteStatus, QuoteListEmbedRow[]> {
  const map = {} as Record<QuoteStatus, QuoteListEmbedRow[]>;
  for (const s of QUOTE_BOARD_COLUMN_ORDER) {
    map[s] = [];
  }
  for (const q of quotes) {
    const s = q.status as QuoteStatus;
    if (map[s]) map[s].push(q);
    else map.draft.push(q);
  }
  for (const s of QUOTE_BOARD_COLUMN_ORDER) {
    map[s].sort(sortInColumn);
  }
  return map;
}

function BoardQuoteCardFace({
  quote,
  variant,
  dragDisabled,
}: {
  quote: QuoteListEmbedRow;
  variant: 'list' | 'overlay';
  dragDisabled?: boolean;
}) {
  const ident = quote.customers?.customer_identities;
  const name = ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : '';
  const who = name ? name : quote.customer_id ? 'Linked customer' : 'No customer';
  const prop = quote.tenant_customer_properties;
  const site = prop ? formatPropertyAddressLine(prop) : '';

  return (
    <div className={styles.boardCardInner}>
      {variant === 'overlay' ? (
        <span className={styles.boardCardTitleStatic}>{quote.title}</span>
      ) : (
        <Link
          href={`/quotes/${quote.id}`}
          className={styles.boardCardTitle}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {quote.title}
        </Link>
      )}
      <p className={styles.boardCardMeta}>
        {who}
        {site ? ` · ${site}` : ''}
      </p>
      <p className={styles.boardCardMetaMuted}>
        {formatQuoteMoney(quote.amount_cents, quote.currency)} ·{' '}
        {new Date(quote.created_at).toLocaleDateString()}
        {quote.version_number > 1 ? ` · v${quote.version_number}` : ''}
      </p>
      {variant === 'list' && !dragDisabled ? (
        <p className={styles.boardCardHint} aria-hidden="true">
          Drag to another column
        </p>
      ) : null}
    </div>
  );
}

function DraggableQuoteCard({ quote, pending }: { quote: QuoteListEmbedRow; pending: boolean }) {
  const dragDisabled = quote.is_locked || quote.status === 'expired';
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: quote.id,
    data: { type: 'quote', status: quote.status },
    disabled: dragDisabled,
  });

  return (
    <article
      ref={setNodeRef}
      className={[
        styles.boardCard,
        isDragging ? styles.boardCardDragging : '',
        pending ? styles.boardCardPending : '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...listeners}
      {...attributes}
    >
      <BoardQuoteCardFace quote={quote} variant="list" dragDisabled={dragDisabled} />
    </article>
  );
}

function BoardColumn({
  status,
  quotes,
  pendingQuoteId,
}: {
  status: QuoteStatus;
  quotes: QuoteListEmbedRow[];
  pendingQuoteId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnDroppableId(status),
    data: { type: 'column', status },
    disabled: status === 'accepted',
  });

  return (
    <section
      ref={setNodeRef}
      className={[styles.boardColumn, isOver ? styles.boardColumnOver : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={`${QUOTE_STATUS_LABEL[status]} quotes`}
    >
      <header className={styles.boardColumnHeader}>
        <h3 className={styles.boardColumnTitle}>{QUOTE_STATUS_LABEL[status]}</h3>
        <span className={styles.boardColumnCount}>{quotes.length}</span>
      </header>
      <div className={styles.boardColumnBody}>
        {quotes.length === 0 ? (
          <p className={styles.boardColumnEmpty}>Drop quotes here</p>
        ) : (
          quotes.map((q) => (
            <DraggableQuoteCard key={q.id} quote={q} pending={pendingQuoteId === q.id} />
          ))
        )}
      </div>
    </section>
  );
}

function MobileColumn({
  status,
  quotes,
  onMobileMove,
  pendingQuoteId,
}: {
  status: QuoteStatus;
  quotes: QuoteListEmbedRow[];
  onMobileMove: (quoteId: string, next: QuoteStatus) => void;
  pendingQuoteId: string | null;
}) {
  return (
    <section className={styles.boardColumn} aria-label={`${QUOTE_STATUS_LABEL[status]} quotes`}>
      <header className={styles.boardColumnHeader}>
        <h3 className={styles.boardColumnTitle}>{QUOTE_STATUS_LABEL[status]}</h3>
        <span className={styles.boardColumnCount}>{quotes.length}</span>
      </header>
      <div className={styles.boardColumnBody}>
        {quotes.length === 0 ? (
          <p className={styles.boardColumnEmpty}>No quotes</p>
        ) : (
          quotes.map((q) => (
            <MobileQuoteCard
              key={q.id}
              quote={q}
              onMobileMove={onMobileMove}
              pending={pendingQuoteId === q.id}
            />
          ))
        )}
      </div>
    </section>
  );
}

function MobileQuoteCard({
  quote,
  onMobileMove,
  pending,
}: {
  quote: QuoteListEmbedRow;
  onMobileMove: (quoteId: string, next: QuoteStatus) => void;
  pending: boolean;
}) {
  const ident = quote.customers?.customer_identities;
  const name = ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : '';
  const who = name ? name : quote.customer_id ? 'Linked customer' : 'No customer';
  const prop = quote.tenant_customer_properties;
  const site = prop ? formatPropertyAddressLine(prop) : '';

  return (
    <article
      className={[styles.boardCard, pending ? styles.boardCardPending : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.boardCardInner}>
        <Link href={`/quotes/${quote.id}`} className={styles.boardCardTitle}>
          {quote.title}
        </Link>
        <p className={styles.boardCardMeta}>
          {who}
          {site ? ` · ${site}` : ''}
        </p>
        <p className={styles.boardCardMetaMuted}>
          {formatQuoteMoney(quote.amount_cents, quote.currency)} ·{' '}
          {new Date(quote.created_at).toLocaleDateString()}
        </p>
        <div className={styles.boardCardMove}>
          <label className={styles.boardCardMoveLabel} htmlFor={`move_${quote.id}`}>
            Move to
          </label>
          <select
            id={`move_${quote.id}`}
            className={styles.boardCardMoveSelect}
            value={quote.status}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value as QuoteStatus;
              if (v !== quote.status) onMobileMove(quote.id, v);
            }}
          >
            {QUOTE_BOARD_COLUMN_ORDER.map((s) => (
              <option key={s} value={s} disabled={s === 'accepted'}>
                {QUOTE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </article>
  );
}

export function QuotesBoard({
  tenantSlug,
  quotes,
}: {
  tenantSlug: string;
  quotes: QuoteListEmbedRow[];
}) {
  const router = useRouter();
  const [isNarrow, setIsNarrow] = useState(false);
  const [narrowReady, setNarrowReady] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [pendingQuoteId, setPendingQuoteId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsNarrow(mq.matches);
    apply();
    setNarrowReady(true);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const grouped = useMemo(() => groupQuotesByStatus(quotes), [quotes]);
  const quoteById = useMemo(() => new Map(quotes.map((q) => [q.id, q])), [quotes]);

  const runMove = useCallback(
    (quoteId: string, nextStatus: QuoteStatus) => {
      const current = quoteById.get(quoteId)?.status as QuoteStatus | undefined;
      if (current === nextStatus) return;

      setBoardError(null);
      setPendingQuoteId(quoteId);
      startTransition(async () => {
        if (nextStatus === 'accepted') {
          setPendingQuoteId(null);
          setBoardError(
            'Accepted is only available when the customer signs in the customer portal.',
          );
          return;
        }
        const res = await moveTenantQuoteStatus(tenantSlug, quoteId, nextStatus);
        setPendingQuoteId(null);
        if (!res.ok) {
          setBoardError(res.error);
          return;
        }
        setBoardError(null);
        router.refresh();
      });
    },
    [quoteById, router, tenantSlug],
  );

  const onDragEndInternal = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const quoteId = String(active.id);
      const activeQuote = quoteById.get(quoteId);
      if (!activeQuote) return;

      const overId = String(over.id);
      let targetStatus: QuoteStatus | null = null;
      if (overId.startsWith('column-')) {
        targetStatus = overId.replace('column-', '') as QuoteStatus;
      } else {
        const overQuote = quoteById.get(overId);
        targetStatus = (overQuote?.status as QuoteStatus) ?? null;
      }

      if (!targetStatus || targetStatus === activeQuote.status) return;
      runMove(quoteId, targetStatus);
    },
    [quoteById, runMove],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      onDragEndInternal(event);
    },
    [onDragEndInternal],
  );

  const narrow = narrowReady && isNarrow;

  const columns = QUOTE_BOARD_COLUMN_ORDER.map((status) =>
    narrow ? (
      <MobileColumn
        key={status}
        status={status}
        quotes={grouped[status]}
        onMobileMove={runMove}
        pendingQuoteId={pendingQuoteId}
      />
    ) : (
      <BoardColumn
        key={status}
        status={status}
        quotes={grouped[status]}
        pendingQuoteId={pendingQuoteId}
      />
    ),
  );

  return (
    <div className={styles.boardWrap}>
      {boardError ? (
        <p className={styles.boardBannerError} role="alert">
          {boardError}
        </p>
      ) : null}
      {isPending && pendingQuoteId ? (
        <p className={styles.boardBannerMuted} aria-live="polite">
          Updating…
        </p>
      ) : null}

      {narrow ? (
        <div className={styles.board}>{columns}</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e) => setActiveDragId(String(e.active.id))}
          onDragCancel={() => setActiveDragId(null)}
          onDragEnd={handleDragEnd}
        >
          <div className={styles.board}>{columns}</div>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeDragId && quoteById.has(activeDragId) ? (
              <article className={[styles.boardCard, styles.boardCardDragOverlay].join(' ')}>
                <BoardQuoteCardFace quote={quoteById.get(activeDragId)!} variant="overlay" />
              </article>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
