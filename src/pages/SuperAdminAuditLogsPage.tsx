import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Search } from 'lucide-react';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { FormInput } from '../components/ui/FormInput';
import { PageHeader } from '../components/ui/PageHeader';
import { db } from '../lib/firebase';
import { formatFirestoreDate } from '../utils/firestoreFormat';

type AuditLog = {
  id: string;
  actorEmail?: string;
  actorRole?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  message?: string;
  createdAt?: unknown;
};

export function SuperAdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'auditLogs'));
      setLogs(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AuditLog));
      setLoading(false);
    };

    void loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) =>
      [log.actorEmail, log.action, log.targetType, log.targetId, log.message]
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
          <FormInput label="Search by actor, action, target, or message" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </section>
      {loading ? (
        <EmptyState title="Loading audit logs" description="Checking platform activity records." />
      ) : filteredLogs.length === 0 ? (
        <EmptyState title="No audit logs yet" description="Super admin actions will be recorded here." />
      ) : (
        <DataTable columns={['Created', 'Actor', 'Role', 'Action', 'Target Type', 'Message']}>
          {filteredLogs.map((log) => (
            <tr className="border-t border-slate-100" key={log.id}>
              <td className="px-5 py-4 text-slate-600">{formatFirestoreDate(log.createdAt)}</td>
              <td className="px-5 py-4 text-slate-600">{log.actorEmail || 'Not available'}</td>
              <td className="px-5 py-4 text-slate-600">{log.actorRole || 'Not available'}</td>
              <td className="px-5 py-4 font-black text-navy">{log.action || 'Not available'}</td>
              <td className="px-5 py-4 text-slate-600">{log.targetType || 'Not available'}</td>
              <td className="px-5 py-4 text-slate-600">{log.message || 'Not available'}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
