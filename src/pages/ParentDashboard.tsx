import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { RoleDashboard } from './RoleDashboard';

export function ParentDashboard() {
  const { userProfile } = useAuth();

  return (
    <div className="space-y-6">
      <RoleDashboard
        title="Parent Dashboard"
        role="parent"
        description="Views child progress, attendance, homework, fee status, and class reports."
      />
      {userProfile?.linkedParentId ? (
        <EmptyState title="Child dashboard setup pending" description="Linked child profiles will appear here once parent-child linking is implemented." />
      ) : (
        <EmptyState title="No child profile linked yet" description="Parent accounts will show only linked child profiles after invite linking is enabled." />
      )}
    </div>
  );
}
