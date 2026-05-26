'use client';

import { useActionState, useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { respondToCustomerQuote, type CustomerQuoteResponseState } from './actions';
import styles from './quotes.module.scss';

const initial: CustomerQuoteResponseState = {};

type FlowStep = 'decision' | 'sign';

function scrollQuoteResponseIntoView(quoteId: string) {
  requestAnimationFrame(() => {
    document.getElementById(`quote-response-${quoteId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  });
}

export function CustomerQuoteResponseForm({
  quoteId,
  tenantName,
  totalLabel,
  userEmail,
  layout = 'default',
}: {
  quoteId: string;
  tenantName: string;
  totalLabel: string;
  userEmail: string | null;
  layout?: 'default' | 'panel';
}) {
  const [state, action, pending] = useActionState(respondToCustomerQuote, initial);
  useRefreshOnServerActionSuccess(state.success);

  const [step, setStep] = useState<FlowStep>('decision');
  const [declineOpen, setDeclineOpen] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'typed' | 'drawn'>('typed');
  const [isDrawing, setIsDrawing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signFormId = `quote-sign-form-${quoteId}`;

  const initCanvas = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, el.width, el.height);
  }, []);

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  const startDraw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      setIsDrawing(true);
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const rect = c.getBoundingClientRect();
      const scaleX = c.width / rect.width;
      const scaleY = c.height / rect.height;
      let cx: number;
      let cy: number;
      if ('touches' in e && e.touches[0]) {
        cx = (e.touches[0].clientX - rect.left) * scaleX;
        cy = (e.touches[0].clientY - rect.top) * scaleY;
      } else if ('clientX' in e) {
        cx = (e.clientX - rect.left) * scaleX;
        cy = (e.clientY - rect.top) * scaleY;
      } else {
        return;
      }
      ctx.beginPath();
      ctx.moveTo(cx, cy);
    },
    [],
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const rect = c.getBoundingClientRect();
      const scaleX = c.width / rect.width;
      const scaleY = c.height / rect.height;
      let cx: number;
      let cy: number;
      if ('touches' in e && e.touches[0]) {
        cx = (e.touches[0].clientX - rect.left) * scaleX;
        cy = (e.touches[0].clientY - rect.top) * scaleY;
      } else if ('clientX' in e) {
        cx = (e.clientX - rect.left) * scaleX;
        cy = (e.clientY - rect.top) * scaleY;
      } else {
        return;
      }
      ctx.lineTo(cx, cy);
      ctx.stroke();
    },
    [isDrawing],
  );

  const endDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const syncDrawnField = useCallback(() => {
    const c = canvasRef.current;
    const input = document.getElementById(`drawn_sig_${quoteId}`) as HTMLInputElement | null;
    if (!c || !input) return;
    try {
      input.value = c.toDataURL('image/png');
    } catch {
      input.value = '';
    }
  }, [quoteId]);

  const beginSignStep = useCallback(() => {
    setStep('sign');
    scrollQuoteResponseIntoView(quoteId);
  }, [quoteId]);

  const isPanel = layout === 'panel';
  const desktopActionsClass = isPanel ? styles.panelActions : styles.responseActions;

  if (state.success) {
    return (
      <p className={styles.responseSuccess} role="status">
        Thank you — your response has been recorded.
      </p>
    );
  }

  if (step === 'decision') {
    return (
      <div
        id={`quote-response-${quoteId}`}
        className={styles.responseForm}
        data-flow-step="decision"
        data-decline-open={declineOpen ? 'true' : 'false'}
      >
        {state.error ? (
          <p className={styles.responseError} role="alert">
            {state.error}
          </p>
        ) : null}

        {declineOpen ? (
          <div className={styles.declineConfirm}>
            <p className={styles.declineConfirmText}>
              This tells {tenantName} you are passing on this quote. You can ask them for a revised
              proposal later.
            </p>
            <div className={desktopActionsClass}>
              <Button type="button" variant="ghost" onClick={() => setDeclineOpen(false)}>
                Cancel
              </Button>
              <form action={action}>
                <input type="hidden" name="quote_id" value={quoteId} />
                <input type="hidden" name="decision" value="decline" />
                <Button type="submit" variant="secondary" loading={pending} disabled={pending}>
                  Confirm decline
                </Button>
              </form>
            </div>
            <div className={styles.stickyActionBar}>
              <Button type="button" variant="ghost" fullWidth onClick={() => setDeclineOpen(false)}>
                Cancel
              </Button>
              <form action={action} className={styles.stickyActionForm}>
                <input type="hidden" name="quote_id" value={quoteId} />
                <input type="hidden" name="decision" value="decline" />
                <Button type="submit" variant="secondary" fullWidth loading={pending} disabled={pending}>
                  Confirm decline
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <>
            <div className={desktopActionsClass}>
              <Button type="button" variant="primary" fullWidth={isPanel} onClick={beginSignStep}>
                Accept quote
              </Button>
              <Button type="button" variant="ghost" fullWidth={isPanel} onClick={() => setDeclineOpen(true)}>
                Not interested
              </Button>
            </div>

            <div className={styles.stickyActionBar}>
              <Button type="button" variant="ghost" fullWidth onClick={() => setDeclineOpen(true)}>
                Decline
              </Button>
              <Button type="button" variant="primary" fullWidth onClick={beginSignStep}>
                Accept — {totalLabel}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      id={`quote-response-${quoteId}`}
      className={styles.responseForm}
      data-flow-step="sign"
    >
      {state.error ? (
        <p className={styles.responseError} role="alert">
          {state.error}
        </p>
      ) : null}

      <p className={styles.signatureStepIntro}>
        Sign below to accept this quote for {totalLabel}.
      </p>

      <form
        id={signFormId}
        action={action}
        className={styles.signatureForm}
        onSubmit={(e) => {
          if (signatureMode === 'drawn') {
            syncDrawnField();
            const inp = document.getElementById(`drawn_sig_${quoteId}`) as HTMLInputElement | null;
            const v = inp?.value?.trim() ?? '';
            if (v.length < 200) {
              e.preventDefault();
            }
          }
        }}
      >
        <input type="hidden" name="quote_id" value={quoteId} />
        <input type="hidden" name="decision" value="accept" />

        {userEmail ? (
          <label className={styles.signatureLabel}>
            Signing as
            <input
              className={styles.inputReadOnly}
              value={userEmail}
              readOnly
              tabIndex={-1}
              aria-readonly="true"
            />
          </label>
        ) : null}

        {signatureMode === 'typed' ? (
          <>
            <input type="hidden" name="signature_kind" value="typed_name" />
            <label className={styles.signatureLabel} htmlFor={`typed_sig_${quoteId}`}>
              Full legal name
            </label>
            <input
              id={`typed_sig_${quoteId}`}
              name="typed_full_name"
              className={styles.input}
              autoComplete="name"
              required
              placeholder="Jane Q. Customer"
            />
          </>
        ) : (
          <>
            <input type="hidden" name="signature_kind" value="drawn_png" />
            <p className={styles.signatureHint}>Sign with mouse or finger.</p>
            <div className={styles.canvasWrap}>
              <canvas
                ref={initCanvas}
                width={560}
                height={180}
                className={styles.signatureCanvas}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startDraw(e);
                }}
                onTouchMove={(e) => {
                  e.preventDefault();
                  draw(e);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  endDraw();
                }}
              />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearCanvas}>
              Clear drawing
            </Button>
            <input
              type="hidden"
              name="drawn_signature_data"
              id={`drawn_sig_${quoteId}`}
              defaultValue=""
            />
            <input type="hidden" name="typed_full_name" value="" />
          </>
        )}

        <details className={styles.signatureAdvanced}>
          <summary>Other signing options</summary>
          {signatureMode === 'typed' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSignatureMode('drawn')}
            >
              Draw signature instead
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSignatureMode('typed')}
            >
              Type name instead
            </Button>
          )}
        </details>

        <details className={styles.signatureAdvanced}>
          <summary>What we record</summary>
          <p className={styles.signatureIntro}>
            Your signature, IP address, and browser information are stored with this acceptance for
            your records and your provider&apos;s.
          </p>
        </details>

        <div className={desktopActionsClass}>
          <Button type="button" variant="ghost" fullWidth={isPanel} onClick={() => setStep('decision')}>
            Back
          </Button>
          <Button type="submit" variant="primary" fullWidth={isPanel} loading={pending} disabled={pending}>
            {pending ? 'Working…' : 'Accept and sign'}
          </Button>
        </div>
      </form>

      <div className={styles.stickyActionBar}>
        <Button type="button" variant="ghost" fullWidth onClick={() => setStep('decision')}>
          Back
        </Button>
        <Button
          type="submit"
          form={signFormId}
          variant="primary"
          fullWidth
          loading={pending}
          disabled={pending}
        >
          {pending ? 'Working…' : 'Accept and sign'}
        </Button>
      </div>
    </div>
  );
}
