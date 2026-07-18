import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { PageHeader } from '../components/ui/PageHeader';
import { listInvites } from '../lib/operationsApi';
import type { AcademyInvite, InviteStatus } from '../types/auth';
import { statusStyles } from '../utils/badgeStyles';
import { formatDateTime } from '../utils/dateFormat';

type InviteFilter = 'all' | InviteStatus;

function inviteStatusClass(status: InviteStatus) {
  if (status === 'pending') return statusStyles.pending;
  if (status === 'accepted') return statusStyles.active;
  if (status === 'expired') return statusStyles.overdue;
  return statusStyles.inactive;
}

export function SuperAdminInvitesPage() {
  const [invites, setInvites] = useState<AcademyInvite[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InviteFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInvites = async () => {
      setLoading(true);
      setInvites(await listInvites() as AcademyInvite[]);
      setLoading(false);
    };

    void loadInvites();
  }, []);

  const filteredInvites = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invites.filter((invite) => {
      const statusMatches = statusFilter === 'all' || invite.status === statusFilter;
      const searchMatches = !term || [invite.email, invite.role, invite.status, invite.academyId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      return statusMatches && searchMatches;
    });
  }, [invites, search, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader title="Invites" description="Read-only monitoring for academy invite links." />
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-2 text-navy"><Search size={20} /><h2 className="text-xl font-black">Search and Filter</h2></div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
          <FormInput label="Search by email, role, status, or academyId" value={search} onChange={(event) => setSearch(event.target.value)} />
          <FormSelect label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as InviteFilter)} options={[
            { label: 'All', value: 'all' },
            { label: 'Pending', value: 'pending' },
            { label: 'Accepted', value: 'accepted' },
            { label: 'Revoked', value: 'revoked' },
            { label: 'Expired', value: 'expired' },
          ]} />
        </div>
      </section>
      {loading ? (
        <EmptyState title="Loading invites" description="Checking invite records." />
      ) : filteredInvites.length === 0 ? (
        <EmptyState title="No invites found" description="Invite records will appear here when academies create them." />
      ) : (
        <DataTable columns={['Email', 'Role', 'Status', 'Academy', 'Profile', 'Created', 'Expires', 'Accepted', 'Accepted By']}>
          {filteredInvites.map((invite) => (
            <tr className="border-t border-slate-100" key={invite.id}>
              <td className="px-5 py-4 font-black text-navy">{invite.email}</td>
              <td className="px-5 py-4 text-slate-600">{invite.role}</td>
              <td className="px-5 py-4"><Badge className={inviteStatusClass(invite.status)}>{invite.status}</Badge></td>
              <td className="px-5 py-4 text-slate-600">{invite.academyId}</td>
              <td className="px-5 py-4 text-slate-600">{invite.linkedProfileId}</td>
              <td className="px-5 py-4 text-slate-600">{formatDateTime(invite.createdAt)}</td>
              <td className="px-5 py-4 text-slate-600">{formatDateTime(invite.expiresAt)}</td>
              <td className="px-5 py-4 text-slate-600">{formatDateTime(invite.acceptedAt)}</td>
              <td className="px-5 py-4 text-slate-600">{invite.acceptedByUid || 'Not accepted'}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
