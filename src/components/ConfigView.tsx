import { useEffect, useState, type FormEvent } from 'react';
import { BRANDS, ENVIRONMENTS } from '../types';
import type { Brand, Environment } from '../types';
import type { BrandConfig } from '../configTypes';
import { useStore } from '../store/StoreContext';
import { canEditProduction, canEditStage } from '../permissions';
import { cloneConfig } from '../configDefaults';

export function ConfigView() {
  const { state, currentUser, updateBrandConfig } = useStore();
  const [brand, setBrand] = useState<Brand>('Southeastern');
  const [environment, setEnvironment] = useState<Environment>('Stage');
  const [draft, setDraft] = useState<BrandConfig>(() =>
    cloneConfig(state.configs[brand][environment].config),
  );
  const [warnings, setWarnings] = useState<string[]>(
    () => [...state.configs[brand][environment].warnings],
  );
  const [warningDraft, setWarningDraft] = useState('');
  const [saved, setSaved] = useState(false);

  const canEdit =
    environment === 'Stage'
      ? canEditStage(currentUser.role)
      : canEditProduction(currentUser.role);

  useEffect(() => {
    const entry = state.configs[brand][environment];
    setDraft(cloneConfig(entry.config));
    setWarnings([...entry.warnings]);
    setSaved(false);
    setWarningDraft('');
  }, [brand, environment, state.configs]);

  const setNumber = (key: 'apiTimeoutInMilliseconds' | 'apiJPJourneyPlanTimeoutInMilliseconds', value: string) => {
    const n = Number(value);
    setDraft((prev) => ({
      ...prev,
      [key]: Number.isFinite(n) ? n : 0,
    }));
    setSaved(false);
  };

  const setDoc = (key: keyof BrandConfig['documents'], value: string) => {
    if (key === 'magazine') return;
    setDraft((prev) => ({
      ...prev,
      documents: { ...prev.documents, [key]: value },
    }));
    setSaved(false);
  };

  const setMagazine = (key: keyof BrandConfig['documents']['magazine'], value: string) => {
    setDraft((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        magazine: { ...prev.documents.magazine, [key]: value },
      },
    }));
    setSaved(false);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    updateBrandConfig(brand, environment, draft, warnings);
    setSaved(true);
  };

  const addWarning = () => {
    const text = warningDraft.trim();
    if (!text) return;
    setWarnings((prev) => [...prev, text]);
    setWarningDraft('');
    setSaved(false);
  };

  return (
    <div className="view">
      <header className="view__header">
        <div>
          <h1>Brand config</h1>
          <p className="view__subtitle">
            Runtime config payload per brand and environment (documents,
            webchat, timeouts, …)
          </p>
        </div>
      </header>

      <div className="toolbar config-toolbar">
        <label className="field field--inline">
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
        <label className="field field--inline">
          <span>Environment</span>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as Environment)}
          >
            {ENVIRONMENTS.map((env) => (
              <option key={env} value={env}>
                {env}
              </option>
            ))}
          </select>
        </label>
        <span
          className={`env-label env-label--${environment === 'Stage' ? 'stage' : 'production'}`}
        >
          {environment}
        </span>
      </div>

      {!canEdit && (
        <p className="banner banner--info">
          Your role cannot edit {environment} config. Viewing only.
        </p>
      )}

      <form className="config-form" onSubmit={handleSave}>
        <section className="config-section">
          <h2>API timeouts</h2>
          <div className="config-grid">
            <label className="field">
              <span>apiTimeoutInMilliseconds</span>
              <input
                type="number"
                disabled={!canEdit}
                value={draft.apiTimeoutInMilliseconds}
                onChange={(e) =>
                  setNumber('apiTimeoutInMilliseconds', e.target.value)
                }
              />
            </label>
            <label className="field">
              <span>apiJPJourneyPlanTimeoutInMilliseconds</span>
              <input
                type="number"
                disabled={!canEdit}
                value={draft.apiJPJourneyPlanTimeoutInMilliseconds}
                onChange={(e) =>
                  setNumber(
                    'apiJPJourneyPlanTimeoutInMilliseconds',
                    e.target.value,
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className="config-section">
          <h2>Documents</h2>
          <div className="config-grid config-grid--stacked">
            {(
              [
                'accessibleDocumentLeafletPdfUrl',
                'accessibleDocumentLeafletPdfEasyReadUrl',
                'accessibleDocumentPolicyPdfUrl',
                'accessibleDocumentPolicyPdfEasyReadUrl',
                'accessibleDocumentRollingStockUrl',
                'accessibleWordLargePrintAudioUrl',
                'prioritySeatMoreInfoUrl',
              ] as const
            ).map((key) => (
              <label key={key} className="field">
                <span>{key}</span>
                <input
                  type="url"
                  disabled={!canEdit}
                  value={draft.documents[key]}
                  onChange={(e) => setDoc(key, e.target.value)}
                />
              </label>
            ))}
          </div>

          <h3 className="config-subsection">Magazine</h3>
          <div className="config-grid config-grid--stacked">
            {(
              ['title', 'description', 'url', 'imageUrl', 'srTitle'] as const
            ).map((key) => (
              <label key={key} className="field">
                <span>{key}</span>
                {key === 'description' || key === 'srTitle' ? (
                  <textarea
                    disabled={!canEdit}
                    rows={key === 'srTitle' ? 3 : 2}
                    value={draft.documents.magazine[key]}
                    onChange={(e) => setMagazine(key, e.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={draft.documents.magazine[key]}
                    onChange={(e) => setMagazine(key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
        </section>

        <section className="config-section">
          <h2>Webchat</h2>
          <label className="field">
            <span>url</span>
            <input
              type="url"
              disabled={!canEdit}
              value={draft.webchat.url}
              onChange={(e) => {
                setDraft((prev) => ({
                  ...prev,
                  webchat: { url: e.target.value },
                }));
                setSaved(false);
              }}
            />
          </label>
        </section>

        <section className="config-section">
          <h2>Smartcard</h2>
          <label className="field">
            <span>warningAtScanning (HTML allowed)</span>
            <textarea
              disabled={!canEdit}
              rows={3}
              value={draft.smartcard.warningAtScanning}
              onChange={(e) => {
                setDraft((prev) => ({
                  ...prev,
                  smartcard: { warningAtScanning: e.target.value },
                }));
                setSaved(false);
              }}
            />
          </label>
        </section>

        <section className="config-section">
          <h2>Best fare finder</h2>
          <div className="config-grid">
            <label className="field">
              <span>defaultNumberOfResults</span>
              <input
                type="number"
                disabled={!canEdit}
                value={draft.bestFareFinder.defaultNumberOfResults}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setDraft((prev) => ({
                    ...prev,
                    bestFareFinder: {
                      ...prev.bestFareFinder,
                      defaultNumberOfResults: Number.isFinite(n) ? n : 0,
                    },
                  }));
                  setSaved(false);
                }}
              />
            </label>
            <label className="field">
              <span>defaultNLC</span>
              <input
                type="text"
                disabled={!canEdit}
                value={draft.bestFareFinder.defaultNLC}
                onChange={(e) => {
                  setDraft((prev) => ({
                    ...prev,
                    bestFareFinder: {
                      ...prev.bestFareFinder,
                      defaultNLC: e.target.value,
                    },
                  }));
                  setSaved(false);
                }}
              />
            </label>
          </div>
        </section>

        <section className="config-section">
          <h2>Warnings</h2>
          {warnings.length === 0 ? (
            <p className="form__hint">No warnings configured.</p>
          ) : (
            <ul className="warning-list">
              {warnings.map((w, i) => (
                <li key={`${i}-${w}`}>
                  <span>{w}</span>
                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn--danger-ghost btn--sm"
                      onClick={() => {
                        setWarnings((prev) => prev.filter((_, idx) => idx !== i));
                        setSaved(false);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <div className="tag-picker__create">
              <input
                type="text"
                value={warningDraft}
                onChange={(e) => setWarningDraft(e.target.value)}
                placeholder="Add a warning message"
              />
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={!warningDraft.trim()}
                onClick={addWarning}
              >
                Add
              </button>
            </div>
          )}
        </section>

        {canEdit && (
          <div className="config-form__footer">
            {saved && (
              <span className="config-form__saved">Saved to {brand} · {environment}</span>
            )}
            <button type="submit" className="btn btn--primary">
              Save config
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
