'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
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
import { Check } from 'lucide-react';
import type { QuoteListEmbedRow } from '@/lib/tenant/quoteEmbedTypes';
import { getQuoteBoardCardDisplay } from '@/lib/tenant/quoteBoardCardDisplay';
import { formatQuoteMoney } from '@/lib/tenant/quoteMoney';
import type { QuoteStatus } from '@/lib/tenant/quoteLabels';
import type { QuotePipelineStage } from '@/lib/tenant/quotePipelineStages';
import { isAcceptedSystemStage, stageDroppableId } from '@/lib/tenant/quotePipelineStages';
import { moveTenantQuoteToStage } from './actions';
import {
  PORTAL_INTERACTION_FLOWS,
  endPortalInteraction,
  startPortalInteraction,
} from '@/lib/performance/portalInteractionPerf';
import styles from './quotes.module.scss';

function sortInColumn(a: QuoteListEmbedRow, b: QuoteListEmbedRow): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function groupQuotesByStage(
  quotes: QuoteListEmbedRow[],
  stages: QuotePipelineStage[],
): Record<string, QuoteListEmbedRow[]> {
  const map: Record<string, QuoteListEmbedRow[]> = {};
  for (const stage of stages) {
    map[stage.id] = [];
  }
  const fallbackStageId = stages[0]?.id;
  for (const q of quotes) {
    const key =
      q.pipeline_stage_id && map[q.pipeline_stage_id] ? q.pipeline_stage_id : fallbackStageId;
    if (key && map[key]) map[key].push(q);
  }
  for (const stage of stages) {
    map[stage.id]?.sort(sortInColumn);
  }
  return map;
}

function QuoteCardStatusFootnote({
  status,
  needsScheduling,
}: {
  status: QuoteStatus;
  needsScheduling?: boolean;
}) {
  if (status === 'accepted' && needsScheduling) {
    return (
      <span className={[styles.boardCardStatusBadge, styles.boardCardStatusSchedule].join(' ')}>
        Schedule visit
      </span>
    );
  }
  if (status === 'accepted') {
    return (
      <span className={[styles.boardCardStatusBadge, styles.boardCardStatusAccepted].join(' ')}>
        <Check size={12} strokeWidth={2.5} aria-hidden />
        Accepted
      </span>
    );
  }
  if (status === 'declined') {
    return (
      <span className={[styles.boardCardStatusBadge, styles.boardCardStatusDeclined].join(' ')}>
        Declined
      </span>
    );
  }
  if (status === 'expired') {
    return (
      <span className={[styles.boardCardStatusBadge, styles.boardCardStatusExpired].join(' ')}>
        Expired
      </span>
    );
  }
  return null;
}

function BoardQuoteCardFace({
  quote,
  variant,
  needsScheduling,
}: {
  quote: QuoteListEmbedRow;
  variant: 'list' | 'overlay';
  needsScheduling?: boolean;
}) {
  const { headline, serviceLine, dateLabel } = getQuoteBoardCardDisplay(quote);

  return (
    <div className={styles.boardCardInner}>
      {variant === 'overlay' ? (
        <span className={styles.boardCardHeadlineStatic}>{headline}</span>
      ) : (
        <Link
          href={`/quotes/${quote.id}`}
          className={styles.boardCardHeadline}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {headline}
        </Link>
      )}
      {serviceLine ? <p className={styles.boardCardService}>{serviceLine}</p> : null}
      <p className={styles.boardCardAmount}>
        {formatQuoteMoney(quote.amount_cents, quote.currency)}
      </p>
      <div className={styles.boardCardFooter}>
        <span className={styles.boardCardDate}>
          {dateLabel}
          {quote.version_number > 1 ? ` · v${quote.version_number}` : ''}
        </span>
        <QuoteCardStatusFootnote
          status={quote.status as QuoteStatus}
          needsScheduling={needsScheduling}
        />
      </div>
    </div>
  );
}

function BoardColumnHeader({ title, count }: { title: string; count: number }) {
  return (
    <header className={styles.boardColumnHeader}>
      <div className={styles.boardColumnTitleRow}>
        <h3 className={styles.boardColumnTitle}>{title}</h3>
        <span className={styles.boardColumnCount}>{count}</span>
      </div>
    </header>
  );
}

function DraggableQuoteCard({
  quote,
  pending,
  needsScheduling,
}: {
  quote: QuoteListEmbedRow;
  pending: boolean;
  needsScheduling?: boolean;
}) {
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
      <BoardQuoteCardFace quote={quote} variant="list" needsScheduling={needsScheduling} />
    </article>
  );
}

