import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../../core/services/data.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-results-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './results-management.html',
  styleUrls: ['./results-management.css'],
})
export class ResultsManagementComponent implements OnInit {
  private dataService = inject(DataService);
  private authService = inject(AuthService);

  searchTerm = signal('');
  selectedCourse = signal('all');
  selectedTerm = signal('all');

  ngOnInit() {
    this.dataService.loadGrades();
    this.dataService.loadCourses();
  }

  filteredGrades = computed(() => {
    let grades = this.dataService.grades().map(g => ({
      ...g,
      studentName: this.getStudentName(g.studentId),
      courseName: this.getCourseName(g.courseId),
    }));

    const course = this.selectedCourse();
    if (course !== 'all') {
      grades = grades.filter(g => g.courseId === course);
    }

    const term = this.selectedTerm();
    if (term !== 'all') {
      grades = grades.filter(g => g.term === term);
    }

    const search = this.searchTerm().toLowerCase();
    if (search) {
      grades = grades.filter(
        g =>
          g.studentName.toLowerCase().includes(search) ||
          g.courseName.toLowerCase().includes(search) ||
          g.assessmentName.toLowerCase().includes(search)
      );
    }

    return grades;
  });

  totalAssessments = computed(() => this.filteredGrades().length);

  averageScore = computed(() => {
    const grades = this.filteredGrades();
    if (grades.length === 0) return 0;
    return Math.round(grades.reduce((sum, g) => sum + g.percentage, 0) / grades.length);
  });

  highestScore = computed(() => {
    const grades = this.filteredGrades();
    if (grades.length === 0) return 0;
    return Math.max(...grades.map(g => g.percentage));
  });

  passRate = computed(() => {
    const grades = this.filteredGrades();
    if (grades.length === 0) return 0;
    const passed = grades.filter(g => g.percentage >= 70).length;
    return Math.round((passed / grades.length) * 100);
  });

  terms = computed(() => {
    const uniqueTerms = [...new Set(this.dataService.grades().map(g => g.term))];
    return uniqueTerms.sort();
  });

  courses = computed(() => this.dataService.courses());

  getStudentName(studentId: string): string {
    const user = this.authService.getAllUsers().find(u => u.id === studentId);
    return user ? user.name : 'Unknown Student';
  }

  getCourseName(courseId: string): string {
    const course = this.dataService.courses().find(c => c.id === courseId);
    return course ? course.name : 'Unknown Course';
  }

  getAssessmentTypeBadgeClass(type: string): string {
    const classes: Record<string, string> = {
      quiz: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      exam: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      assignment: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      project: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    };
    return classes[type] || 'bg-gray-100 text-gray-700';
  }

  getScoreColor(percentage: number): string {
    if (percentage >= 90) return 'text-green-600 dark:text-green-400';
    if (percentage >= 80) return 'text-blue-600 dark:text-blue-400';
    if (percentage >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  onCourseChange(event: Event): void {
    this.selectedCourse.set((event.target as HTMLSelectElement).value);
  }

  onTermChange(event: Event): void {
    this.selectedTerm.set((event.target as HTMLSelectElement).value);
  }
}
