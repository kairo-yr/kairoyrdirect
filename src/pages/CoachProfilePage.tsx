import { useEffect, useState, type FormEvent } from 'react';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentCoach } from '../hooks/useCurrentCoach';
import { updateCoach, type Coach } from '../lib/coachApi';

export function CoachProfilePage() {
  const { refreshUserProfile, userProfile } = useAuth();
  const { coach: resolvedCoach, error: resolutionError, loading: resolutionLoading } = useCurrentCoach();
  const academyId = resolvedCoach?.academy_id ?? userProfile?.academyId;
  const [coach, setCoach] = useState<Coach | null>(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setCoach(resolvedCoach);
    setForm({
      name: resolvedCoach?.full_name || userProfile?.name || '',
      phone: resolvedCoach?.phone || '',
    });
  }, [resolvedCoach, userProfile?.name]);

  const updateField = (field: 'name' | 'phone', value: string) => {
    setMessage('');
    setError('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!coach) return;
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updatedCoach = await updateCoach(coach.id, {
        full_name: form.name,
        phone: form.phone,
      });
      await refreshUserProfile();
      setCoach(updatedCoach);
      setMessage('Profile updated.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Coach Profile" description="Edit safe personal details for your coach account." />
      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error || resolutionError ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error || resolutionError}</div> : null}
      {resolutionLoading ? (
        <EmptyState title="Loading profile" description="Checking your Supabase coach profile." />
      ) : !coach ? (
        <EmptyState title="Your coach profile is not linked yet" description="Contact your academy." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="text-xl font-black text-navy">Account Details</h2>
            <div className="mt-5 grid gap-3 text-sm">
              {[
                ['Name', coach.full_name || userProfile?.name || 'Not available'],
                ['Email', coach.email || userProfile?.email || 'Not available'],
                ['Phone', coach.phone || 'Not added'],
                ['Role', 'Coach'],
                ['Academy ID', coach.academy_id || academyId || 'Not assigned'],
                ['Linked Coach ID', coach.id],
                ['Membership ID', coach.membership_id || 'Not linked'],
                ['Account status', userProfile?.status || coach.status || 'Not available'],
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
