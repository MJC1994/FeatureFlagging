import { useStore } from '../store/StoreContext';
import { Modal } from './Modal';

interface PublishChangesModalProps {
  onClose: () => void;
}

export function PublishChangesModal({ onClose }: PublishChangesModalProps) {
  const { state, publishChanges } = useStore();
  const changes = state.pendingChanges;

  const publish = () => {
    publishChanges();
    onClose();
  };

  return (
    <Modal title="Publish changes" onClose={onClose} wide>
      <div data-tour="publish-summary">
        <p className="form__hint">
          Review the staged changes below. Publishing applies them to live flag
          state for the listed brands and environments.
        </p>
        {changes.length === 0 ? (
          <p className="empty-state">No pending changes.</p>
        ) : (
          <ul className="diff-list">
            {changes.map((change) => (
              <li
                key={change.id}
                className="diff-list__item diff-list__item--static"
              >
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
      </div>
      <div className="modal__actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          data-tour="publish-apply"
          disabled={changes.length === 0}
          onClick={publish}
        >
          Publish {changes.length} change{changes.length === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  );
}
