import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';

// Layouts
import { LearnerLayout } from '../layouts/LearnerLayout';
import { InstructorLayout } from '../layouts/InstructorLayout';
import { AdminLayout } from '../layouts/AdminLayout';

// Auth & Public Pages
import { LandingPage } from '../pages/learner/LandingPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { AuthCallbackPage } from '../pages/auth/AuthCallbackPage';
import { SetPasswordPage } from '../pages/auth/SetPasswordPage';
import { VerifyCertificatePage } from '../pages/learner/VerifyCertificatePage';

// Learner Pages
import { LearnerDashboardPage } from '../pages/learner/LearnerDashboardPage';
import { LearnerOnboardingPage } from '../pages/learner/LearnerOnboardingPage';
import { CourseDiscoveryPage } from '../pages/learner/CourseDiscoveryPage';
import { CourseDetailsPage } from '../pages/learner/CourseDetailsPage';
import { LearningWorkspacePage } from '../pages/learner/LearningWorkspacePage';
import { QuizPage } from '../pages/learner/QuizPage';
import { QuizResultPage } from '../pages/learner/QuizResultPage';
import { ProgressPage } from '../pages/learner/ProgressPage';
import { CertificatesPage } from '../pages/learner/CertificatesPage';
import { ProfilePage } from '../pages/learner/ProfilePage';
import { SettingsPage } from '../pages/learner/SettingsPage';

// Instructor Pages
import { InstructorDashboardPage } from '../pages/instructor/InstructorDashboardPage';
import { InstructorCoursesPage } from '../pages/instructor/InstructorCoursesPage';
import { CreateCoursePage } from '../pages/instructor/CreateCoursePage';
import { EditCoursePage } from '../pages/instructor/EditCoursePage';
import { CurriculumBuilderPage } from '../pages/instructor/CurriculumBuilderPage';
import { QuizManagementPage } from '../pages/instructor/QuizManagementPage';
import { CourseReviewPage } from '../pages/instructor/CourseReviewPage';
import { LessonEditorPage } from '../pages/instructor/LessonEditorPage';
import { AIQuizGenerationPage } from '../pages/instructor/AIQuizGenerationPage';
import { QuizBuilderPage } from '../pages/instructor/QuizBuilderPage';
import { AIDraftsPage } from '../pages/instructor/AIDraftsPage';
import { AIDraftReviewPage } from '../pages/instructor/AIDraftReviewPage';
import { InstructorAnalyticsPage } from '../pages/instructor/InstructorAnalyticsPage';
import { InstructorProfilePage } from '../pages/instructor/InstructorProfilePage';

// Admin Pages
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { DomainManagementPage } from '../pages/admin/DomainManagementPage';
import { SubDomainManagementPage } from '../pages/admin/SubDomainManagementPage';
import { UserManagementPage } from '../pages/admin/UserManagementPage';
import { CourseOversightPage } from '../pages/admin/CourseOversightPage';
import { GovernancePage } from '../pages/admin/GovernancePage';
import { AdminReportsPage } from '../pages/admin/AdminReportsPage';
import { AdminActivityPage } from '../pages/admin/AdminActivityPage';
import { AdminProfilePage } from '../pages/admin/AdminProfilePage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public & Auth Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/verify-certificate" element={<VerifyCertificatePage />} />
      <Route path="/verify-certificate/:certificateNumber" element={<VerifyCertificatePage />} />

      {/* Learner Portal */}
      <Route
        path="/learner/onboarding"
        element={
          <ProtectedRoute>
            <LearnerOnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/learner"
        element={
          <ProtectedRoute>
            <LearnerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<LearnerDashboardPage />} />
        <Route path="discover" element={<CourseDiscoveryPage />} />
        <Route path="courses/:courseId" element={<CourseDetailsPage />} />
        <Route path="learning/:courseId" element={<LearningWorkspacePage />} />
        <Route path="quiz/:quizId" element={<QuizPage />} />
        <Route path="quiz/:quizId/result" element={<QuizResultPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="certificates" element={<CertificatesPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Instructor Portal */}
      <Route
        path="/instructor"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['INSTRUCTOR', 'ADMIN']}>
              <InstructorLayout />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<InstructorDashboardPage />} />
        <Route path="courses" element={<InstructorCoursesPage />} />
        <Route path="courses/new" element={<CreateCoursePage />} />
        <Route path="courses/:courseId/edit" element={<EditCoursePage />} />
        <Route path="courses/:courseId/curriculum" element={<CurriculumBuilderPage />} />
        <Route path="courses/:courseId/quizzes" element={<QuizManagementPage />} />
        <Route path="courses/:courseId/ai-generate" element={<AIQuizGenerationPage />} />
        <Route path="modules/:moduleId/ai-generate" element={<AIQuizGenerationPage />} />
        <Route path="courses/:courseId/review" element={<CourseReviewPage />} />
        <Route path="lessons/:lessonId" element={<LessonEditorPage />} />
        <Route path="lessons/:lessonId/ai-generate" element={<AIQuizGenerationPage />} />
        <Route path="quizzes/:quizId/edit" element={<QuizBuilderPage />} />
        <Route path="ai-drafts" element={<AIDraftsPage />} />
        <Route path="ai-drafts/:draftId" element={<AIDraftReviewPage />} />
        <Route path="analytics" element={<InstructorAnalyticsPage />} />
        <Route path="profile" element={<InstructorProfilePage />} />
      </Route>

      {/* Admin Portal */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['ADMIN']}>
              <AdminLayout />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="domains" element={<DomainManagementPage />} />
        <Route path="sub-domains" element={<SubDomainManagementPage />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="courses" element={<CourseOversightPage />} />
        <Route path="review" element={<GovernancePage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="activity" element={<AdminActivityPage />} />
        <Route path="profile" element={<AdminProfilePage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
