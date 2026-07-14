import { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { Modal } from './Modal';

interface PublishChangesModalProps {
  onClose: () => void;
}

export function PublishChangesModal({ onClose }: PublishChangesModalProps) {
  const { state, publishChanges } = useStore();
  const [confirming, setConfirming] = useState(false);
  const changes = state.pendingChanges;

  const publish = () => {
    publishChanges();
    onClose();
  };

  if (confirming) {
    return (
      <Modal title="Confirm publish" onClose={onClose}>
        <div className="confirm-dialog">
          <p>
            Publish <strong>{changes.length}</strong> change
            {changes.length === 1 ? '' : 's'}? This updates live flag state and
            is recorded in the audit trail.
          </p>
          <div className="modal__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setConfirming(false)}
            >
              Back
            </button>
            <button type="button" className="btn btn--primary" onClick={publish}>
              Publish
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Publish changes" onClose={onClose} wide>
      <p className="form__hint">
        Review the staged changes below. Publishing applies them to live flag
        state for the listed brands and environments.
      </p>
      {changes.length === 0 ? (
        <p className="empty-state">No pending changes.</p>
      ) : (
        <ul className="diff-list">
          {changes.map((change) => (
            <li key={change.id} className="diff-list__item diff-list__item--static">
              <div className="diff-list__static">
                <span className="diff-list__name">{change.flagName}</span>
                <span className="diff-list__meta">
                  {change.brand} · {change.environment}
                </span>
                <span className="diff-list__change">
                  <span className={change.before ? 'on' : 'off'}>
                    {change.before ? 'ON' : 'OFF'}
                  </span>
                  <span aria-hidden="true"> → </span>
                  <span className={change.after ? 'on' : 'off'}>
                    {change.after ? 'ON' : 'OFF'}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="modal__actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={changes.length === 0}
          onClick={() => setConfirming(true)}
        >
          Publish {changes.length} change{changes.length === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  );
}
