import { Component, input, output, signal, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { LiveChatComponent } from '../../shared/live-chat/live-chat';
import { environment } from '../../../environments/environment';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  badge?: number;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, LiveChatComponent],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar implements OnInit {
  collapsed = input(false);
  toggle = output();
  pendingApprovals = signal(0);
  unreadMessages = signal(0);

  protected readonly roleNavItems = signal<Record<string, NavItem[]>>({
    admin: [
      { label: 'Dashboard', route: '/admin', icon: 'home' },
      { label: 'Users', route: '/admin/users', icon: 'users' },
      { label: 'Courses', route: '/admin/courses', icon: 'courses' },
      { label: 'Task Manager', route: '/admin/task-manager', icon: 'tasks' },
      { label: 'Results', route: '/admin/results', icon: 'results' },
      { label: 'Fees', route: '/admin/fees', icon: 'fees' },
      { label: 'Quizzes', route: '/admin/quizzes', icon: 'quizzes' },
      { label: 'Timesheets', route: '/admin/timesheets', icon: 'clock' },
      { label: 'Messages', route: '/admin/messages', icon: 'messages', badge: this.unreadMessages() },
    ],
    teacher: [
      { label: 'Dashboard', route: '/staff', icon: 'home' },
      { label: 'My Courses', route: '/staff/courses', icon: 'courses' },
      { label: 'My Tasks', route: '/staff/tasks', icon: 'tasks' },
      { label: 'Attendance', route: '/staff/attendance', icon: 'attendance' },
      { label: 'Classroom', route: '/staff/classroom', icon: 'classroom' },
      { label: 'Approvals', route: '/staff/approvals', icon: 'results', badge: this.pendingApprovals() },
      { label: 'Results', route: '/staff/results', icon: 'results' },
      { label: 'Quizzes', route: '/staff/quizzes', icon: 'quizzes' },
      { label: 'Submissions', route: '/staff/submissions', icon: 'submissions' },
      { label: 'Messages', route: '/staff/messages', icon: 'messages', badge: this.unreadMessages() },
    ],
    student: [
      { label: 'Dashboard', route: '/student', icon: 'home' },
      { label: 'My Courses', route: '/student/courses', icon: 'courses' },
      { label: 'Attendance', route: '/student/attendance', icon: 'attendance' },
      { label: 'Classroom', route: '/student/classroom', icon: 'classroom' },
      { label: 'Results', route: '/student/results', icon: 'results' },
      { label: 'Fees', route: '/student/fees', icon: 'fees' },
      { label: 'Quizzes', route: '/student/quizzes', icon: 'quizzes' },
    ],
    parent: [
      { label: 'Dashboard', route: '/parent', icon: 'home' },
      { label: 'Children', route: '/parent/children', icon: 'users' },
      { label: 'Results', route: '/parent/results', icon: 'results' },
      { label: 'Fees', route: '/parent/fees', icon: 'fees' },
    ],
  });

  constructor(public auth: AuthService, private http: HttpClient) {}

  ngOnInit() {
    if (this.auth.userRole() === 'teacher') {
      this.loadPendingCount();
      setInterval(() => this.loadPendingCount(), 30000);
    }
    if (this.auth.userRole() === 'admin' || this.auth.userRole() === 'teacher') {
      this.loadUnreadMessages();
      setInterval(() => this.loadUnreadMessages(), 5000);
    }
  }

  loadPendingCount() {
    this.http.get<{ enrollments: any[] }>(`${environment.apiUrl}/enrollments/pending`).subscribe({
      next: (res) => {
        this.pendingApprovals.set(res.enrollments.length);
        // Update nav items with badge
        const current = this.roleNavItems();
        const teacherItems = [...current['teacher']];
        const approvalsIdx = teacherItems.findIndex(i => i.route === '/staff/approvals');
        if (approvalsIdx >= 0) {
          teacherItems[approvalsIdx] = { ...teacherItems[approvalsIdx], badge: res.enrollments.length };
        }
        this.roleNavItems.set({ ...current, teacher: teacherItems });
      },
      error: () => {}
    });
  }

  get navItems(): NavItem[] {
    return this.roleNavItems()[this.auth.userRole() ?? 'student'];
  }

  loadUnreadMessages() {
    this.http.get<{ count: number }>(`${environment.apiUrl}/messages/unread-count`).subscribe({
      next: (res) => {
        this.unreadMessages.set(res.count);
        const current = this.roleNavItems();
        const role = this.auth.userRole() || 'admin';
        const items = [...current[role]];
        const msgIdx = items.findIndex(i => i.route.includes('/messages'));
        if (msgIdx >= 0) {
          items[msgIdx] = { ...items[msgIdx], badge: res.count };
          this.roleNavItems.set({ ...current, [role]: items });
        }
      },
      error: () => {}
    });
  }
}
