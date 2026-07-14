import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { View } from '../types';
import { TOURS, TOUR_STORAGE_PREFIX, type TourStep } from '../tour/tours';

function seenKey(page: View) {
  return `${TOUR_STORAGE_PREFIX}${page}`;
}

function hasSeen(page: View) {
  try {
    return localStorage.getItem(seenKey(page)) === '1';
  } catch {
    return false;
  }
}

function markSeen(page: View) {
  try {
    localStorage.setItem(seenKey(page), '1');
  } catch {
    /* ignore */
  }
}

interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measureTarget(selector?: string): SpotRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  const pad = 8;
  return {
    top: r.top - pad,
    left: r.left - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

function tooltipStyle(spot: SpotRect | null): CSSProperties {
  const cardW = Math.min(360, window.innerWidth - 32);
  if (!spot) {
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: cardW,
    };
  }

  const gap = 14;
  const spaceBelow = window.innerHeight - (spot.top + spot.height);
  const placeBelow = spaceBelow > 220 || spot.top < 220;
  const left = Math.min(
    Math.max(16, spot.left + spot.width / 2 - cardW / 2),
    window.innerWidth - cardW - 16,
  );

  if (placeBelow) {
    return {
      position: 'fixed',
      top: Math.min(spot.top + spot.height + gap, window.innerHeight - 220),
      left,
      width: cardW,
    };
  }

  return {
    position: 'fixed',
    bottom: Math.max(16, window.innerHeight - spot.top + gap),
    left,
    width: cardW,
  };
}

interface PageTourProps {
  page: View;
  /** Run interactive demo actions for guided steps (e.g. Flags publish flow). */
  onDemoAction?: (action: string) => void;
}

export function PageTour({ page, onDemoAction }: PageTourProps) {
  const steps = TOURS[page];
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<SpotRect | null>(null);
  const ranDemoFor = useRef<number | null>(null);

  const step: TourStep | undefined = steps[index];

  const refreshSpot = useCallback(() => {
    setSpot(measureTarget(step?.target));
  }, [step?.target]);

  useEffect(() => {
    if (hasSeen(page)) return;
    const t = window.setTimeout(() => {
      setIndex(0);
      setOpen(true);
    }, 450);
    return () => window.clearTimeout(t);
  }, [page]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    if (ranDemoFor.current !== index) {
      ranDemoFor.current = index;
      if (step.demo) onDemoAction?.(step.demo);
    }
    if (step.target) {
      const el = document.querySelector(step.target);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const t = window.setTimeout(refreshSpot, 80);
    const t2 = window.setTimeout(refreshSpot, 350);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [open, step, refreshSpot, onDemoAction, index]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => refreshSpot();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, refreshSpot]);

  const close = (persist: boolean) => {
    if (persist) markSeen(page);
    setOpen(false);
    setIndex(0);
    ranDemoFor.current = null;
    onDemoAction?.('cleanup');
  };

  const start = () => {
    ranDemoFor.current = null;
    setIndex(0);
    setOpen(true);
  };

  const next = () => {
    if (step?.demoOnNext) onDemoAction?.(step.demoOnNext);
    if (index >= steps.length - 1) {
      close(true);
      return;
    }
    // Allow DOM updates (modal open, toggle) before measuring next step
    window.setTimeout(() => setIndex((i) => i + 1), 60);
  };

  const back = () => setIndex((i) => Math.max(0, i - 1));

  const primaryLabel =
    step?.nextLabel ?? (index >= steps.length - 1 ? 'Done' : 'Next');

  return (
    <>
      <button
        type="button"
        className="btn btn--ghost btn--sm tour-launch"
        onClick={start}
        data-tour={`${page}-tour-btn`}
      >
        Welcome demo
      </button>

      {open && step && (
        <div
          className="tour"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
        >
          <div className="tour__shade" onClick={() => close(true)} />
          {spot && (
            <div
              className="tour__spotlight"
              style={{
                top: spot.top,
                left: spot.left,
                width: spot.width,
                height: spot.height,
              }}
            />
          )}
          <div className="tour__card" style={tooltipStyle(spot)}>
            <div className="tour__progress">
              Step {index + 1} of {steps.length}
            </div>
            <h2 id="tour-title" className="tour__title">
              {step.title}
            </h2>
            <p className="tour__body">{step.body}</p>
            <div className="tour__actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => close(true)}
              >
                Skip
              </button>
              <div className="tour__nav">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={back}
                  disabled={index === 0}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={next}
                >
                  {primaryLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
