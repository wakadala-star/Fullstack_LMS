import { Component, signal, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-staff-approvals',
  standalone: true,
  imports: [TitleCasePipe],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Enrollment Approvals</h1>
        <p class="text-gray-500 mt-1">Review and manage student enrollment requests</p>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900">{{ pendingCount() }}</p>
              <p class="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900">{{ approvedCount() }}</p>
              <p class="text-xs text-gray-500">Approved</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900">{{ rejectedCount() }}</p>
              <p class="text-xs text-gray-500">Rejected</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Filter tabs -->
      <div class="flex gap-2">
        @for (tab of tabs; track tab) {
          <button
            (click)="activeTab.set(tab)"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            [class]="activeTab() === tab
              ? (tab === 'pending' ? 'bg-amber-100 text-amber-700' : tab === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          >
            {{ tab | titlecase }} ({{ getCount(tab) }})
          </button>
        }
      </div>

      <!-- Enrollment requests table -->
      @if (loading()) {
        <div class="flex items-center justify-center py-12">
          <svg class="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      } @else if (filteredEnrollments().length === 0) {
        <div class="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-gray-900 font-semibold mb-1">No {{ activeTab() }} requests</p>
          <p class="text-sm text-gray-500">
            @if (activeTab() === 'pending') {
              All caught up! No pending enrollment requests.
            } @else if (activeTab() === 'approved') {
              No approved enrollments yet.
            } @else {
              No rejected enrollments yet.
            }
          </p>
        </div>
      } @else {
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-100">
                  <th class="text-left px-5 py-3 font-semibold text-gray-900">Student</th>
                  <th class="text-left px-5 py-3 font-semibold text-gray-900">Course</th>
                  <th class="text-left px-5 py-3 font-semibold text-gray-900">Requested</th>
                  <th class="text-left px-5 py-3 font-semibold text-gray-900">Status</th>
                  @if (activeTab() === 'pending') {
                    <th class="text-right px-5 py-3 font-semibold text-gray-900">Actions</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (enrollment of filteredEnrollments(); track enrollment.id) {
                  <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td class="px-5 py-4">
                      <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#5B5EA6] to-[#9B59B6] flex items-center justify-center text-white font-bold text-xs">
                          {{ enrollment.student_name?.charAt(0) || 'S' }}
                        </div>
                        <div>
                          <p class="font-medium text-gray-900">{{ enrollment.student_name }}</p>
                          <p class="text-xs text-gray-500">{{ enrollment.student_email }}</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-5 py-4">
                      <p class="font-medium text-gray-900">{{ enrollment.course_name }}</p>
                      <p class="text-xs text-gray-500">{{ enrollment.course_code }}</p>
                    </td>
                    <td class="px-5 py-4 text-gray-600">
                      {{ formatDate(enrollment.created_at) }}
                    </td>
                    <td class="px-5 py-4">
                      <span class="px-2.5 py-1 rounded-full text-xs font-semibold"
                        [class]="enrollment.status === 'pending' ? 'bg-amber-100 text-amber-700' : enrollment.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'">
                        {{ enrollment.status | titlecase }}
                      </span>
                    </td>
                    @if (activeTab() === 'pending') {
                      <td class="px-5 py-4">
                        <div class="flex items-center justify-end gap-2">
                          <button
                            (click)="approve(enrollment)"
                            class="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            (click)="reject(enrollment)"
                            class="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Success/Error Messages -->
      @if (successMessage()) {
        <div class="fixed bottom-20 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50">
          {{ successMessage() }}
        </div>
      }
      @if (errorMessage()) {
        <div class="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50">
          {{ errorMessage() }}
        </div>
      }
    </div>
  `,
})
export class StaffApprovalsComponent implements OnInit {
  enrollments = signal<any[]>([]);
  loading = signal(true);
  activeTab = signal<'pending' | 'approved' | 'rejected'>('pending');
  successMessage = signal('');
  errorMessage = signal('');
  tabs = ['pending', 'approved', 'rejected'] as const;

  pendingCount = signal(0);
  approvedCount = signal(0);
  rejectedCount = signal(0);

  constructor(
    private http: HttpClient,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    this.loadEnrollments();
  }

  loadEnrollments() {
    this.loading.set(true);
    this.http.get<{ enrollments: any[] }>(`${environment.apiUrl}/enrollments/teacher`).subscribe({
      next: (res) => {
        this.enrollments.set(res.enrollments);
        this.pendingCount.set(res.enrollments.filter(e => e.status === 'pending').length);
        this.approvedCount.set(res.enrollments.filter(e => e.status === 'approved').length);
        this.rejectedCount.set(res.enrollments.filter(e => e.status === 'rejected').length);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  filteredEnrollments() {
    return this.enrollments().filter(e => e.status === this.activeTab());
  }

  getCount(tab: string): number {
    return this.enrollments().filter(e => e.status === tab).length;
  }

  approve(enrollment: any) {
    this.http.patch(`${environment.apiUrl}/enrollments/${enrollment.id}/approve`, {}).subscribe({
      next: () => {
        this.successMessage.set(`Approved ${enrollment.student_name}'s enrollment in ${enrollment.course_name}`);
        this.loadEnrollments();
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error || 'Failed to approve');
        setTimeout(() => this.errorMessage.set(''), 3000);
      }
    });
  }

  reject(enrollment: any) {
    this.http.patch(`${environment.apiUrl}/enrollments/${enrollment.id}/reject`, {}).subscribe({
      next: () => {
        this.successMessage.set(`Rejected ${enrollment.student_name}'s enrollment in ${enrollment.course_name}`);
        this.loadEnrollments();
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error || 'Failed to reject');
        setTimeout(() => this.errorMessage.set(''), 3000);
      }
    });
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
