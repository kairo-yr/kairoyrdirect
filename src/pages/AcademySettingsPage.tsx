import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { useAuth } from '../contexts/AuthContext';
import { getAcademyById, updateAcademy } from '../lib/academyApi';
import { createAuditLog } from '../utils/superAdminActions';

type AcademySettingsForm = {
  name: string;
  city: string;
  phone: string;
};

export function AcademySettingsPage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const [form, setForm] = useState<AcademySettingsForm>({ name: '', city: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAcademy = async () => {
      if (!academyId || userProfile?.app_role !== 'academy_admin') {
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await getAcademyById(academyId);
      if (data) {
        setForm({
          name: String(data.name ?? ''),
          city: String(data.city ?? ''),
          phone: String(data.primary_phone ?? ''),
        });
      }
      setLoading(false);
    };
    void loadAcademy();
  }, [academyId, userProfile?.app_role]);

  const updateField = (field: keyof AcademySettingsForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!academyId || !userProfile) return;
    if (!form.name.trim()) {
      setError('Academy name is required.');
      return;
    }
    setError('');
    setMessage('');
    try {
      await updateAcademy(academyId, {
        name: form.name.trim(),
        city: form.city.trim(),
        primary_phone: form.phone.trim(),
      });
      await createAuditLog({
        actor: userProfile,
        action: 'academy.settings.updated',
        targetType: 'academy',
        targetId: academyId,
        academyId,
        message: 'Academy settings updated.',
        metadata: { academyId },
      });
      setMessage('Academy settings updated.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update settings.');
    }
  };

  if (!academyId) {
    return <EmptyState title="Academy profile not linked" description="Your academy profile is not linked correctly. Contact Kairoyr support." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Academy Settings" description="Update safe profile fields for your academy only." />
      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}
      {loading ? (
        <EmptyState title="Loading academy settings" description="Checking your academy profile." />
      ) : (
        <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Academy name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
            <FormInput label="City" value={form.city} onChange={(event) => updateField('city', event.target.value)} />
            <FormInput label="Phone" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
          </div>
          <div className="mt-6 flex justify-end">
            <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" type="submit">Save Academy Settings</button>
          </div>
        </form>
      )}
    </div>
  );
}
