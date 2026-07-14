import { useEffect, useState, type FormEvent } from 'react';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';

type StudentProfile = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  status?: string;
};

type BatchRecord = {
  id: string;
  name?: string;
  studentIds?: string[];
};

export function StudentProfileSettingsPage() {
  const { refreshUserProfile, userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const linkedStudentId = userProfile?.linkedStudentId;
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [form, setForm] = useState({ name: '', phone: '', guardianName: '', guardianPhone: '', guardianEmail: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      if (!academyId || !linkedStudentId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const [studentSnapshot, batchSnapshot] = await Promise.all([
          getDoc(doc(db, 'academies', academyId, 'students', linkedStudentId)),
          getDocs(query(collection(db, 'academies', academyId, 'batches'), where('studentIds', 'array-contains', linkedStudentId))),
        ]);
        const loadedStudent = studentSnapshot.exists() ? ({ id: studentSnapshot.id, ...studentSnapshot.data() } as StudentProfile) : null;
        setStudent(loadedStudent);
        setBatches(batchSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BatchRecord));
        setForm({
          name: loadedStudent?.name || userProfile?.name || '',
          phone: loadedStudent?.phone || '',
          guardianName: loadedStudent?.guardianName || loadedStudent?.parentName || '',
          guardianPhone: loadedStudent?.guardianPhone || loadedStudent?.parentPhone || '',
          guardianEmail: loadedStudent?.guardianEmail || loadedStudent?.parentEmail || '',
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load student profile.');
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [academyId, linkedStudentId, userProfile?.name]);

  const updateField = (field: keyof typeof form, value: string) => {
    setMessage('');
    setError('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!academyId || !linkedStudentId || !userProfile) return;
    if (!form.name.trim()) {
      setError('Student name is required.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateDoc(doc(db, 'academies', academyId, 'students', linkedStudentId), {
        name: form.name.trim(),
        phone: form.phone.trim(),
        guardianName: form.guardianName.trim(),
        guardianPhone: form.guardianPhone.trim(),
        guardianEmail: form.guardianEmail.trim().toLowerCase(),
        parentName: form.guardianName.trim(),
        parentPhone: form.guardianPhone.trim(),
        parentEmail: form.guardianEmail.trim().toLowerCase(),
        updatedAt: serverTimestamp(),
      });
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: form.name.trim(),
          phone: form.phone.trim() || null,
        })
        .eq('id', userProfile.uid);
      if (profileError) throw profileError;
      await refreshUserProfile();
      setStudent((current) => current ? {
        ...current,
        name: form.name.trim(),
        phone: form.phone.trim(),
        guardianName: form.guardianName.trim(),
        guardianPhone: form.guardianPhone.trim(),
        guardianEmail: form.guardianEmail.trim().toLowerCase(),
      } : current);
      setMessage('Profile updated.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const batchNames = batches.map((batch) => batch.name || 'Untitled batch');

  if (!linkedStudentId) {
    return <EmptyState title="Your student profile is not linked yet" description="Contact your academy." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Student Profile" description="Edit safe student and guardian / contact details." />
      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}
      {loading ? (
        <EmptyState title="Loading profile" description="Checking your linked student profile." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="text-xl font-black text-navy">Account Details</h2>
            <div className="mt-5 grid gap-3 text-sm">
              {[
                ['Student name', student?.name || userProfile?.name || 'Not available'],
                ['Login email', student?.email || userProfile?.email || 'Not available'],
                ['Phone', student?.phone || 'Not added'],
                ['Guardian / contact name', student?.guardianName || student?.parentName || 'Not added'],
                ['Guardian / contact phone', student?.guardianPhone || student?.parentPhone || 'Not added'],
                ['Guardian / contact email', student?.guardianEmail || student?.parentEmail || 'Not added'],
                ['Role', 'Student'],
                ['Assigned batch', batchNames.join(', ') || 'Not assigned'],
                ['Account status', userProfile?.status || student?.status || 'Not available'],
              ].map(([label, value]) => (
                <div className="rounded-2xl bg-slate-50 p-4" key={label}>
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="mt-1 break-words font-black text-navy">{value}</div>
                </div>
              ))}
            </div>
          </section>
          <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card" onSubmit={handleSubmit}>
            <h2 className="text-xl font-black text-navy">Edit Contact Details</h2>
            <div className="mt-5 grid gap-4">
              <FormInput label="Student name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
              <FormInput label="Phone" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
              <FormInput label="Guardian / contact name" value={form.guardianName} onChange={(event) => updateField('guardianName', event.target.value)} />
              <FormInput label="Guardian / contact phone" value={form.guardianPhone} onChange={(event) => updateField('guardianPhone', event.target.value)} />
              <FormInput label="Guardian / contact email" type="email" value={form.guardianEmail} onChange={(event) => updateField('guardianEmail', event.target.value)} />
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
