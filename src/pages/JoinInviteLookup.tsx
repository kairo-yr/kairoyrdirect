import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/ui/BrandMark';
import { FormInput } from '../components/ui/FormInput';
import { findInviteByToken } from '../lib/operationsApi';

function extractInvite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'join' && parts[1] && parts[2]) return { role: parts[1], token: parts[2] };
  } catch {
    const parts = trimmed.split('/').filter(Boolean);
    if (parts[0] === 'join' && parts[1] && parts[2]) return { role: parts[1], token: parts[2] };
  }

  return { token: trimmed };
}

export function JoinInviteLookup() {
  const navigate = useNavigate();
  const [inviteInput, setInviteInput] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const extracted = extractInvite(inviteInput);
    if (!extracted) {
      setError('Paste the invite link shared by your academy admin.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      if ('role' in extracted && extracted.role) {
        navigate(`/join/${extracted.role}/${extracted.token}`);
        return;
      }

      const invite = await findInviteByToken(extracted.token);
      if (!invite) {
        setError('No invite was found for that token.');
        return;
      }
      navigate(`/join/${invite.role}/${invite.inviteToken}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open that invite.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-soft">
        <Link to="/"><BrandMark /></Link>
        <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-directBlue">
          <KeyRound size={22} />
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-navy">Join Academy</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Paste the invite link from your academy admin. The invite can only be accepted by the matching Google email.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <FormInput label="Invite link or token" value={inviteInput} placeholder="https://.../join/student/invite-token" onChange={(event) => setInviteInput(event.target.value)} />
          {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
          <button className="w-full rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white disabled:opacity-60" disabled={submitting} type="submit">
            {submitting ? 'Checking...' : 'Continue'}
          </button>
        </form>
      </div>
    </main>
  );
}
