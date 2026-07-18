import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AppLayout } from '../components/layout/AppLayout';
import { ClassSessionAttendancePage } from '../pages/ClassSessionAttendancePage';
import { AcademyClassReportsPage, CoachClassReportsPage } from '../pages/AcademyClassReportsPage';
import { AcademyDashboard } from '../pages/AcademyDashboard';
import { AcademyBatchesPage } from '../pages/AcademyBatchesPage';
import { AcademyClassSlotsPage } from '../pages/AcademyClassSlotsPage';
import { AcademyCoachesPage } from '../pages/AcademyCoachesPage';
import { AcademyFeesPage, StudentFeesPage } from '../pages/AcademyFeesPage';
import { AcademyInvitesPage } from '../pages/AcademyInvitesPage';
import { AcademyProgressPage, CoachProgressPage, StudentProgressPage } from '../pages/AcademyProgressPage';
import { AcademySettingsPage } from '../pages/AcademySettingsPage';
import { AcademyStudentsPage } from '../pages/AcademyStudentsPage';
import { CoachBatchesPage } from '../pages/CoachBatchesPage';
import { CoachDashboard } from '../pages/CoachDashboard';
import { CoachProfilePage } from '../pages/CoachProfilePage';
import { CoachStudentsPage } from '../pages/CoachStudentsPage';
import { DashboardRedirect } from '../pages/DashboardRedirect';
import { HomeworkPage } from '../pages/HomeworkPage';
import { LandingPage } from '../pages/LandingPage';
import { JoinInviteLookup } from '../pages/JoinInviteLookup';
import { JoinInvitePage } from '../pages/JoinInvitePage';
import { LoginPage } from '../pages/LoginPage';
import { Onboarding } from '../pages/Onboarding';
import { PendingApproval } from '../pages/PendingApproval';
import { SettingsPage } from '../pages/SettingsPage';
import { StudentDashboard } from '../pages/StudentDashboard';
import { StudentProfileSettingsPage } from '../pages/StudentProfileSettingsPage';
import { StudentSectionPage } from '../pages/StudentSectionPage';
import { SuperAdminAcademiesPage } from '../pages/SuperAdminAcademiesPage';
import { SuperAdminAcademyDetailPage } from '../pages/SuperAdminAcademyDetailPage';
import { SuperAdminApprovalsPage } from '../pages/SuperAdminApprovalsPage';
import { SuperAdminAuditLogsPage } from '../pages/SuperAdminAuditLogsPage';
import { SuperAdminDashboard } from '../pages/SuperAdminDashboard';
import { SuperAdminInvitesPage } from '../pages/SuperAdminInvitesPage';
import { SuperAdminUsersPage } from '../pages/SuperAdminUsersPage';
import { Unauthorized } from '../pages/Unauthorized';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<DashboardRedirect />} />
      <Route path="/join" element={<JoinInviteLookup />} />
      <Route path="/join/:role/:inviteToken" element={<JoinInvitePage />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      {import.meta.env.DEV ? <Route path="/_qa/session-attendance" element={<ClassSessionAttendancePage mode="academy" preview />} /> : null}
      <Route element={<AppLayout />}>
        <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />
        <Route path="/super-admin/academies" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminAcademiesPage /></ProtectedRoute>} />
        <Route path="/super-admin/academies/:academyId" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminAcademyDetailPage /></ProtectedRoute>} />
        <Route path="/super-admin/approvals" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminApprovalsPage /></ProtectedRoute>} />
        <Route path="/super-admin/users" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminUsersPage /></ProtectedRoute>} />
        <Route path="/super-admin/invites" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminInvitesPage /></ProtectedRoute>} />
        <Route path="/super-admin/audit-logs" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminAuditLogsPage /></ProtectedRoute>} />
        <Route path="/super-admin/settings" element={<ProtectedRoute allowedRoles={['super_admin']}><SettingsPage /></ProtectedRoute>} />
        <Route path="/academy" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademyDashboard /></ProtectedRoute>} />
        <Route path="/academy/students" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademyStudentsPage /></ProtectedRoute>} />
        <Route path="/academy/coaches" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademyCoachesPage /></ProtectedRoute>} />
        <Route path="/academy/batches" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademyBatchesPage /></ProtectedRoute>} />
        <Route path="/academy/class-schedules" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademyClassSlotsPage /></ProtectedRoute>} />
        <Route path="/academy/attendance" element={<ProtectedRoute allowedRoles={['academy_admin']}><ClassSessionAttendancePage mode="academy" /></ProtectedRoute>} />
        <Route path="/academy/class-reports" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademyClassReportsPage /></ProtectedRoute>} />
        <Route path="/academy/progress" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademyProgressPage /></ProtectedRoute>} />
        <Route path="/academy/homework" element={<ProtectedRoute allowedRoles={['academy_admin']}><HomeworkPage mode="academy" /></ProtectedRoute>} />
        <Route path="/academy/fees" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademyFeesPage /></ProtectedRoute>} />
        <Route path="/academy/invites" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademyInvitesPage /></ProtectedRoute>} />
        <Route path="/academy/settings" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademySettingsPage /></ProtectedRoute>} />
        <Route path="/coach" element={<ProtectedRoute allowedRoles={['coach']}><CoachDashboard /></ProtectedRoute>} />
        <Route path="/coach/batches" element={<ProtectedRoute allowedRoles={['coach']}><CoachBatchesPage /></ProtectedRoute>} />
        <Route path="/coach/students" element={<ProtectedRoute allowedRoles={['coach']}><CoachStudentsPage /></ProtectedRoute>} />
        <Route path="/coach/attendance" element={<ProtectedRoute allowedRoles={['coach']}><ClassSessionAttendancePage mode="coach" /></ProtectedRoute>} />
        <Route path="/coach/class-reports" element={<ProtectedRoute allowedRoles={['coach']}><CoachClassReportsPage /></ProtectedRoute>} />
        <Route path="/coach/progress" element={<ProtectedRoute allowedRoles={['coach']}><CoachProgressPage /></ProtectedRoute>} />
        <Route path="/coach/homework" element={<ProtectedRoute allowedRoles={['coach']}><HomeworkPage mode="coach" /></ProtectedRoute>} />
        <Route path="/coach/profile" element={<ProtectedRoute allowedRoles={['coach']}><CoachProfilePage /></ProtectedRoute>} />
        <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/attendance" element={<ProtectedRoute allowedRoles={['student']}><StudentSectionPage section="attendance" /></ProtectedRoute>} />
        <Route path="/student/class-reports" element={<ProtectedRoute allowedRoles={['student']}><StudentSectionPage section="classReports" /></ProtectedRoute>} />
        <Route path="/student/progress" element={<ProtectedRoute allowedRoles={['student']}><StudentProgressPage /></ProtectedRoute>} />
        <Route path="/student/fees" element={<ProtectedRoute allowedRoles={['student']}><StudentFeesPage /></ProtectedRoute>} />
        <Route path="/student/profile" element={<ProtectedRoute allowedRoles={['student']}><StudentProfileSettingsPage /></ProtectedRoute>} />
        <Route path="/student/homework" element={<ProtectedRoute allowedRoles={['student']}><HomeworkPage mode="student" /></ProtectedRoute>} />
        <Route path="/homework/:publicCode" element={<ProtectedRoute allowedRoles={['student']}><HomeworkPage mode="student" /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute allowedRoles={['unassigned', 'user']}><Onboarding /></ProtectedRoute>} />
        <Route path="/pending-approval" element={<ProtectedRoute allowedRoles={['unassigned', 'user']} allowedStatuses={['pending']}><PendingApproval /></ProtectedRoute>} />
        <Route path="/dashboard" element={<DashboardRedirect />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
