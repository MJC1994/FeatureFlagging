import { useMemo, useState, type KeyboardEvent } from 'react';

interface TagPickerProps {
  availableTags: string[];
  value: string[];
  onChange: (tags: string[]) => void;
}

function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}

export function TagPicker({ availableTags, value, onChange }: TagPickerProps) {
  const [draft, setDraft] = useState('');

  const options = useMemo(() => {
    const set = new Set(
      [...availableTags, ...value].map((t) => t.trim()).filter(Boolean),
    );
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [availableTags, value]);

  const unused = options.filter((t) => !value.includes(t));

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag || value.includes(tag)) {
      setDraft('');
      return;
    }
    onChange([...value, tag]);
    setDraft('');
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(draft);
    }
  };

  return (
    <div className="tag-picker">
      <span className="tag-picker__label">Tags</span>

      {value.length > 0 && (
        <div className="tag-picker__selected">
          {value.map((tag) => (
            <span key={tag} className="tag tag--active tag-picker__chip">
              {tag}
              <button
                type="button"
                className="tag-picker__remove"
                aria-label={`Remove ${tag}`}
                onClick={() => removeTag(tag)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="tag-picker__controls">
        <div className="tag-picker__dropdown">
          <select
            value=""
            aria-label="Select an existing tag"
            onChange={(e) => {
              if (e.target.value) addTag(e.target.value);
            }}
          >
            <option value="" disabled>
              {unused.length === 0
                ? 'No more existing tags'
                : 'Select existing tag…'}
            </option>
            {unused.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>

        <div className="tag-picker__create">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Or type a new tag"
            aria-label="New tag name"
          />
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={!draft.trim()}
            onClick={() => addTag(draft)}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
