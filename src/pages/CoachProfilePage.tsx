import { useEffect, useState, type FormEvent } from 'react';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';

type CoachProfile = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
};

export function CoachProfilePage() {
  const { refreshUserProfile, userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const linkedCoachId = userProfile?.linkedCoachId;
  const [coach, setCoach] = useState<CoachProfile | null>(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      if (!academyId || !linkedCoachId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const snapshot = await getDoc(doc(db, 'academies', academyId, 'coaches', linkedCoachId));
        const loadedCoach = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as CoachProfile) : null;
        setCoach(loadedCoach);
        setForm({
          name: loadedCoach?.name || userProfile?.name || '',
          phone: loadedCoach?.phone || '',
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load coach profile.');
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [academyId, linkedCoachId, userProfile?.name]);

  const updateField = (field: 'name' | 'phone', value: string) => {
    setMessage('');
    setError('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!academyId || !linkedCoachId || !userProfile) return;
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, 'academies', academyId, 'coaches', linkedCoachId), payload);
      await updateDoc(doc(db, 'users', userProfile.uid), payload);
      await refreshUserProfile();
      setCoach((current) => current ? { ...current, name: payload.name, phone: payload.phone } : current);
      setMessage('Profile updated.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!linkedCoachId) {
    return <EmptyState title="Your coach profile is not linked yet" description="Contact your academy." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Coach Profile" description="Edit safe personal details for your coach account." />
      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}
      {loading ? (
        <EmptyState title="Loading profile" description="Checking your linked coach profile." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="text-xl font-black text-navy">Account Details</h2>
            <div className="mt-5 grid gap-3 text-sm">
              {[
                ['Name', coach?.name || userProfile?.name || 'Not available'],
                ['Email', coach?.email || userProfile?.email || 'Not available'],
                ['Phone', coach?.phone || 'Not added'],
                ['Role', 'Coach'],
                ['Academy ID', academyId || 'Not assigned'],
                ['Linked Coach ID', linkedCoachId],
                ['Account status', userProfile?.status || coach?.status || 'Not available'],
              ].map(([label, value]) => (
                <div className="rounded-2xl bg-slate-50 p-4" key={label}>
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="mt-1 break-words font-black text-navy">{value}</div>
                </div>
              ))}
            </div>
          </section>
          <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" onSubmit={handleSubmit}>
            <h2 className="text-xl font-black text-navy">Edit Personal Details</h2>
            <div className="mt-5 grid gap-4">
              <FormInput label="Name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
              <FormInput label="Phone" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
            </div>
            <div className="mt-6 flex justify-end">
              <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={saving} type="submit">
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
