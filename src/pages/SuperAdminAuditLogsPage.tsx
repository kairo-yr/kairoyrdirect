import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { PageHeader } from '../components/ui/PageHeader';
import { getAuditLogs, type AuditLog } from '../lib/academyApi';
import { formatFirestoreDate } from '../utils/firestoreFormat';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

export function SuperAdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      setLogs(await getAuditLogs());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load audit logs.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  useRefreshOnFocus(() => loadLogs(false));

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) =>
      [log.actor?.email, log.actor?.full_name, log.action, log.entity_type, log.entity_id, log.academy?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [logs, search]);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="Platform action history for super admin operations." />
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-2 text-navy"><Search size={20} /><h2 className="text-xl font-black">Search Audit Logs</h2></div>
        <div className="mt-4">
          <FormInput label="Search by actor, action, or target" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </section>
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</div> : null}
      {loading ? (
        <EmptyState title="Loading audit logs" description="Checking platform activity records." />
      ) : filteredLogs.length === 0 ? (
        <EmptyState title="No audit logs yet" description="Super admin actions will be recorded here." />
      ) : (
        <DataTable columns={['Created', 'Actor', 'Role', 'Action', 'Target Type', 'Target']}>
          {filteredLogs.map((log) => (
            <tr className="border-t border-slate-100" key={log.id}>
              <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(log.created_at)}</td>
              <td className="px-5 py-4 text-slate-600">{log.actor?.email || log.actor_user_id || 'Not available'}</td>
              <td className="px-5 py-4 text-slate-600">{log.actor?.platform_role === 'super_admin' ? 'super_admin' : log.actor?.app_role || 'Not available'}</td>
              <td className="px-5 py-4 font-black text-navy">{log.action || 'Not available'}</td>
              <td className="px-5 py-4 text-slate-600">{log.entity_type || 'Not available'}</td>
              <td className="px-5 py-4 text-slate-600">{log.academy?.name || log.entity_id || 'Not available'}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
