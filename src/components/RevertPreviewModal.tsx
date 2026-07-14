import { useMemo, useState } from 'react';
import type { BrandSnapshot, Environment, FeatureFlag } from '../types';
import { useStore } from '../store/StoreContext';
import { Modal } from './Modal';

interface RevertDiff {
  flag: FeatureFlag;
  environment: Environment;
  current: boolean;
  restored: boolean;
}

function buildRevertDiffs(
  flags: FeatureFlag[],
  snap: BrandSnapshot,
): RevertDiff[] {
  const diffs: RevertDiff[] = [];
  for (const flag of flags) {
    const restored = snap.states[flag.id];
    if (!restored) continue;
    for (const environment of ['Stage', 'Production'] as Environment[]) {
      const current = flag.states[snap.brand][environment];
      const next = restored[environment];
      if (current !== next) {
        diffs.push({ flag, environment, current, restored: next });
      }
    }
  }
  return diffs;
}

interface RevertPreviewModalProps {
  snapshot: BrandSnapshot;
  onClose: () => void;
}

export function RevertPreviewModal({
  snapshot,
  onClose,
}: RevertPreviewModalProps) {
  const { state, revertBrand } = useStore();
  const [confirming, setConfirming] = useState(false);

  const diffs = useMemo(
    () => buildRevertDiffs(state.flags, snapshot),
    [state.flags, snapshot],
  );

  const apply = () => {
    revertBrand(snapshot.id);
    onClose();
  };

  if (confirming) {
    return (
      <Modal title="Confirm revert" onClose={onClose}>
        <div className="confirm-dialog">
          <p>
            Revert <strong>{snapshot.brand}</strong> to the configuration from{' '}
            <strong>{new Date(snapshot.timestamp).toLocaleString()}</strong>
            {diffs.length > 0 ? (
              <>
                , applying <strong>{diffs.length}</strong> change
                {diffs.length === 1 ? '' : 's'}
              </>
            ) : null}
            ?
          </p>
          <div className="modal__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setConfirming(false)}
            >
              Back
            </button>
            <button type="button" className="btn btn--primary" onClick={apply}>
              Revert
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Revert ${snapshot.brand}`}
      onClose={onClose}
      wide
    >
      <div className="revert-preview">
        <p className="form__hint">
          Snapshot from{' '}
          <strong>{new Date(snapshot.timestamp).toLocaleString()}</strong>
          {' · '}
          {snapshot.label}
          {' · '}
          {snapshot.userEmail}
        </p>

        {diffs.length === 0 ? (
          <p className="empty-state">
            Current configuration already matches this snapshot — nothing would
            change.
          </p>
        ) : (
          <>
            <p className="form__hint">
              These values would change from current → restored:
            </p>
            <ul className="diff-list">
              {diffs.map((diff) => (
                <li
                  key={`${diff.flag.id}-${diff.environment}`}
                  className="diff-list__item diff-list__item--static"
                >
                  <div className="diff-list__static">
                    <span className="diff-list__name">{diff.flag.name}</span>
                    <span
                      className={`env-label env-label--${diff.environment === 'Stage' ? 'stage' : 'production'}`}
                    >
                      {diff.environment}
                    </span>
                    <span className="diff-list__change">
                      <span className={diff.current ? 'on' : 'off'}>
                        {diff.current ? 'ON' : 'OFF'}
                      </span>
                      <span aria-hidden="true"> → </span>
                      <span className={diff.restored ? 'on' : 'off'}>
                        {diff.restored ? 'ON' : 'OFF'}
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={diffs.length === 0}
            onClick={() => setConfirming(true)}
          >
            {diffs.length === 0
              ? 'Nothing to revert'
              : `Revert ${diffs.length} change${diffs.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
