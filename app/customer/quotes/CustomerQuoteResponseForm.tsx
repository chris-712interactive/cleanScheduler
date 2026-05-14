'use client';

import { useActionState, useCallback, useRef, useState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { respondToCustomerQuote, type CustomerQuoteResponseState } from './actions';
import styles from './quotes.module.scss';

const initial: CustomerQuoteResponseState = {};

export function CustomerQuoteResponseForm({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = useActionState(respondToCustomerQuote, initial);
  useRefreshOnServerActionSuccess(state.success);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [signatureMode, setSignatureMode] = useState<'typed' | 'drawn'>('typed');
  const [isDrawing, setIsDrawing] = useState(false);

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

  return (
    <div className={styles.responseForm}>
      {state.error ? (
        <p className={styles.responseError} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.responseSuccess} role="status">
          Thank you — your response has been recorded.
        </p>
      ) : null}

      <form action={action} className={styles.responseForm}>
        <input type="hidden" name="quote_id" value={quoteId} />
        <input type="hidden" name="decision" value="decline" />
        <button type="submit" className={styles.declineButton} formNoValidate disabled={pending}>
          Decline
        </button>
      </form>

      <form
        action={action}
        className={styles.responseForm}
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
        <fieldset className={styles.signatureFieldset}>
          <legend className={styles.signatureLegend}>Sign to accept</legend>
          <p className={styles.signatureIntro}>
            Your signature, IP address, and browser information are stored with this acceptance for
            your records and your provider&apos;s.
          </p>
          <div className={styles.signatureModeRow}>
            <label className={styles.signatureRadio}>
              <input
                type="radio"
                name="signature_kind"
                value="typed_name"
                checked={signatureMode === 'typed'}
                onChange={() => setSignatureMode('typed')}
              />
              <span>Type full name</span>
            </label>
            <label className={styles.signatureRadio}>
              <input
                type="radio"
                name="signature_kind"
                value="drawn_png"
                checked={signatureMode === 'drawn'}
                onChange={() => setSignatureMode('drawn')}
              />
              <span>Draw signature</span>
            </label>
          </div>
          {signatureMode === 'typed' ? (
            <label className={styles.signatureLabel} htmlFor={`typed_sig_${quoteId}`}>
              Full legal name (must match how you are agreeing to this quote)
            </label>
          ) : null}
          {signatureMode === 'typed' ? (
            <input
              id={`typed_sig_${quoteId}`}
              name="typed_full_name"
              className={styles.input}
              autoComplete="name"
              required
              placeholder="Jane Q. Customer"
            />
          ) : null}
          {signatureMode === 'drawn' ? (
            <>
              <p className={styles.signatureHint}>Sign with mouse or finger, then accept below.</p>
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
              <button type="button" className={styles.clearSigButton} onClick={clearCanvas}>
                Clear drawing
              </button>
              <input
                type="hidden"
                name="drawn_signature_data"
                id={`drawn_sig_${quoteId}`}
                defaultValue=""
              />
              <input type="hidden" name="typed_full_name" value="" />
            </>
          ) : null}
        </fieldset>
        <button type="submit" className={styles.acceptButton} disabled={pending}>
          {pending ? 'Working…' : 'Accept and sign quote'}
        </button>
      </form>
    </div>
  );
}
