import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./components/landing/landing').then(m => m.Landing) },
  { path: 'login', loadComponent: () => import('./components/login/login').then(m => m.Login) },
  { path: 'register', loadComponent: () => import('./components/register/register').then(m => m.Register) },
  { path: 'profile', loadComponent: () => import('./pages/profile/profile').then(m => m.ProfileComponent), canActivate: [authGuard] },

  // Admin routes
  {
    path: 'admin',
    loadComponent: () => import('./layout/dashboard-layout/dashboard-layout').then(m => m.DashboardLayout),
    canActivate: [authGuard, roleGuard('admin')],
    children: [
      { path: '', loadComponent: () => import('./pages/admin/dashboard/admin-dashboard').then(m => m.AdminDashboard) },
      { path: 'users', loadComponent: () => import('./pages/admin/users/user-management').then(m => m.UserManagementComponent) },
      { path: 'courses', loadComponent: () => import('./pages/admin/courses/course-management').then(m => m.CourseManagementComponent) },
      { path: 'courses/:id', loadComponent: () => import('./pages/student/course-viewer/course-viewer').then(m => m.CourseViewerComponent) },
      { path: 'results', loadComponent: () => import('./pages/admin/results/results-management').then(m => m.ResultsManagementComponent) },
      { path: 'fees', loadComponent: () => import('./pages/admin/fees/fees-management').then(m => m.FeesManagementComponent) },
      { path: 'quizzes', loadComponent: () => import('./pages/admin/quizzes/quiz-management').then(m => m.QuizManagementComponent) },
      { path: 'task-manager', loadComponent: () => import('./pages/admin/task-manager/task-manager').then(m => m.TaskManagerComponent) },
      { path: 'timesheets', loadComponent: () => import('./pages/admin/timesheets/timesheets').then(m => m.TimesheetsComponent) },
      { path: 'messages', loadComponent: () => import('./pages/shared/messages/messages').then(m => m.MessagesComponent) },
    ],
  },

  // Teacher routes
  {
    path: 'staff',
    loadComponent: () => import('./layout/dashboard-layout/dashboard-layout').then(m => m.DashboardLayout),
    canActivate: [authGuard, roleGuard('teacher')],
    children: [
      { path: '', loadComponent: () => import('./pages/staff/dashboard/staff-dashboard').then(m => m.StaffDashboardComponent) },
      { path: 'courses', loadComponent: () => import('./pages/staff/courses/staff-courses').then(m => m.StaffCoursesComponent) },
      { path: 'courses/:id', loadComponent: () => import('./pages/student/course-viewer/course-viewer').then(m => m.CourseViewerComponent) },
      { path: 'tasks', loadComponent: () => import('./pages/staff/tasks/tasks').then(m => m.StaffTasksComponent) },
      { path: 'attendance', loadComponent: () => import('./pages/staff/attendance/attendance').then(m => m.StaffAttendanceComponent) },
      { path: 'classroom', loadComponent: () => import('./pages/staff/classroom/classroom').then(m => m.StaffClassroomComponent) },
      { path: 'approvals', loadComponent: () => import('./pages/staff/approvals/staff-approvals').then(m => m.StaffApprovalsComponent) },
      { path: 'results', loadComponent: () => import('./pages/staff/results/staff-results').then(m => m.StaffResultsComponent) },
      { path: 'quizzes', loadComponent: () => import('./pages/staff/quizzes/staff-quizzes').then(m => m.StaffQuizzesComponent) },
      { path: 'submissions', loadComponent: () => import('./pages/staff/submissions/staff-submissions').then(m => m.StaffSubmissionsComponent) },
      { path: 'messages', loadComponent: () => import('./pages/shared/messages/messages').then(m => m.MessagesComponent) },
    ],
  },

  // Student routes
  {
    path: 'student',
    loadComponent: () => import('./layout/dashboard-layout/dashboard-layout').then(m => m.DashboardLayout),
    canActivate: [authGuard, roleGuard('student')],
    children: [
      { path: '', loadComponent: () => import('./pages/student/dashboard/student-dashboard').then(m => m.StudentDashboard) },
      { path: 'courses', loadComponent: () => import('./pages/student/courses/student-courses').then(m => m.StudentCoursesComponent) },
      { path: 'courses/:id', loadComponent: () => import('./pages/student/course-viewer/course-viewer').then(m => m.CourseViewerComponent) },
      { path: 'attendance', loadComponent: () => import('./pages/student/attendance/attendance').then(m => m.StudentAttendanceComponent) },
      { path: 'classroom', loadComponent: () => import('./pages/student/classroom/classroom').then(m => m.StudentClassroomComponent) },
      { path: 'results', loadComponent: () => import('./pages/student/results/student-results').then(m => m.StudentResultsComponent) },
      { path: 'fees', loadComponent: () => import('./pages/student/fees/student-fees').then(m => m.StudentFeesComponent) },
      { path: 'quizzes', loadComponent: () => import('./pages/student/quizzes/student-quizzes').then(m => m.StudentQuizzesComponent) },
    ],
  },

  // Parent routes
  {
    path: 'parent',
    loadComponent: () => import('./layout/dashboard-layout/dashboard-layout').then(m => m.DashboardLayout),
    canActivate: [authGuard, roleGuard('parent')],
    children: [
      { path: '', loadComponent: () => import('./pages/parent/dashboard/parent-dashboard').then(m => m.ParentDashboardComponent) },
      { path: 'children', loadComponent: () => import('./pages/parent/children/parent-children').then(m => m.ParentChildrenComponent) },
      { path: 'results', loadComponent: () => import('./pages/parent/results/parent-results').then(m => m.ParentResultsComponent) },
      { path: 'fees', loadComponent: () => import('./pages/parent/fees/parent-fees').then(m => m.ParentFeesComponent) },
    ],
  },

  { path: '**', redirectTo: '' },
];
