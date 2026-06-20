import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { BellRing, Building2, CheckCircle2, Clock, KeyRound, ShieldCheck, UserRound, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { db } from '../lib/firebase';
import type { AcademyInvite, AcademyRegistration, UserProfile } from '../types/auth';
import { getAcademyStatusClass } from '../utils/academyStatus';
import { formatFirestoreDate } from '../utils/firestoreFormat';
import { RoleDashboard } from './RoleDashboard';

type AuditLog = {
  id: string;
  actorEmail?: string;
  action?: string;
  targetType?: string;
  message?: string;
  createdAt?: unknown;
};

type DashboardCounts = {
  totalAcademies: number;
  activeAcademies: number;
  pendingAcademies: number;
  disabledAcademies: number;
  totalUsers: number;
  academyAdmins: number;
  coaches: number;
  students: number;
  parents: number;
  unassignedUsers: number;
  totalInvites: number;
  pendingInvites: number;
  acceptedInvites: number;
};

const initialCounts: DashboardCounts = {
  totalAcademies: 0,
  activeAcademies: 0,
  pendingAcademies: 0,
  disabledAcademies: 0,
  totalUsers: 0,
  academyAdmins: 0,
  coaches: 0,
  students: 0,
  parents: 0,
  unassignedUsers: 0,
  totalInvites: 0,
  pendingInvites: 0,
  acceptedInvites: 0,
};

export function SuperAdminDashboard() {
  const [counts, setCounts] = useState<DashboardCounts>(initialCounts);
  const [pendingAcademies, setPendingAcademies] = useState<AcademyRegistration[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      const [academySnapshot, userSnapshot, inviteSnapshot, auditSnapshot] = await Promise.all([
        getDocs(collection(db, 'academies')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'academyInvites')),
        getDocs(collection(db, 'auditLogs')),
      ]);
      const academies = academySnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyRegistration);
      const users = userSnapshot.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }) as UserProfile);
      const invites = inviteSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AcademyInvite);
      setCounts({
        totalAcademies: academies.length,
        activeAcademies: academies.filter((academy) => academy.status === 'active').length,
        pendingAcademies: academies.filter((academy) => academy.status === 'pending').length,
        disabledAcademies: academies.filter((academy) => academy.status === 'disabled').length,
        totalUsers: users.length,
        academyAdmins: users.filter((user) => user.role === 'academy_admin').length,
        coaches: users.filter((user) => user.role === 'coach').length,
        students: users.filter((user) => user.role === 'student').length,
        parents: users.filter((user) => user.role === 'parent').length,
        unassignedUsers: users.filter((user) => user.role === 'unassigned').length,
        totalInvites: invites.length,
        pendingInvites: invites.filter((invite) => invite.status === 'pending').length,
        acceptedInvites: invites.filter((invite) => invite.status === 'accepted').length,
      });
      setPendingAcademies(academies.filter((academy) => academy.status === 'pending').slice(0, 5));
      setAuditLogs(auditSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AuditLog).slice(0, 5));
      setLoading(false);
    };

    void loadDashboard();
  }, []);

  return (
    <div className="space-y-6">
      <RoleDashboard
        title="Super Admin Dashboard"
        role="super_admin"
        description="Platform control center for academies, users, invites, approvals, and audit logs."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Academies" value={loading ? '...' : String(counts.totalAcademies)} helper="Registered academies" icon={Building2} />
        <StatCard label="Active Academies" value={loading ? '...' : String(counts.activeAcademies)} helper="Approved academy accounts" icon={ShieldCheck} />
        <StatCard label="Pending Academies" value={loading ? '...' : String(counts.pendingAcademies)} helper="Awaiting review" icon={Clock} />
        <StatCard label="Disabled Academies" value={loading ? '...' : String(counts.disabledAcademies)} helper="Not deleted" icon={BellRing} />
        <StatCard label="Total Users" value={loading ? '...' : String(counts.totalUsers)} helper="All user profiles" icon={Users} />
        <StatCard label="Academy Admins" value={loading ? '...' : String(counts.academyAdmins)} helper="Active academy owners" icon={UserRound} />
        <StatCard label="Coaches" value={loading ? '...' : String(counts.coaches)} helper="Coach accounts" icon={UserRound} />
        <StatCard label="Students" value={loading ? '...' : String(counts.students)} helper="Student accounts" icon={UserRound} />
        <StatCard label="Parents" value={loading ? '...' : String(counts.parents)} helper="Parent accounts" icon={UserRound} />
        <StatCard label="Unassigned Users" value={loading ? '...' : String(counts.unassignedUsers)} helper="Pending onboarding" icon={UserRound} />
        <StatCard label="Total Invites" value={loading ? '...' : String(counts.totalInvites)} helper="Invite records" icon={KeyRound} />
        <StatCard label="Pending Invites" value={loading ? '...' : String(counts.pendingInvites)} helper={`${counts.acceptedInvites} accepted`} icon={KeyRound} />
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Link className="rounded-2xl bg-directBlue px-4 py-3 text-center text-sm font-black text-white" to="/super-admin/academies">View Academies</Link>
        <Link className="rounded-2xl bg-directBlue px-4 py-3 text-center text-sm font-black text-white" to="/super-admin/approvals">Review Approvals</Link>
        <Link className="rounded-2xl bg-directBlue px-4 py-3 text-center text-sm font-black text-white" to="/super-admin/users">View Users</Link>
        <Link className="rounded-2xl bg-directBlue px-4 py-3 text-center text-sm font-black text-white" to="/super-admin/audit-logs">View Audit Logs</Link>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-black text-navy">Recent Pending Academy Approvals</h2>
        {loading ? (
          <EmptyState title="Loading approvals" description="Checking pending academy registration requests." />
        ) : pendingAcademies.length === 0 ? (
          <EmptyState title="No pending academies" description="New academy registration requests will appear here." />
        ) : (
          <DataTable columns={['Academy', 'Owner Email', 'Status', 'Created', 'Action']}>
            {pendingAcademies.map((academy) => (
              <tr className="border-t border-slate-100" key={academy.id}>
                <td className="px-5 py-4 font-black text-navy">{academy.name}</td>
                <td className="px-5 py-4 text-slate-600">{academy.ownerEmail}</td>
                <td className="px-5 py-4"><Badge className={getAcademyStatusClass(academy.status)}>{academy.status}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(academy.createdAt)}</td>
                <td className="px-5 py-4"><Link className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700" to={`/super-admin/academies/${academy.id}`}>Review</Link></td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-black text-navy">Recent Audit Logs</h2>
        {loading ? (
          <EmptyState title="Loading audit logs" description="Checking platform activity." />
        ) : auditLogs.length === 0 ? (
          <EmptyState title="No audit logs yet" description="Super admin actions will be recorded here." />
        ) : (
          <DataTable columns={['Created', 'Actor', 'Action', 'Target', 'Message']}>
            {auditLogs.map((log) => (
              <tr className="border-t border-slate-100" key={log.id}>
                <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(log.createdAt)}</td>
                <td className="px-5 py-4 text-slate-600">{log.actorEmail || 'Not available'}</td>
                <td className="px-5 py-4 font-black text-navy">{log.action || 'Not available'}</td>
                <td className="px-5 py-4 text-slate-600">{log.targetType || 'Not available'}</td>
                <td className="px-5 py-4 text-slate-600">{log.message || 'Not available'}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
