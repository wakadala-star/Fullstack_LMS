import { Component, computed, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Course } from '../../../core/models/user.model';

@Component({
  selector: 'app-staff-courses',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './staff-courses.html',
  styleUrl: './staff-courses.css'
})
export class StaffCoursesComponent implements OnInit {
  protected readonly searchQuery = signal('');
  protected readonly viewMode = signal<'grid' | 'list'>('grid');
  protected readonly showCreateModal = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly selectedFiles = signal<File[]>([]);
  protected readonly uploadProgress = signal(0);
  protected readonly isUploading = signal(false);
  protected readonly createdCourseId = signal<number | null>(null);
  protected readonly categories = signal<{name: string; slug: string; icon: string; color: string}[]>([]);

  protected readonly newCourse = signal({
    name: '',
    code: '',
    description: '',
    category: '',
    credits: 3,
    maxEnrolled: 30,
    schedule: '',
  });

  protected readonly myCourses = signal<Course[]>([]);

  protected readonly filteredCourses = computed(() => {
    const query = this.searchQuery().toLowerCase();
    return this.myCourses().filter(c =>
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.code.toLowerCase().includes(query) ||
      c.description.toLowerCase().includes(query)
    );
  });

  protected onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  constructor(public auth: AuthService, private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.loadCourses();
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

  loadCourses() {
    this.http.get<{ courses: any[] }>(`${environment.apiUrl}/courses`).subscribe({
      next: (res) => {
        const name = this.auth.user()?.name ?? '';
        const courses = res.courses
          .filter((c: any) => c.instructor === name)
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
        this.myCourses.set(courses);
      },
      error: () => {}
    });
  }

  updateNewCourse(field: string, value: string | number): void {
    this.newCourse.update(c => ({ ...c, [field]: value }));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.selectedFiles.update(files => [...files, ...Array.from(input.files!)]);
  }

  removeFile(index: number): void {
    this.selectedFiles.update(files => files.filter((_, i) => i !== index));
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  getFileIcon(type: string): string {
    if (type.includes('video')) return 'video';
    if (type.includes('audio')) return 'audio';
    if (type.includes('pdf')) return 'pdf';
    if (type.includes('word') || type.includes('document')) return 'doc';
    if (type.includes('sheet') || type.includes('excel')) return 'sheet';
    return 'file';
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.newCourse.set({ name: '', code: '', description: '', category: '', credits: 3, maxEnrolled: 30, schedule: '' });
    this.selectedFiles.set([]);
    this.isSubmitting.set(false);
    this.createdCourseId.set(null);
    this.uploadProgress.set(0);
  }

  submitNewCourse(): void {
    const course = this.newCourse();
    if (!course.name || !course.code) return;
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    // First create the course
    this.http.post<{ course: any }>(`${environment.apiUrl}/courses`, {
      name: course.name,
      code: course.code,
      description: course.description,
      category: course.category,
      credits: course.credits,
      maxEnrolled: course.maxEnrolled,
      schedule: course.schedule,
    }).subscribe({
      next: (res) => {
        const courseId = res.course.id;
        this.createdCourseId.set(courseId);

        // If files selected, upload them
        if (this.selectedFiles().length > 0) {
          this.uploadFiles(courseId);
        } else {
          this.isSubmitting.set(false);
          this.closeCreateModal();
          this.successMessage.set('Course created successfully!');
          this.loadCourses();
          setTimeout(() => this.successMessage.set(''), 3000);
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.error?.error || 'Failed to create course');
      }
    });
  }

  uploadFiles(courseId: number): void {
    this.isUploading.set(true);
    const formData = new FormData();

    this.selectedFiles().forEach(file => {
      formData.append('files', file);
    });

    this.http.post<{ materials: any[] }>(`${environment.apiUrl}/courses/${courseId}/materials`, formData).subscribe({
      next: () => {
        this.isUploading.set(false);
        this.closeCreateModal();
        this.successMessage.set('Course created with materials!');
        this.loadCourses();
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err) => {
        this.isUploading.set(false);
        this.errorMessage.set(err.error?.error || 'Failed to upload materials');
      }
    });
  }

  uploadMaterialsToExisting(courseId: number, files: File[]): void {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    this.http.post<{ materials: any[] }>(`${environment.apiUrl}/courses/${courseId}/materials`, formData).subscribe({
      next: () => {
        this.successMessage.set('Materials uploaded!');
        this.loadCourses();
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error || 'Failed to upload');
        setTimeout(() => this.errorMessage.set(''), 3000);
      }
    });
  }

  viewCourse(course: Course): void {
    this.router.navigate(['/staff/courses', course.id]);
  }
}
