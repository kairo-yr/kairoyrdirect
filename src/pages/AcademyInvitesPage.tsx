import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Copy, XCircle } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { AcademyInvite } from '../types/auth';
import { statusStyles } from '../utils/badgeStyles';
import { academyInviteLink, revokeAcademyInvite } from '../utils/academyAdmin';
import { formatFirestoreDate } from '../utils/firestoreFormat';

function inviteStatusClass(status: string) {
  if (status === 'pending') return statusStyles.pending;
  if (status === 'accepted') return statusStyles.active;
  return statusStyles.inactive;
}

export function AcademyInvitesPage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;
  const [invites, setInvites] = useState<AcademyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadInvites = async () => {
    if (!academyId || userProfile?.role !== 'academy_admin') {
      setLoading(false);
      return;
    }
    setLoading(true);
    const snapshot = await getDocs(query(collection(db, 'academyInvites'), where('academyId', '==', academyId)));
    setInvites(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyInvite));
    setLoading(false);
  };

  useEffect(() => {
    void loadInvites();
  }, [academyId, userProfile?.role]);

  const handleCopy = async (invite: AcademyInvite) => {
    const link = academyInviteLink(invite.role, invite.inviteToken);
    await navigator.clipboard.writeText(link);
    setMessage(`Copied invite link: ${link}`);
  };

  const handleRevoke = async (invite: AcademyInvite) => {
    if (!academyId || !userProfile) return;
    setError('');
    setMessage('');
    try {
      await revokeAcademyInvite({ academyId, inviteId: invite.id, actor: userProfile });
      setMessage('Invite revoked.');
      await loadInvites();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not revoke invite.');
    }
  };

  if (!academyId) {
    return <EmptyState title="Academy profile not linked" description="Your academy profile is not linked correctly. Contact Kairoyr support." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Academy Invites" description="Monitor and revoke invite links for this academy only." />
      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}
      {loading ? (
        <EmptyState title="Loading invites" description="Checking academy invite records." />
      ) : invites.length === 0 ? (
        <EmptyState title="No invites sent yet" description="Student and coach invite links will appear here." />
      ) : (
        <DataTable columns={['Email', 'Role', 'Status', 'Created', 'Expires', 'Accepted', 'Invite Link', 'Action']}>
          {invites.map((invite) => (
            <tr className="border-t border-slate-100" key={invite.id}>
              <td className="px-5 py-4 font-black text-navy">{invite.email}</td>
              <td className="px-5 py-4 text-slate-600">{invite.role}</td>
              <td className="px-5 py-4"><Badge className={inviteStatusClass(invite.status)}>{invite.status}</Badge></td>
              <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(invite.createdAt)}</td>
              <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(invite.expiresAt)}</td>
              <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(invite.acceptedAt)}</td>
              <td className="max-w-[280px] truncate px-5 py-4 font-mono text-xs font-black text-directBlue">{academyInviteLink(invite.role, invite.inviteToken)}</td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <button className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700" onClick={() => handleCopy(invite)} type="button"><Copy size={14} /> Copy</button>
                  {invite.status === 'pending' ? <button className="inline-flex items-center gap-1 rounded-xl border border-rose-100 px-3 py-2 text-xs font-black text-rose-600" onClick={() => handleRevoke(invite)} type="button"><XCircle size={14} /> Revoke</button> : null}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
