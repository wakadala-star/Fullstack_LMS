import { Component, computed, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Course } from '../../../core/models/user.model';

@Component({
  selector: 'app-student-courses',
  imports: [FormsModule],
  templateUrl: './student-courses.html',
  styleUrls: ['./student-courses.css'],
})
export class StudentCoursesComponent implements OnInit {
  protected readonly searchTerm = signal('');
  protected readonly selectedCategory = signal('all');
  protected readonly viewMode = signal<'grid' | 'list'>('grid');
  protected readonly allCourses = signal<Course[]>([]);
  protected readonly enrollments = signal<any[]>([]);
  protected readonly categories = signal<{name: string; slug: string; icon: string; color: string}[]>([]);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly courses = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const category = this.selectedCategory();
    let list = this.allCourses();
    if (term) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term) ||
        c.instructor.toLowerCase().includes(term) ||
        c.category.toLowerCase().includes(term)
      );
    }
    if (category !== 'all') {
      list = list.filter(c => c.category === category);
    }
    return list;
  });

  protected readonly enrolledCount = computed(() =>
    this.enrollments().filter(e => e.status === 'approved').length
  );

  protected readonly categoryCounts = computed(() => {
    const counts: Record<string, number> = { all: this.allCourses().length };
    for (const course of this.allCourses()) {
      counts[course.category] = (counts[course.category] || 0) + 1;
    }
    return counts;
  });

  constructor(
    protected readonly auth: AuthService,
    private http: HttpClient,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadCourses();
    this.loadEnrollments();
    this.loadCategories();
  }

  loadCategories() {
    this.http.get<{ categories: any[] }>(`${environment.apiUrl}/categories`).subscribe({
      next: (res) => {
        this.categories.set(res.categories);
      },
      error: () => {}
    });
  }

  onCategorySelect(category: string): void {
    this.selectedCategory.set(category);
  }

  loadCourses() {
    this.http.get<{ courses: any[] }>(`${environment.apiUrl}/courses`).subscribe({
      next: (res) => {
        const courses = res.courses
          .filter((c: any) => c.status === 'active')
          .map((c: any): Course => ({
            id: c.id.toString(),
            name: c.name,
            code: c.code,
            description: c.description,
            instructor: c.instructor,
            instructor_id: c.instructor_id,
            category: c.category,
            credits: c.credits,
            enrolled: c.enrolled,
            maxEnrolled: c.max_enrolled,
            status: c.status,
            schedule: c.schedule,
            materials: c.materials || [],
          }));
        this.allCourses.set(courses);
      },
      error: () => {}
    });
  }

  loadEnrollments() {
    this.http.get<{ enrollments: any[] }>(`${environment.apiUrl}/enrollments/my`).subscribe({
      next: (res) => {
        this.enrollments.set(res.enrollments);
      },
      error: () => {}
    });
  }

  getEnrollmentStatus(courseId: string): string {
    const enrollment = this.enrollments().find(e => e.course_id.toString() === courseId);
    return enrollment ? enrollment.status : 'none';
  }

  enroll(courseId: string) {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.http.post(`${environment.apiUrl}/enrollments/request`, { courseId }).subscribe({
      next: () => {
        this.successMessage.set('Enrollment request sent! Waiting for teacher approval.');
        this.loadEnrollments();
        setTimeout(() => this.successMessage.set(''), 4000);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error || 'Failed to send request');
        setTimeout(() => this.errorMessage.set(''), 4000);
      }
    });
  }

  viewCourse(course: Course) {
    this.router.navigate(['/student/courses', course.id]);
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  getEnrollmentPercent(course: Course): number {
    return Math.round((course.enrolled / course.maxEnrolled) * 100);
  }
}
