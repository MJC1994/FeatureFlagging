import { useCallback, useMemo, useState } from 'react';
import { BRANDS } from '../types';
import type { Brand, Environment, FeatureFlag } from '../types';
import { useStore } from '../store/StoreContext';
import {
  canChangeStatus,
  canCreateFlag,
  canDeleteFlag,
  canEditFlagMeta,
  canEditProduction,
  canEditStage,
} from '../permissions';
import { AddFlagModal } from './AddFlagModal';
import { EditFlagModal } from './EditFlagModal';
import { PublishChangesModal } from './PublishChangesModal';
import { ConfirmDialog } from './Modal';
import { PageTour } from './PageTour';

const DEMO_BRAND: Brand = 'Southeastern';

export function FlagList() {
  const {
    state,
    currentUser,
    createFlag,
    updateFlag,
    setFlagStatus,
    deleteFlag,
    stageToggle,
    discardChanges,
    publishChanges,
    getEffectiveValue,
    isPending,
  } = useStore();

  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showDeprecated, setShowDeprecated] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<FeatureFlag | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FeatureFlag | null>(null);
  const [demoFlagId, setDemoFlagId] = useState<string | null>(null);

  const pendingCount = state.pendingChanges.length;

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const f of state.flags) for (const t of f.tags) set.add(t);
    return [...set].sort();
  }, [state.flags]);

  const filtered = useMemo(() => {
    const words = search
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return state.flags.filter((flag) => {
      if (!showDeprecated && flag.status === 'Deprecated') return false;

      if (selectedTags.length > 0) {
        if (!selectedTags.every((t) => flag.tags.includes(t))) return false;
      }

      if (words.length > 0) {
        const hay =
          `${flag.name} ${flag.description} ${flag.tags.join(' ')}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }

      return true;
    });
  }, [state.flags, search, selectedTags, showDeprecated]);

  const role = currentUser?.role ?? 'Developer';
  const canCreate = canCreateFlag(role);
  const canEditMeta = canEditFlagMeta(role);
  const canStatus = canChangeStatus(role);
  const canDelete = canDeleteFlag(role);
  const canStage = canEditStage(role);
  const canProd = canEditProduction(role);

  const pickDemoFlag = useCallback((): FeatureFlag | undefined => {
    return (
      state.flags.find((f) => f.id === demoFlagId) ??
      state.flags.find((f) => f.status === 'Active') ??
      state.flags[0]
    );
  }, [state.flags, demoFlagId]);

  const handleDemoAction = useCallback(
    (action: string) => {
      const flag = pickDemoFlag();

      if (action === 'cleanup') {
        setShowPublish(false);
        return;
      }

      if (action === 'expandFlag' || action === 'prepareToggle') {
        setSearch('');
        setSelectedTags([]);
        setShowDeprecated(false);
        if (flag) {
          setDemoFlagId(flag.id);
          setExpandedId(flag.id);
        }
        return;
      }

      if (action === 'toggleStage' || action === 'ensurePending') {
        if (!flag || !canStage) return;
        setDemoFlagId(flag.id);
        setExpandedId(flag.id);
        if (!isPending(flag.id, DEMO_BRAND, 'Stage')) {
          const current = getEffectiveValue(flag.id, DEMO_BRAND, 'Stage');
          stageToggle(flag.id, DEMO_BRAND, 'Stage', !current);
        }
        return;
      }

      if (action === 'openPublish') {
        setShowPublish(true);
        return;
      }

      if (action === 'publish') {
        publishChanges();
        setShowPublish(false);
      }
    },
    [
      pickDemoFlag,
      canStage,
      isPending,
      getEffectiveValue,
      stageToggle,
      publishChanges,
    ],
  );

  if (!currentUser) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const requestToggle = (
    flag: FeatureFlag,
    brand: Brand,
    environment: Environment,
    value: boolean,
  ) => {
    if (environment === 'Stage' && !canStage) return;
    if (environment === 'Production' && !canProd) return;
    stageToggle(flag.id, brand, environment, value);
  };

  return (
    <div className="view">
      <header className="view__header">
        <div>
          <h1>Feature flags</h1>
          <p className="view__subtitle">
            Global flags across {BRANDS.length} brands · Stage & Production
          </p>
        </div>
        <div className="view__actions">
          <PageTour page="flags" onDemoAction={handleDemoAction} />
          {canCreate && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setShowAdd(true)}
              data-tour="flags-add"
            >
              Add flag
            </button>
          )}
        </div>
      </header>

      <div className="toolbar" data-tour="flags-search">
        <input
          className="search"
          type="search"
          placeholder="Search name, description, tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showDeprecated}
            onChange={(e) => setShowDeprecated(e.target.checked)}
          />
          Show deprecated
        </label>
      </div>

      {allTags.length > 0 && (
        <div className="tag-filter" data-tour="flags-tags">
          <span className="tag-filter__label">Tags:</span>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`tag ${selectedTags.includes(tag) ? 'tag--active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
          {selectedTags.length > 0 && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setSelectedTags([])}
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="flag-list" data-tour="flags-list">
        {filtered.length === 0 ? (
          <p className="empty-state">No flags match your filters.</p>
        ) : (
          filtered.map((flag) => {
            const expanded = expandedId === flag.id;
            const isDemoFlag = flag.id === (demoFlagId ?? filtered[0]?.id);
            return (
              <article
                key={flag.id}
                className={`flag-row ${flag.status === 'Deprecated' ? 'flag-row--deprecated' : ''}`}
              >
                <button
                  type="button"
                  className="flag-row__summary"
                  onClick={() => setExpandedId(expanded ? null : flag.id)}
                >
                  <span className="flag-row__chevron" aria-hidden="true">
                    {expanded ? '▾' : '▸'}
                  </span>
                  <div className="flag-row__meta">
                    <div className="flag-row__title">
                      <code className="flag-name">{flag.name}</code>
                      <span
                        className={`status-badge status-badge--${flag.status.toLowerCase()}`}
                      >
                        {flag.status}
                      </span>
                    </div>
                    <p className="flag-row__desc">{flag.description || '—'}</p>
                    <div className="flag-row__tags">
                      {flag.tags.map((t) => (
                        <span key={t} className="tag tag--static">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="flag-row__detail">
                    <div className="flag-row__controls">
                      {canEditMeta && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => setEditing(flag)}
                        >
                          Edit
                        </button>
                      )}
                      {canStatus && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() =>
                            setFlagStatus(
                              flag.id,
                              flag.status === 'Active'
                                ? 'Deprecated'
                                : 'Active',
                            )
                          }
                        >
                          Mark{' '}
                          {flag.status === 'Active' ? 'Deprecated' : 'Active'}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="btn btn--danger-ghost btn--sm"
                          onClick={() => setPendingDelete(flag)}
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    <div className="brand-grid">
                      <div className="brand-grid__head">
                        <span>Brand</span>
                        <span className="env-label env-label--stage">Stage</span>
                        <span className="env-label env-label--production">
                          Production
                        </span>
                      </div>
                      {BRANDS.map((brand) => (
                        <div key={brand} className="brand-grid__row">
                          <span className="brand-grid__brand">{brand}</span>
                          <div className="brand-grid__cell brand-grid__cell--stage">
                            <Toggle
                              environment="Stage"
                              on={getEffectiveValue(flag.id, brand, 'Stage')}
                              pending={isPending(flag.id, brand, 'Stage')}
                              disabled={!canStage}
                              dataTour={
                                isDemoFlag && brand === DEMO_BRAND
                                  ? 'demo-stage-toggle'
                                  : undefined
                              }
                              onRequest={(value) =>
                                requestToggle(flag, brand, 'Stage', value)
                              }
                            />
                          </div>
                          <div className="brand-grid__cell brand-grid__cell--production">
                            <Toggle
                              environment="Production"
                              on={getEffectiveValue(
                                flag.id,
                                brand,
                                'Production',
                              )}
                              pending={isPending(flag.id, brand, 'Production')}
                              disabled={!canProd}
                              onRequest={(value) =>
                                requestToggle(flag, brand, 'Production', value)
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {pendingCount > 0 && (
        <div className="publish-bar" data-tour="flags-publish-bar">
          <div className="publish-bar__text">
            <strong>{pendingCount}</strong> unpublished change
            {pendingCount === 1 ? '' : 's'}
          </div>
          <div className="publish-bar__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={discardChanges}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn btn--primary"
              data-tour="flags-publish-btn"
              onClick={() => setShowPublish(true)}
            >
              Publish changes
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <AddFlagModal
          onClose={() => setShowAdd(false)}
          onSubmit={createFlag}
          availableTags={allTags}
        />
      )}
      {editing && (
        <EditFlagModal
          flag={editing}
          availableTags={allTags}
          onClose={() => setEditing(null)}
          onSubmit={(patch) => updateFlag(editing.id, patch)}
        />
      )}
      {showPublish && (
        <PublishChangesModal onClose={() => setShowPublish(false)} />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete flag"
          danger
          confirmLabel="Delete permanently"
          message={
            <p>
              Permanently delete <strong>{pendingDelete.name}</strong>? This
              removes it from all brands and environments and cannot be undone.
            </p>
          }
          onConfirm={() => {
            deleteFlag(pendingDelete.id);
            setPendingDelete(null);
            setExpandedId(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

function Toggle({
  environment,
  on,
  pending,
  disabled,
  dataTour,
  onRequest,
}: {
  environment: Environment;
  on: boolean;
  pending?: boolean;
  disabled?: boolean;
  dataTour?: string;
  onRequest: (value: boolean) => void;
}) {
  const envClass =
    environment === 'Stage' ? 'toggle--stage' : 'toggle--production';
  return (
    <button
      type="button"
      className={`toggle ${envClass} ${on ? 'toggle--on' : ''} ${pending ? 'toggle--pending' : ''} ${disabled ? 'toggle--disabled' : ''}`}
      disabled={disabled}
      aria-pressed={on}
      aria-label={`${environment} ${on ? 'on' : 'off'}`}
      title={pending ? 'Staged — publish to apply' : environment}
      data-tour={dataTour}
      onClick={() => onRequest(!on)}
    >
      <span className="toggle__knob" />
      <span className="toggle__label">{on ? 'ON' : 'OFF'}</span>
    </button>
  );
}
