import { useStore } from '../store/StoreContext';
import { authErrorMessage } from '../authMessages';

export function LoginView() {
  const { googleEnabled, allowedDomain, authError, error } = useStore();
  const message = authErrorMessage(authError, allowedDomain);

  return (
    <div className="login">
      <div className="login__panel">
        <div className="login__brand">
          <span className="brand__mark">◈</span>
          <div>
            <div className="brand__name">Flagdeck</div>
            <div className="brand__tag">Multi-brand flags</div>
          </div>
        </div>

        <h1 className="login__title">Sign in</h1>
        <p className="login__copy">
          Use your Google account. Only{' '}
          <strong>@{allowedDomain}</strong> addresses can access Flagdeck, and
          your email must already be invited by an Owner.
        </p>

        {(message || error) && (
          <p className="login__error" role="alert">
            {message ?? error}
          </p>
        )}

        {googleEnabled ? (
          <a className="login__google" href="/api/auth/login">
            <GoogleIcon />
            Continue with Google
          </a>
        ) : (
          <div className="login__setup">
            <p>
              Google sign-in is not configured yet. Add these to{' '}
              <code>.dev.vars</code> (local) or Worker secrets:
            </p>
            <ul>
              <li>
                <code>GOOGLE_CLIENT_ID</code>
              </li>
              <li>
                <code>GOOGLE_CLIENT_SECRET</code>
              </li>
              <li>
                <code>SESSION_SECRET</code>
              </li>
            </ul>
            <p>
              Create an OAuth client in Google Cloud Console with redirect URI{' '}
              <code>http://localhost:5173/api/auth/callback</code>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.4c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4c-.2-.7-.4-1.4-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"
      />
    </svg>
  );
}
