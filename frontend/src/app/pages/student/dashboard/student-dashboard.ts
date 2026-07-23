import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-student-dashboard',
  imports: [RouterLink],
  templateUrl: './student-dashboard.html',
  styleUrl: './student-dashboard.css'
})
export class StudentDashboard implements OnInit {
  private data = inject(DataService);
  protected readonly enrolledCourses = signal<any[]>([]);
  protected readonly availableCoursesCount = signal(0);
  protected readonly loading = signal(true);

  protected readonly stats = computed(() => {
    const courses = this.enrolledCourses();
    const approvedCount = courses.filter(c => c.status === 'approved').length;
    const pendingCount = courses.filter(c => c.status === 'pending').length;
    const quizzesTaken = this.data.submissions().length;

    return [
      { label: 'Enrolled Courses', value: approvedCount.toString(), icon: 'courses', color: 'blue' },
      { label: 'Pending Requests', value: pendingCount.toString(), icon: 'grade', color: 'yellow' },
      { label: 'Available Courses', value: this.availableCoursesCount().toString(), icon: 'fees', color: 'green' },
      { label: 'Quizzes Taken', value: quizzesTaken.toString(), icon: 'quizzes', color: 'purple' },
    ];
  });

  protected readonly recentEnrollments = computed(() => {
    return this.enrolledCourses()
      .filter(e => e.status === 'approved')
      .slice(-5)
      .reverse()
      .map(e => ({
        course: e.course_name,
        code: e.course_code,
        instructor: e.instructor || 'N/A',
        date: this.formatDate(e.created_at),
      }));
  });

  protected readonly pendingEnrollments = computed(() => {
    return this.enrolledCourses()
      .filter(e => e.status === 'pending')
      .map(e => ({
        course: e.course_name,
        code: e.course_code,
        date: this.formatDate(e.created_at),
      }));
  });

  constructor(public auth: AuthService, private http: HttpClient) {}

  ngOnInit() {
    this.loadEnrollments();
    this.loadAvailableCourses();
    this.data.loadSubmissions();
  }

  loadEnrollments() {
    this.http.get<{ enrollments: any[] }>(`${environment.apiUrl}/enrollments/my`).subscribe({
      next: (res) => {
        this.enrolledCourses.set(res.enrollments);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  loadAvailableCourses() {
    this.http.get<{ courses: any[] }>(`${environment.apiUrl}/courses`).subscribe({
      next: (res) => {
        this.availableCoursesCount.set((res.courses || []).length);
      },
      error: () => {}
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
