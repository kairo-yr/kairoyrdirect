import { useState, type FormEvent } from 'react';
import { Building2, KeyRound, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FormInput } from '../components/ui/FormInput';
import { useAuth } from '../contexts/AuthContext';

function extractInvitePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'join' && parts[1] && parts[2]) return `/join/${parts[1]}/${parts[2]}`;
  } catch {
    const parts = trimmed.split('/').filter(Boolean);
    if (parts[0] === 'join' && parts[1] && parts[2]) return `/join/${parts[1]}/${parts[2]}`;
  }

  return null;
}

export function Onboarding() {
  const { logout, registerAcademy, userProfile } = useAuth();
  const navigate = useNavigate();
  const [academyName, setAcademyName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!academyName.trim()) {
      setRegisterError('Academy name is required.');
      return;
    }
    if (!city.trim()) {
      setRegisterError('City is required.');
      return;
    }
    setSubmitting(true);
    setRegisterError('');
    try {
      await registerAcademy({ name: academyName.trim(), city: city.trim(), phone: phone.trim() });
      navigate('/pending-approval', { replace: true });
    } catch (caught) {
      setRegisterError(caught instanceof Error ? caught.message : 'Could not register academy.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const path = extractInvitePath(inviteLink);
    if (!path) {
      setJoinError('Paste the full invite link shared by your academy admin.');
      return;
    }
    navigate(path);
  };

  return (
    <main className="min-h-[70vh] px-5 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-card">
          <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-directBlue ring-1 ring-blue-100">Onboarding</div>
          <h1 className="mt-5 text-4xl font-black text-navy">Welcome to Kairoyr Direct</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your account ({userProfile?.email}) is not connected to an academy yet. Register your academy for approval or use the invite link shared by your academy admin.
          </p>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" onSubmit={handleRegister}>
            <div className="flex items-center gap-3 text-navy">
              <Building2 size={22} />
              <h2 className="text-xl font-black">Register my academy</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Submit your academy for Kairoyr approval. You will become academy admin only after approval.</p>
            <div className="mt-5 grid gap-4">
              <FormInput label="Academy name" value={academyName} onChange={(event) => setAcademyName(event.target.value)} />
              <FormInput label="City" value={city} onChange={(event) => setCity(event.target.value)} />
              <FormInput label="Phone number optional" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            {registerError ? <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{registerError}</div> : null}
            <button className="mt-5 rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={submitting} type="submit">
              {submitting ? 'Submitting...' : 'Register Academy'}
            </button>
          </form>

          <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" onSubmit={handleJoin}>
            <div className="flex items-center gap-3 text-navy">
              <KeyRound size={22} />
              <h2 className="text-xl font-black">Join with invite link</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Coaches, students, and parents join only through an email-matched invite link created by the academy admin.
            </p>
            <div className="mt-5">
              <FormInput label="Invite link" value={inviteLink} placeholder="https://.../join/student/invite-token" onChange={(event) => setInviteLink(event.target.value)} />
            </div>
            {joinError ? <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{joinError}</div> : null}
            <button className="mt-5 rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" type="submit">
              Continue to Invite
            </button>
            <button className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700" onClick={logout} type="button">
              <LogOut size={18} /> Logout
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
