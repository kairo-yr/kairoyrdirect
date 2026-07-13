import { StudentManager } from '../components/students/StudentManager';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';

export function AcademyStudentsPage() {
  const { userProfile } = useAuth();
  const academyId = userProfile?.academyId;

  if (!academyId) {
    return <EmptyState title="Academy profile not linked" description="Your academy profile is not linked correctly. Contact Kairoyr support." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Academy Students" description="Manage Supabase student profiles for your academy." />
      <StudentManager
        academyId={academyId}
        canManage={userProfile?.app_role === 'academy_admin'}
        title="Student Profiles"
        description="Student records are stored in Supabase and linked to academy memberships when a matching student profile exists."
      />
    </div>
  );
}
