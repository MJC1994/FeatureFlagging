import { useState, type ReactNode } from 'react';
import type { View } from './types';
import { StoreProvider, useStore } from './store/StoreContext';
import { FlagList } from './components/FlagList';
import { ConfigView } from './components/ConfigView';
import { UsersView } from './components/UsersView';
import { AuditView } from './components/AuditView';
import { HistoryView } from './components/HistoryView';
import './App.css';

const NAV: { id: View; label: string; icon: ReactNode }[] = [
  {
    id: 'flags',
    label: 'Flags',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="nav__icon">
        <path
          fill="currentColor"
          d="M5 3v18h2V13h7.2l.8 1.6H21V5h-7.2L13 3.4H5zm2 2h5.3l.8 1.6H19v4h-5.3L13 9H7V5z"
        />
      </svg>
    ),
  },
  {
    id: 'config',
    label: 'Config',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="nav__icon">
        <path
          fill="currentColor"
          d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.5.42l-.36 2.54c-.59.22-1.14.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.3-.06.61-.06.94s.02.64.06.94L2.82 14.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.49.4 1.04.72 1.63.94l.36 2.54c.05.24.26.42.5.42h3.8c.24 0 .45-.18.5-.42l.36-2.54c.59-.22 1.14-.53 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
        />
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'Users',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="nav__icon">
        <path
          fill="currentColor"
          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z"
        />
      </svg>
    ),
  },
  {
    id: 'audit',
    label: 'Audit',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="nav__icon">
        <path
          fill="currentColor"
          d="M7 3h8l4 4v14H7V3zm2 2v14h10V8h-3V5H9zm2 5h6v2h-6v-2zm0 4h6v2h-6v-2z"
        />
      </svg>
    ),
  },
  {
    id: 'history',
    label: 'History',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="nav__icon">
        <path
          fill="currentColor"
          d="M12 4a8 8 0 1 1-7.45 5H6.7A6.5 6.5 0 1 0 12 5.5V4zm-1 3h2v5.2l3.4 2-1 1.7L11 13V7zM4 7h4v2H5.4l1.7 1.7-1.4 1.4L3 9.4V7z"
        />
      </svg>
    ),
  },
];

function Shell() {
  const [view, setView] = useState<View>('flags');
  const { state, currentUser, setCurrentUser } = useStore();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark">◈</span>
          <div>
            <div className="brand__name">Flagdeck</div>
            <div className="brand__tag">Multi-brand flags</div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav__item ${view === item.id ? 'nav__item--active' : ''}`}
              onClick={() => setView(item.id)}
              data-tour={`nav-${item.id}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__user" data-tour="acting-as">
          <label className="field">
            <span>Acting as</span>
            <select
              value={currentUser.id}
              onChange={(e) => setCurrentUser(e.target.value)}
            >
              {state.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email} ({u.role})
                </option>
              ))}
            </select>
          </label>
          <p className="sidebar__role-hint">
            Switch users to preview role permissions.
          </p>
        </div>
      </aside>

      <main className="main">
        {view === 'flags' && <FlagList />}
        {view === 'config' && <ConfigView />}
        {view === 'users' && <UsersView />}
        {view === 'audit' && <AuditView />}
        {view === 'history' && <HistoryView />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
