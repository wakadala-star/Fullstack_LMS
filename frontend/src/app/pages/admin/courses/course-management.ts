import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DataService } from '../../../core/services/data.service';
import { Course } from '../../../core/models/user.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-course-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './course-management.html',
  styleUrls: ['./course-management.css'],
})
export class CourseManagementComponent implements OnInit {
  private dataService = inject(DataService);
  private router = inject(Router);
  private http = inject(HttpClient);

  searchTerm = signal('');
  selectedCategory = signal('all');
  selectedStatus = signal<'all' | Course['status']>('all');
  viewMode = signal<'grid' | 'list'>('grid');
  categories = signal<{name: string; slug: string; icon: string; color: string}[]>([]);

  readonly categoryCounts = computed(() => {
    const counts: Record<string, number> = { all: this.dataService.courses().length };
    for (const course of this.dataService.courses()) {
      counts[course.category] = (counts[course.category] || 0) + 1;
    }
    return counts;
  });

  readonly filteredCourses = computed(() => {
    let courses = this.dataService.courses();

    const term = this.searchTerm().toLowerCase();
    if (term) {
      courses = courses.filter(
        c =>
          c.name.toLowerCase().includes(term) ||
          c.code.toLowerCase().includes(term) ||
          c.instructor.toLowerCase().includes(term) ||
          c.description.toLowerCase().includes(term)
      );
    }

    const category = this.selectedCategory();
    if (category !== 'all') {
      courses = courses.filter(c => c.category === category);
    }

    const status = this.selectedStatus();
    if (status !== 'all') {
      courses = courses.filter(c => c.status === status);
    }

    return courses;
  });

  readonly totalCourses = computed(() => this.dataService.courses().length);
  readonly activeCourses = computed(() => this.dataService.courses().filter(c => c.status === 'active').length);
  readonly totalEnrolled = computed(() => this.dataService.courses().reduce((sum, c) => sum + c.enrolled, 0));
  readonly avgEnrollment = computed(() => {
    const all = this.dataService.courses();
    if (!all.length) return 0;
    const total = all.reduce((sum, c) => sum + (c.enrolled / c.maxEnrolled) * 100, 0);
    return Math.round(total / all.length);
  });

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  onCategoryChange(event: Event): void {
    this.selectedCategory.set((event.target as HTMLSelectElement).value);
  }

  onStatusChange(event: Event): void {
    this.selectedStatus.set((event.target as HTMLSelectElement).value as 'all' | Course['status']);
  }

  getStatusBadgeClass(status: Course['status']): string {
    const classes: Record<Course['status'], string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      completed: 'bg-blue-100 text-blue-700',
    };
    return classes[status];
  }

  getCategoryBadgeClass(category: string): string {
    const map: Record<string, string> = {
      'Web Development': 'bg-indigo-100 text-indigo-700',
      'Data Science': 'bg-cyan-100 text-cyan-700',
      'Mobile Development': 'bg-orange-100 text-orange-700',
      'Cloud & DevOps': 'bg-sky-100 text-sky-700',
      'Cybersecurity': 'bg-red-100 text-red-700',
      'AI & Machine Learning': 'bg-purple-100 text-purple-700',
    };
    return map[category] ?? 'bg-gray-100 text-gray-700';
  }

  getEnrollmentPercent(enrolled: number, max: number): number {
    return max ? Math.round((enrolled / max) * 100) : 0;
  }

  getEnrollmentBarColor(percent: number): string {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  ngOnInit() {
    this.dataService.loadCourses();
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

  editCourse(course: Course): void {
    console.log('Edit course:', course.id);
  }

  viewCourse(course: Course): void {
    this.router.navigate(['/admin/courses', course.id]);
  }
}
