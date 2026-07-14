import { useMemo, useState } from 'react';
import { BRANDS } from '../types';
import type { Brand } from '../types';
import { useStore } from '../store/StoreContext';
import { canRevert } from '../permissions';
import { RevertPreviewModal } from './RevertPreviewModal';
import { PageTour } from './PageTour';

export function HistoryView() {
  const { state, currentUser } = useStore();
  const [brand, setBrand] = useState<Brand>(BRANDS[0]);
  const [pendingRevert, setPendingRevert] = useState<string | null>(null);
  const allowRevert = canRevert(currentUser.role);

  const snapshots = useMemo(
    () => state.history.filter((h) => h.brand === brand),
    [state.history, brand],
  );

  const pending = snapshots.find((s) => s.id === pendingRevert);

  return (
    <div className="view">
      <header className="view__header">
        <div>
          <h1>History</h1>
          <p className="view__subtitle">
            Configuration snapshots per brand — review the diff, then confirm
          </p>
        </div>
        <div className="view__actions">
          <PageTour page="history" />
        </div>
      </header>

      {!allowRevert && (
        <p className="banner banner--info">
          Only Owners can revert. You can still browse history.
        </p>
      )}

      <div className="toolbar">
        <label className="field field--inline" data-tour="history-brand">
          <span>Brand</span>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value as Brand)}
          >
            {BRANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
      </div>

      {snapshots.length === 0 ? (
        <p className="empty-state" data-tour="history-list">
          No snapshots yet for {brand}. Changes to this brand&apos;s flags will
          appear here.
        </p>
      ) : (
        <ul className="history-list" data-tour="history-list">
          {snapshots.map((snap) => {
            const flagCount = Object.keys(snap.states).length;
            return (
              <li key={snap.id} className="history-item">
                <div className="history-item__main">
                  <time dateTime={snap.timestamp}>
                    {new Date(snap.timestamp).toLocaleString()}
                  </time>
                  <p className="history-item__label">{snap.label}</p>
                  <div className="history-item__meta">
                    <span>{snap.userEmail}</span>
                    <span>
                      {flagCount} flag{flagCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                {allowRevert && (
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setPendingRevert(snap.id)}
                  >
                    Revert to this
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pending && (
        <RevertPreviewModal
          snapshot={pending}
          onClose={() => setPendingRevert(null)}
        />
      )}
    </div>
  );
}
