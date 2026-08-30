import {useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router';
import { ApiError, login } from '../api/client';
import type { AuthenticatedUser } from '../api/types';

type LoginPageProps = {
    onLogin: (user: AuthenticatedUser) => void;
};

function LoginPage({ onLogin }: LoginPageProps) {
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        const username = String(formData.get('username') ?? '');
        const password = String(formData.get('password') ?? '');

        setErrorMessage(null);
        setIsSubmitting(true);

        try {
            const user = await login(username, password);
            onLogin(user);
            navigate('/', { replace: true });
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                setErrorMessage('Invalid username or password.');
            } else {
                setErrorMessage('Unable to sign in. Please try again');
            }
        } finally {
            setIsSubmitting(false);
        }
    }

return (
    <main className="login-page">
      <section className="login-card">
        <i className="pi pi-home login-card__icon" aria-hidden="true" />
        <p className="page-header__eyebrow">Home Dashboard</p>
        <h1>Herrera Family</h1>
        <p className="page-header__subtitle">Sign in to continue.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />

          {errorMessage && (
            <p className="login-form__error" role="alert">
              {errorMessage}
            </p>
          )}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
