import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { CheckCircle2, XCircle } from 'lucide-react';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { AcademyRegistration } from '../types/auth';
import { formatFirestoreDate } from '../utils/firestoreFormat';
import { approveAcademy, rejectAcademy } from '../utils/superAdminActions';

export function SuperAdminApprovalsPage() {
  const { userProfile } = useAuth();
  const [academies, setAcademies] = useState<AcademyRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    const snapshot = await getDocs(query(collection(db, 'academies'), where('status', '==', 'pending')));
    setAcademies(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyRegistration));
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runAction = async (action: () => Promise<void>, success: string) => {
    setMessage('');
    setError('');
    try {
      await action();
      setMessage(success);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action failed.');
    }
  };

  const handleReject = async (academy: AcademyRegistration) => {
    if (!userProfile) return;
    const reason = window.prompt(`Reason for rejecting ${academy.name}?`);
    if (!reason?.trim()) return;
    await runAction(() => rejectAcademy(academy.id, reason.trim(), userProfile), `${academy.name} rejected.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Pending Approvals" description="Review academy registration requests awaiting super admin approval." />
      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}
      {loading ? (
        <EmptyState title="Loading approvals" description="Checking pending academy registration requests." />
      ) : academies.length === 0 ? (
        <EmptyState title="No pending academies" description="New academy registration requests will appear here." />
      ) : (
        <DataTable columns={['Academy', 'Owner Email', 'City', 'Phone', 'Created', 'Action']}>
          {academies.map((academy) => (
            <tr className="border-t border-slate-100" key={academy.id}>
              <td className="px-5 py-4 font-black text-navy">{academy.name}</td>
              <td className="px-5 py-4 text-slate-600">{academy.ownerEmail}</td>
              <td className="px-5 py-4 text-slate-600">{academy.city || 'Not available'}</td>
              <td className="px-5 py-4 text-slate-600">{academy.phone || 'Not available'}</td>
              <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(academy.createdAt)}</td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <button className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white" onClick={() => runAction(() => approveAcademy(academy.id, userProfile!), `${academy.name} approved.`)} type="button">
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button className="inline-flex items-center gap-1 rounded-xl border border-rose-100 px-3 py-2 text-xs font-black text-rose-600" onClick={() => handleReject(academy)} type="button">
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
