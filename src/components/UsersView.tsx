import { useState, type FormEvent } from 'react';
import { ROLES } from '../types';
import type { Role } from '../types';
import { useStore } from '../store/StoreContext';
import { canManageUsers } from '../permissions';
import { ConfirmDialog } from './Modal';

export function UsersView() {
  const {
    state,
    currentUser,
    addUser,
    changeUserRole,
    removeUser,
  } = useStore();

  const canManage = canManageUsers(currentUser.role);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Developer');
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  const handleInvite = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !canManage) return;
    addUser(email, role);
    setEmail('');
    setRole('Developer');
  };

  return (
    <div className="view">
      <header className="view__header">
        <div>
          <h1>Users</h1>
          <p className="view__subtitle">
            Invite teammates and assign Developer, Admin, or Owner roles
          </p>
        </div>
      </header>

      {!canManage && (
        <p className="banner banner--info">
          Only Owners can manage users. You can view the current roster.
        </p>
      )}

      {canManage && (
        <form className="invite-form" onSubmit={handleInvite}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              required
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn--primary">
            Invite user
          </button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            {canManage && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {state.users.map((user) => {
            const isSelf = user.id === currentUser.id;
            return (
              <tr key={user.id}>
                <td>
                  {user.email}
                  {isSelf && <span className="you-badge">you</span>}
                </td>
                <td>
                  {canManage ? (
                    <select
                      value={user.role}
                      disabled={isSelf}
                      title={
                        isSelf
                          ? 'You cannot change your own role'
                          : undefined
                      }
                      onChange={(e) =>
                        changeUserRole(user.id, e.target.value as Role)
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    user.role
                  )}
                </td>
                {canManage && (
                  <td>
                    {!isSelf && (
                      <button
                        type="button"
                        className="btn btn--danger-ghost btn--sm"
                        onClick={() => setPendingRemove(user.id)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {pendingRemove && (
        <ConfirmDialog
          title="Remove user"
          danger
          confirmLabel="Remove"
          message={
            <p>
              Remove{' '}
              <strong>
                {state.users.find((u) => u.id === pendingRemove)?.email}
              </strong>{' '}
              from the workspace?
            </p>
          }
          onConfirm={() => {
            removeUser(pendingRemove);
            setPendingRemove(null);
          }}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </div>
  );
}
