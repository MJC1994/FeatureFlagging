export function authErrorMessage(
  code: string | null,
  domain: string,
): string | null {
  if (!code) return null;
  switch (code) {
    case 'domain_not_allowed':
      return `Only @${domain} Google accounts can sign in.`;
    case 'not_invited':
      return 'Your Google account is not invited yet. Ask an Owner to add your email first.';
    case 'email_unverified':
      return 'Your Google email is not verified.';
    case 'google_denied':
      return 'Google sign-in was cancelled.';
    case 'invalid_state':
      return 'Sign-in expired. Please try again.';
    case 'oauth_failed':
      return 'Google sign-in failed. Please try again.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}
