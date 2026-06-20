import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/ui/BrandMark';
import { APP_NAME } from '../config/brand';
import { useAuth } from '../contexts/AuthContext';
import { getAuthRedirectPath } from '../utils/roleRedirects';

export function Login() {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setSubmitting(true);
    try {
      const profile = await loginWithGoogle();
      if (profile) {
        navigate(getAuthRedirectPath(profile), { replace: true });
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Google sign-in failed. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-soft">
        <Link to="/"><BrandMark /></Link>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-navy">Login to Direct</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Continue with Google to enter {APP_NAME}. Your dashboard is selected from your assigned Kairoyr Direct role.
        </p>
        {error ? <div className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
        <button
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white shadow-card disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
          onClick={handleGoogleLogin}
          type="button"
        >
          <LogIn size={18} />
          {submitting ? 'Connecting...' : 'Continue with Google'}
        </button>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          New users are created as unassigned until an academy registration is approved or an invite is accepted.
        </p>
      </div>
    </main>
  );
}
