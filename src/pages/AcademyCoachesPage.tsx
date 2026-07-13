import { CoachManager } from '../components/coaches/CoachManager';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';

export function AcademyCoachesPage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;

  if (!academyId) {
    return <EmptyState title="Academy profile not linked" description="Your academy profile is not linked correctly. Contact Kairoyr support." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Academy Coaches" description="Manage Supabase coach profiles for your academy." />
      <CoachManager
        academyId={academyId}
        canManage={userProfile?.app_role === 'academy_admin'}
        title="Coach Profiles"
        description="Coach records are stored in Supabase and linked to academy memberships when a matching user profile exists."
      />
    </div>
  );
}
