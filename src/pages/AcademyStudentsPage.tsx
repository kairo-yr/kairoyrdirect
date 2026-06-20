import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { collection, getDocs, query, serverTimestamp, updateDoc, where, doc } from 'firebase/firestore';
import { Copy, Edit3, Eye, Plus, RotateCcw, UserX } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { AcademyInvite, AcademyStudentProfile } from '../types/auth';
import { statusStyles } from '../utils/badgeStyles';
import { academyInviteLink, createAcademyStudentWithInvite } from '../utils/academyAdmin';
import { formatFirestoreDate } from '../utils/firestoreFormat';
import { createAuditLog } from '../utils/superAdminActions';

type StudentForm = {
  name: string;
  email: string;
  phone: string;
  monthlyFee: string;
};

const initialForm: StudentForm = { name: '', email: '', phone: '', monthlyFee: '' };

function statusClass(status: string) {
  if (status === 'active') return statusStyles.active;
  if (status === 'disabled') return statusStyles.inactive;
  return statusStyles.pending;
}

function statusLabel(status: string) {
  if (status === 'profile_only') return 'Profile Only';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function AcademyStudentsPage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const [students, setStudents] = useState<AcademyStudentProfile[]>([]);
  const [invites, setInvites] = useState<AcademyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<AcademyStudentProfile | null>(null);
  const [editing, setEditing] = useState<AcademyStudentProfile | null>(null);
  const [form, setForm] = useState<StudentForm>(initialForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const inviteById = useMemo(() => new Map(invites.map((invite) => [invite.id, invite])), [invites]);

  const loadStudents = async () => {
    if (!academyId || userProfile?.role !== 'academy_admin') {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [studentSnapshot, inviteSnapshot] = await Promise.all([
      getDocs(collection(db, 'academies', academyId, 'students')),
      getDocs(query(collection(db, 'academyInvites'), where('academyId', '==', academyId))),
    ]);
    setStudents(studentSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyStudentProfile));
    setInvites(inviteSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyInvite));
    setLoading(false);
  };

  useEffect(() => {
    void loadStudents();
  }, [academyId, userProfile?.role]);

  const updateField = (field: keyof StudentForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const openAddModal = () => {
    setEditing(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (student: AcademyStudentProfile) => {
    setEditing(student);
    setForm({
      name: student.name,
      email: student.email ?? '',
      phone: student.phone ?? '',
      monthlyFee: student.monthlyFee === null || student.monthlyFee === undefined ? '' : String(student.monthlyFee),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!academyId || !userProfile) return;
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Student name and phone number are required.');
      return;
    }
    const monthlyFee = form.monthlyFee.trim() ? Number(form.monthlyFee) : null;
    if (monthlyFee !== null && (!Number.isFinite(monthlyFee) || monthlyFee < 0)) {
      setError('Monthly fee must be 0 or more.');
      return;
    }
    setError('');
    setMessage('');
    try {
      if (editing) {
        const previousInvite = editing.inviteId ? inviteById.get(editing.inviteId) : undefined;
        const normalizedEmail = form.email.trim().toLowerCase();
        await updateDoc(doc(db, 'academies', academyId, 'students', editing.id), {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: normalizedEmail,
          monthlyFee,
          updatedAt: serverTimestamp(),
        });
        if (previousInvite?.status === 'pending' && normalizedEmail) {
          await updateDoc(doc(db, 'academyInvites', previousInvite.id), { email: normalizedEmail });
        }
        setMessage(previousInvite?.status === 'accepted' ? 'Student updated. Accepted invite ownership was not changed.' : 'Student updated.');
      } else {
        const invite = await createAcademyStudentWithInvite({
          academyId,
          actor: userProfile,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          monthlyFee,
        });
        setMessage(invite ? `Student invite created: ${academyInviteLink('student', invite.inviteToken)}` : 'Student added. Add an email later to generate an invite link.');
      }
      setForm(initialForm);
      setEditing(null);
      setModalOpen(false);
      await loadStudents();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save student.');
    }
  };

  const handleDisable = async (student: AcademyStudentProfile) => {
    if (!academyId || !userProfile) return;
    await updateDoc(doc(db, 'academies', academyId, 'students', student.id), { status: 'disabled', updatedAt: serverTimestamp() });
    await createAuditLog({
      actor: userProfile,
      action: 'academy.student.disabled',
      targetType: 'student',
      targetId: student.id,
      academyId,
      message: `${student.name} student profile disabled.`,
      metadata: { academyId },
    });
    await loadStudents();
  };

  const handleReactivate = async (student: AcademyStudentProfile) => {
    if (!academyId || !userProfile) return;
    await updateDoc(doc(db, 'academies', academyId, 'students', student.id), { status: 'active', updatedAt: serverTimestamp() });
    await createAuditLog({
      actor: userProfile,
      action: 'academy.student.reactivated',
      targetType: 'student',
      targetId: student.id,
      academyId,
      message: `${student.name} student profile reactivated.`,
      metadata: { academyId },
    });
    await loadStudents();
  };

  const handleCopyInvite = async (student: AcademyStudentProfile) => {
    const invite = student.inviteId ? inviteById.get(student.inviteId) : undefined;
    if (!invite) return;
    const link = academyInviteLink('student', invite.inviteToken);
    await navigator.clipboard.writeText(link);
    setMessage(`Copied invite link: ${link}`);
  };

  if (!academyId) {
    return <EmptyState title="Academy profile not linked" description="Your academy profile is not linked correctly. Contact Kairoyr support." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academy Students"
        description="Manage invited and active students for your academy only."
        action={<button className="inline-flex items-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white" onClick={openAddModal} type="button"><Plus size={18} /> Add Student</button>}
      />
      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}
      {loading ? (
        <EmptyState title="Loading students" description="Checking academy student profiles." />
      ) : students.length === 0 ? (
        <EmptyState title="No students added yet" description="Add your first student." />
      ) : (
        <DataTable columns={['Name', 'Email', 'Phone', 'Status', 'Batch', 'Created', 'Actions']}>
          {students.map((student) => {
            const invite = student.inviteId ? inviteById.get(student.inviteId) : undefined;
            return (
              <tr className="border-t border-slate-100" key={student.id}>
                <td className="px-5 py-4 font-black text-navy">{student.name}</td>
                <td className="px-5 py-4 text-slate-600">{student.email || 'Not added'}</td>
                <td className="px-5 py-4 text-slate-600">{student.phone || 'Not added'}</td>
                <td className="px-5 py-4"><Badge className={statusClass(student.status)}>{statusLabel(student.status)}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{'batchId' in student && student.batchId ? String(student.batchId) : 'Not assigned'}</td>
                <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(student.createdAt)}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => setViewing(student)} type="button" aria-label="View student" title="View student"><Eye size={16} /></button>
                    <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => openEditModal(student)} type="button" aria-label="Edit student" title="Edit student"><Edit3 size={16} /></button>
                    {student.status === 'invited' && invite ? <button className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={() => handleCopyInvite(student)} type="button" aria-label="Copy invite" title="Copy invite link"><Copy size={16} /></button> : null}
                    {student.status === 'disabled' ? (
                      <button className="rounded-xl bg-emerald-600 p-2 text-white" onClick={() => handleReactivate(student)} type="button" aria-label="Reactivate student" title="Reactivate student"><RotateCcw size={16} /></button>
                    ) : (
                      <button className="rounded-xl border border-rose-100 p-2 text-rose-600" onClick={() => handleDisable(student)} type="button" aria-label="Disable student" title="Disable student"><UserX size={16} /></button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
      <Modal title={editing ? 'Edit Student' : 'Add Student'} description={editing ? 'Update safe student profile fields.' : 'Creates a student profile. Email is optional for invite generation.'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <FormInput label="Student name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
          <FormInput label="Phone number" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
          <FormInput label="Email optional" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
          <FormInput label="Monthly fee optional" min="0" type="number" value={form.monthlyFee} onChange={(event) => updateField('monthlyFee', event.target.value)} />
          <div className="flex justify-end gap-3">
            <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="rounded-2xl bg-directBlue px-5 py-3 text-sm font-black text-white" type="submit">{editing ? 'Save Student' : 'Add Student'}</button>
          </div>
        </form>
      </Modal>
      <Modal title="Student Details" description="Read-only student profile details." open={Boolean(viewing)} onClose={() => setViewing(null)}>
        {viewing ? (
          <div className="grid gap-3 text-sm">
            {[
              ['Student name', viewing.name],
              ['Email', viewing.email || 'Not added'],
              ['Phone number', viewing.phone || 'Not added'],
              ['Status', statusLabel(viewing.status)],
              ['Batch assignment', 'batchId' in viewing && viewing.batchId ? String(viewing.batchId) : 'Not assigned'],
              ['Monthly fee', viewing.monthlyFee === null || viewing.monthlyFee === undefined ? 'Not set' : `₹${viewing.monthlyFee}`],
              ['Invite status/link', viewing.inviteId && inviteById.get(viewing.inviteId) ? `${inviteById.get(viewing.inviteId)?.status} · ${academyInviteLink('student', inviteById.get(viewing.inviteId)!.inviteToken)}` : 'No invite'],
              ['Created date', formatFirestoreDate(viewing.createdAt)],
              ['Linked user UID', viewing.userUid || 'Not linked'],
            ].map(([label, value]) => (
              <div className="rounded-2xl bg-slate-50 p-4" key={label}>
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
                <div className="mt-1 break-words font-black text-navy">{value}</div>
              </div>
            ))}
            <div className="flex justify-end">
              <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" onClick={() => setViewing(null)} type="button">Close</button>
            </div>
          </div>
        ) : <EmptyState title="Profile not found" description="The selected student profile could not be loaded." />}
      </Modal>
    </div>
  );
}
