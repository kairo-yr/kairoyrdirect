import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AppLayout } from '../components/layout/AppLayout';
import { AcademyAttendancePage, CoachAttendancePage } from '../pages/AcademyAttendancePage';
import { AcademyClassReportsPage, CoachClassReportsPage } from '../pages/AcademyClassReportsPage';
import { AcademyDashboard } from '../pages/AcademyDashboard';
import { AcademyBatchesPage } from '../pages/AcademyBatchesPage';
import { AcademyCoachesPage } from '../pages/AcademyCoachesPage';
import { AcademyFeesPage } from '../pages/AcademyFeesPage';
import { AcademyInvitesPage } from '../pages/AcademyInvitesPage';
import { AcademyProgressPage, CoachProgressPage, StudentProgressPage } from '../pages/AcademyProgressPage';
import { AcademySettingsPage } from '../pages/AcademySettingsPage';
import { AcademyStudentsPage } from '../pages/AcademyStudentsPage';
import { AttendancePage } from '../pages/AttendancePage';
import { BatchesPage } from '../pages/BatchesPage';
import { CoachesPage } from '../pages/CoachesPage';
import { CoachDashboard } from '../pages/CoachDashboard';
import { DashboardRedirect } from '../pages/DashboardRedirect';
import { FeesPage } from '../pages/FeesPage';
import { LandingPage } from '../pages/LandingPage';
import { JoinInviteLookup } from '../pages/JoinInviteLookup';
import { JoinInvitePage } from '../pages/JoinInvitePage';
import { LoginPage } from '../pages/LoginPage';
import { Onboarding } from '../pages/Onboarding';
import { PendingApproval } from '../pages/PendingApproval';
import { ParentDashboard } from '../pages/ParentDashboard';
import { ReportsPage } from '../pages/ReportsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { StudentProfilePage } from '../pages/StudentProfilePage';
import { StudentDashboard } from '../pages/StudentDashboard';
import { StudentsPage } from '../pages/StudentsPage';
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
      <Route path="/join" element={<JoinInviteLookup />} />
      <Route path="/join/:role/:inviteToken" element={<JoinInvitePage />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
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
        <Route path="/academy/attendance" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademyAttendancePage /></ProtectedRoute>} />
        <Route path="/academy/class-reports" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademyClassReportsPage /></ProtectedRoute>} />
        <Route path="/academy/progress" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademyProgressPage /></ProtectedRoute>} />
        <Route path="/academy/fees" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademyFeesPage /></ProtectedRoute>} />
        <Route path="/academy/invites" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademyInvitesPage /></ProtectedRoute>} />
        <Route path="/academy/settings" element={<ProtectedRoute allowedRoles={['academy_admin']}><AcademySettingsPage /></ProtectedRoute>} />
        <Route path="/coach" element={<ProtectedRoute allowedRoles={['coach']}><CoachDashboard /></ProtectedRoute>} />
        <Route path="/coach/attendance" element={<ProtectedRoute allowedRoles={['coach']}><CoachAttendancePage /></ProtectedRoute>} />
        <Route path="/coach/class-reports" element={<ProtectedRoute allowedRoles={['coach']}><CoachClassReportsPage /></ProtectedRoute>} />
        <Route path="/coach/progress" element={<ProtectedRoute allowedRoles={['coach']}><CoachProgressPage /></ProtectedRoute>} />
        <Route path="/parent" element={<ProtectedRoute allowedRoles={['parent']}><ParentDashboard /></ProtectedRoute>} />
        <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/progress" element={<ProtectedRoute allowedRoles={['student']}><StudentProgressPage /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute allowedRoles={['unassigned']}><Onboarding /></ProtectedRoute>} />
        <Route path="/pending-approval" element={<ProtectedRoute allowedRoles={['unassigned']} allowedStatuses={['pending']}><PendingApproval /></ProtectedRoute>} />
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route path="/students" element={<ProtectedRoute allowedRoles={['coach']}><StudentsPage /></ProtectedRoute>} />
        <Route path="/students/:studentId" element={<ProtectedRoute allowedRoles={['coach', 'student', 'parent']}><StudentProfilePage /></ProtectedRoute>} />
        <Route path="/batches" element={<ProtectedRoute allowedRoles={['coach']}><BatchesPage /></ProtectedRoute>} />
        <Route path="/coaches" element={<ProtectedRoute allowedRoles={['coach']}><CoachesPage /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute allowedRoles={['coach']}><AttendancePage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allowedRoles={['coach', 'student', 'parent']}><ReportsPage /></ProtectedRoute>} />
        <Route path="/fees" element={<ProtectedRoute allowedRoles={['parent']}><FeesPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allowedRoles={['super_admin', 'coach', 'student', 'parent']}><SettingsPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
