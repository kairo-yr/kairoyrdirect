import { useEffect, useMemo, useState } from 'react';
import { Ban, RotateCcw, Search } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { FormSelect } from '../components/ui/FormSelect';
import { PageHeader } from '../components/ui/PageHeader';
import { ROLE_LABELS } from '../constants/roles';
import { useAuth } from '../contexts/AuthContext';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getApplicationUsers, setApplicationUserStatus } from '../lib/userApi';
import type { Role, UserProfile, UserStatus } from '../types/auth';
import { statusStyles } from '../utils/badgeStyles';
import { formatFirestoreDate } from '../utils/firestoreFormat';

type RoleFilter = 'all' | Role;
type StatusFilter = 'all' | UserStatus;

function getUserActionLabel(user: UserProfile, currentUser: UserProfile | null) {
  if (user.uid === currentUser?.uid) return 'Current Super Admin';
  if (user.role === 'super_admin') return 'Protected Admin';
  return null;
}

export function SuperAdminUsersPage() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const refresh = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      setUsers(await getApplicationUsers());
    } catch (caught) {
      setUsers([]);
      setError(caught instanceof Error ? caught.message : 'Could not load the canonical application user list.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useRefreshOnFocus(() => refresh(false));

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const roleMatches = roleFilter === 'all' || user.role === roleFilter;
      const statusMatches = statusFilter === 'all' || user.status === statusFilter;
      const searchMatches = !term || [user.name, user.email, user.role, user.status, user.academyId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      return roleMatches && statusMatches && searchMatches;
    });
  }, [roleFilter, search, statusFilter, users]);

  const runAction = async (userId: string, status: 'active' | 'disabled', success: string) => {
    setMessage('');
    setError('');
    setActionUserId(userId);
    try {
      await setApplicationUserStatus(userId, status);
      setMessage(success);
      await refresh(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action failed.');
    } finally {
      setActionUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Canonical application users backed by Supabase Auth and profiles." />
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-2 text-navy"><Search size={20} /><h2 className="text-xl font-black">Search and Filter</h2></div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px_180px]">
          <FormInput label="Search by name, email, role, status, or academyId" value={search} onChange={(event) => setSearch(event.target.value)} />
          <FormSelect label="Role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)} options={[
            { label: 'All roles', value: 'all' },
            { label: 'Super admin', value: 'super_admin' },
            { label: 'Academy admin', value: 'academy_admin' },
            { label: 'Coach', value: 'coach' },
            { label: 'Student', value: 'student' },
            { label: 'Unassigned', value: 'unassigned' },
          ]} />
          <FormSelect label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} options={[
            { label: 'All Statuses', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Pending', value: 'pending' },
            { label: 'Disabled', value: 'disabled' },
          ]} />
        </div>
      </section>
      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</div> : null}
      {loading ? (
        <EmptyState title="Loading users" description="Checking user profiles." />
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">
          <span>{error}</span>
          <button className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs" onClick={() => void refresh()} type="button">Retry</button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState title="No users found" description="Try a different search or filter." />
      ) : (
        <DataTable columns={['Name', 'Email', 'Role', 'Status', 'Academy', 'Linked IDs', 'Created', 'Last Login', 'Action']}>
          {filteredUsers.map((user) => {
            const protectedLabel = getUserActionLabel(user, userProfile);
            return (
              <tr className="border-t border-slate-100" key={user.uid}>
                <td className="px-5 py-4 font-black text-navy">{user.name || 'Not available'}</td>
                <td className="px-5 py-4 text-slate-600">{user.email}</td>
                <td className="px-5 py-4 text-slate-600">{ROLE_LABELS[user.role]}</td>
                <td className="px-5 py-4"><Badge className={user.status === 'active' ? statusStyles.active : user.status === 'pending' ? statusStyles.pending : statusStyles.inactive}>{user.status}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{user.academyId || 'Not assigned'}</td>
                <td className="px-5 py-4 text-xs text-slate-600">S:{user.linkedStudentId || '-'} P:{user.linkedParentId || '-'}</td>
                <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(user.createdAt)}</td>
                <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(user.lastLoginAt)}</td>
                <td className="px-5 py-4">
                  {protectedLabel ? (
                    <span className="text-sm font-black text-slate-500">{protectedLabel}</span>
                  ) : user.status === 'disabled' ? (
                    <button className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60" disabled={actionUserId !== null} onClick={() => runAction(user.uid, 'active', `${user.email} reactivated.`)} type="button">
                      <RotateCcw size={14} /> {actionUserId === user.uid ? 'Saving…' : 'Reactivate'}
                    </button>
                  ) : (
                    <button className="inline-flex items-center gap-1 rounded-xl border border-rose-100 px-3 py-2 text-xs font-black text-rose-600 disabled:opacity-60" disabled={actionUserId !== null} onClick={() => runAction(user.uid, 'disabled', `${user.email} disabled.`)} type="button">
                      <Ban size={14} /> {actionUserId === user.uid ? 'Saving…' : 'Disable'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
