import { useMemo, useState } from 'react';
import { BRANDS } from '../types';
import type { AuditActionType, Brand } from '../types';
import { useStore } from '../store/StoreContext';
import { AUDIT_ACTION_LABELS } from '../permissions';
import { PageTour } from './PageTour';

const ACTION_TYPES = Object.keys(AUDIT_ACTION_LABELS) as AuditActionType[];

export function AuditView() {
  const { state } = useStore();
  const [userFilter, setUserFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState<Brand | ''>('');
  const [flagFilter, setFlagFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditActionType | ''>('');

  const flagNames = useMemo(() => {
    const names = new Set(state.flags.map((f) => f.name));
    for (const e of state.auditLog) {
      if (e.flagName) names.add(e.flagName);
    }
    return [...names].sort();
  }, [state.flags, state.auditLog]);

  const filtered = useMemo(() => {
    return state.auditLog.filter((entry) => {
      if (userFilter && entry.userId !== userFilter) return false;
      if (brandFilter && entry.brand !== brandFilter) return false;
      if (flagFilter && entry.flagName !== flagFilter) return false;
      if (actionFilter && entry.action !== actionFilter) return false;
      return true;
    });
  }, [state.auditLog, userFilter, brandFilter, flagFilter, actionFilter]);

  return (
    <div className="view">
      <header className="view__header">
        <div>
          <h1>Audit log</h1>
          <p className="view__subtitle">
            Every change, newest first — filter by user, brand, flag, or action
          </p>
        </div>
        <div className="view__actions">
          <PageTour page="audit" />
        </div>
      </header>

      <div className="filters" data-tour="audit-filters">
        <label className="field">
          <span>User</span>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
          >
            <option value="">All users</option>
            {state.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Brand</span>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value as Brand | '')}
          >
            <option value="">All brands</option>
            {BRANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Flag</span>
          <select
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value)}
          >
            <option value="">All flags</option>
            {flagNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Action</span>
          <select
            value={actionFilter}
            onChange={(e) =>
              setActionFilter(e.target.value as AuditActionType | '')
            }
          >
            <option value="">All actions</option>
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>
                {AUDIT_ACTION_LABELS[a]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state" data-tour="audit-list">
          No audit entries match your filters.
        </p>
      ) : (
        <ul className="audit-list" data-tour="audit-list">
          {filtered.map((entry) => (
            <li key={entry.id} className="audit-item">
              <div className="audit-item__top">
                <span className="audit-item__action">
                  {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                <time dateTime={entry.timestamp}>
                  {new Date(entry.timestamp).toLocaleString()}
                </time>
              </div>
              <p className="audit-item__summary">{entry.summary}</p>
              <div className="audit-item__meta">
                <span>{entry.userEmail}</span>
                {entry.brand && <span>{entry.brand}</span>}
                {entry.environment && <span>{entry.environment}</span>}
                {entry.flagName && (
                  <code className="flag-name">{entry.flagName}</code>
                )}
              </div>
              {(entry.before !== undefined || entry.after !== undefined) && (
                <div className="audit-item__diff">
                  {entry.before !== undefined && (
                    <span>
                      <em>Before:</em> {entry.before}
                    </span>
                  )}
                  {entry.after !== undefined && (
                    <span>
                      <em>After:</em> {entry.after}
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