function BoardColumn({
  stage,
  quotes,
  pendingQuoteId,
  needsSchedulingQuoteIds,
}: {
  stage: QuotePipelineStage;
  quotes: QuoteListEmbedRow[];
  pendingQuoteId: string | null;
  needsSchedulingQuoteIds: Set<string>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stageDroppableId(stage.id),
    data: { type: 'column', stageId: stage.id },
    disabled: isAcceptedSystemStage(stage),
  });

  return (
    <section
      ref={setNodeRef}
      className={[styles.boardColumn, isOver ? styles.boardColumnOver : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={`${stage.name} quotes`}
    >
      <BoardColumnHeader title={stage.name} count={quotes.length} />
      <div className={styles.boardColumnBody}>
        {quotes.length === 0 ? (
          <p className={styles.boardColumnEmpty}>Drop quotes here</p>
        ) : (
          quotes.map((q) => (
            <DraggableQuoteCard
              key={q.id}
              quote={q}
              pending={pendingQuoteId === q.id}
              needsScheduling={needsSchedulingQuoteIds.has(q.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function MobileColumn({
  stage,
  quotes,
  onMobileMove,
  pendingQuoteId,
  needsSchedulingQuoteIds,
  stages,
}: {
  stage: QuotePipelineStage;
  quotes: QuoteListEmbedRow[];
  onMobileMove: (quoteId: string, stageId: string) => void;
  pendingQuoteId: string | null;
  needsSchedulingQuoteIds: Set<string>;
  stages: QuotePipelineStage[];
}) {
  return (
    <section className={styles.boardColumn} aria-label={`${stage.name} quotes`}>
      <BoardColumnHeader title={stage.name} count={quotes.length} />
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
              needsScheduling={needsSchedulingQuoteIds.has(q.id)}
              stages={stages}
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
  needsScheduling,
  stages,
}: {
  quote: QuoteListEmbedRow;
  onMobileMove: (quoteId: string, stageId: string) => void;
  pending: boolean;
  needsScheduling?: boolean;
  stages: QuotePipelineStage[];
}) {
  return (
    <article
      className={[styles.boardCard, pending ? styles.boardCardPending : '']
        .filter(Boolean)
        .join(' ')}
    >
      <BoardQuoteCardFace quote={quote} variant="list" needsScheduling={needsScheduling} />
      <div className={styles.boardCardMove}>
        <label className={styles.boardCardMoveLabel} htmlFor={`move_${quote.id}`}>
          Move to
        </label>
        <select
          id={`move_${quote.id}`}
          className={styles.boardCardMoveSelect}
          value={quote.pipeline_stage_id ?? ''}
          disabled={pending}
          onChange={(e) => {
            const v = e.target.value;
            if (v && v !== quote.pipeline_stage_id) onMobileMove(quote.id, v);
          }}
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id} disabled={isAcceptedSystemStage(s)}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}

export function QuotesBoard({
  tenantSlug,
  quotes,
  stages,
  needsSchedulingQuoteIds,
}: {
  tenantSlug: string;
  quotes: QuoteListEmbedRow[];
  stages: QuotePipelineStage[];
  needsSchedulingQuoteIds: Set<string>;
}) {
  const [localQuotes, setLocalQuotes] = useState(quotes);
  useEffect(() => {
    setLocalQuotes(quotes);
  }, [quotes]);

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

  const grouped = useMemo(() => groupQuotesByStage(localQuotes, stages), [localQuotes, stages]);
  const quoteById = useMemo(() => new Map(localQuotes.map((q) => [q.id, q])), [localQuotes]);
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const runMove = useCallback(
    (quoteId: string, stageId: string) => {
      const targetStage = stageById.get(stageId);
      const current = quoteById.get(quoteId);
      if (!targetStage || !current) return;
      if (current.pipeline_stage_id === stageId) return;

      if (isAcceptedSystemStage(targetStage)) {
        setBoardError('Accepted is only available when the customer signs in the customer portal.');
        return;
      }

      setBoardError(null);
      setPendingQuoteId(quoteId);
      const previousQuotes = localQuotes;

      setLocalQuotes((prev) =>
        prev.map((q) => (q.id === quoteId ? { ...q, pipeline_stage_id: stageId } : q)),
      );

      startPortalInteraction(PORTAL_INTERACTION_FLOWS.quotesBoardDrag, {
        quoteId,
        stageId,
      });

      startTransition(async () => {
        const res = await moveTenantQuoteToStage(tenantSlug, quoteId, stageId);
        setPendingQuoteId(null);
        endPortalInteraction(PORTAL_INTERACTION_FLOWS.quotesBoardDrag, { ok: res.ok });
        if (!res.ok) {
          setLocalQuotes(previousQuotes);
          setBoardError(res.error);
          return;
        }
        setBoardError(null);
      });
    },
    [localQuotes, quoteById, stageById, tenantSlug],
  );

  const onDragEndInternal = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const quoteId = String(active.id);
      const activeQuote = quoteById.get(quoteId);
      if (!activeQuote) return;

      const overId = String(over.id);
      let targetStageId: string | null = null;
      if (overId.startsWith('stage-')) {
        targetStageId = overId.replace('stage-', '');
      } else {
        const overQuote = quoteById.get(overId);
        targetStageId = overQuote?.pipeline_stage_id ?? null;
      }

      if (!targetStageId || targetStageId === activeQuote.pipeline_stage_id) return;
      runMove(quoteId, targetStageId);
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

  const columns = stages.map((stage) =>
    narrow ? (
      <MobileColumn
        key={stage.id}
        stage={stage}
        quotes={grouped[stage.id] ?? []}
        onMobileMove={runMove}
        pendingQuoteId={pendingQuoteId}
        needsSchedulingQuoteIds={needsSchedulingQuoteIds}
        stages={stages}
      />
    ) : (
      <BoardColumn
        key={stage.id}
        stage={stage}
        quotes={grouped[stage.id] ?? []}
        pendingQuoteId={pendingQuoteId}
        needsSchedulingQuoteIds={needsSchedulingQuoteIds}
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
