import { useState, type FormEvent } from 'react';
import type { FeatureFlag } from '../types';
import { Modal } from './Modal';
import { TagPicker } from './TagPicker';

interface EditFlagModalProps {
  flag: FeatureFlag;
  availableTags: string[];
  onClose: () => void;
  onSubmit: (patch: {
    name: string;
    description: string;
    tags: string[];
  }) => void;
}

export function EditFlagModal({
  flag,
  availableTags,
  onClose,
  onSubmit,
}: EditFlagModalProps) {
  const [name, setName] = useState(flag.name);
  const [description, setDescription] = useState(flag.description);
  const [tags, setTags] = useState<string[]>(flag.tags);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      tags,
    });
    onClose();
  };

  return (
    <Modal title="Edit feature flag" onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}
