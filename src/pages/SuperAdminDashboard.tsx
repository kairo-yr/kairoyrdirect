import { useEffect, useState } from 'react';
import { BellRing, Building2, Clock, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { getAcademies, getAuditLogs, type Academy, type AcademyCounts, type AuditLog } from '../lib/academyApi';
import { getAcademyStatusClass } from '../utils/academyStatus';
import { formatDateTime } from '../utils/dateFormat';
import { RoleDashboard } from './RoleDashboard';

const initialCounts: AcademyCounts = {
  totalAcademies: 0,
  activeAcademies: 0,
  pendingAcademies: 0,
  disabledAcademies: 0,
};

export function SuperAdminDashboard() {
  const [counts, setCounts] = useState<AcademyCounts>(initialCounts);
  const [pendingAcademies, setPendingAcademies] = useState<Academy[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError('');
      try {
        const [academies, logs] = await Promise.all([getAcademies(), getAuditLogs()]);
        setCounts({
          totalAcademies: academies.length,
          activeAcademies: academies.filter((academy) => academy.status === 'active').length,
          pendingAcademies: academies.filter((academy) => academy.status === 'pending').length,
          disabledAcademies: academies.filter((academy) => academy.status === 'disabled').length,
        });
        setPendingAcademies(academies.filter((academy) => academy.status === 'pending').slice(0, 5));
        setAuditLogs(logs.slice(0, 5));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load dashboard data.');
      } finally {
        setLoading(false);
      }
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
      </div>

      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}

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
                <td className="px-5 py-4 text-slate-600">{academy.owner_email || 'Not available'}</td>
                <td className="px-5 py-4"><Badge className={getAcademyStatusClass(academy.status)}>{academy.status}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{formatDateTime(academy.created_at)}</td>
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
                <td className="px-5 py-4 text-slate-600">{formatDateTime(log.created_at)}</td>
                <td className="px-5 py-4 text-slate-600">{log.actor?.email || log.actor_user_id || 'Not available'}</td>
                <td className="px-5 py-4 font-black text-navy">{log.action || 'Not available'}</td>
                <td className="px-5 py-4 text-slate-600">{log.entity_type || 'Not available'}</td>
                <td className="px-5 py-4 text-slate-600">{log.academy?.name || log.entity_id || 'Not available'}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
