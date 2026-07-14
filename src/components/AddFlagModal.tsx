import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { TagPicker } from './TagPicker';

interface AddFlagModalProps {
  onClose: () => void;
  onSubmit: (name: string, description: string, tags: string[]) => void;
  availableTags: string[];
}

export function AddFlagModal({
  onClose,
  onSubmit,
  availableTags,
}: AddFlagModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name, description, tags);
    onClose();
  };

  return (
    <Modal title="Add feature flag" onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <p className="form__hint">
          The flag will be created for all brands in Stage and Production,
          defaulted OFF.
        </p>
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. new-checkout-flow"
            required
            autoFocus
          />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this flag control?"
            rows={3}
          />
        </label>
        <TagPicker
          availableTags={availableTags}
          value={tags}
          onChange={setTags}
        />
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
            Create flag
          </button>
        </div>
      </form>
    </Modal>
  );
}
