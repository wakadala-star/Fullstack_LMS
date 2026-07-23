import { Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass, DatePipe } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';
import { Grade } from '../../../core/models/user.model';

@Component({
  selector: 'app-student-results',
  imports: [FormsModule, NgClass, DatePipe],
  templateUrl: './student-results.html',
  styleUrls: ['./student-results.css'],
})
export class StudentResultsComponent implements OnInit {
  protected readonly filterCourse = signal('');
  protected readonly filterType = signal('');
  protected readonly expandedSubmission = signal<string | null>(null);

  protected readonly grades = computed(() => {
    const userId = this.auth.user()?.id;
    if (!userId) return [];
    return this.data.getStudentGrades(userId);
  });

  protected readonly courses = computed(() => {
    const courseIds = [...new Set(this.grades().map(g => g.courseId))];
    return courseIds.map(id => {
      const course = this.data.courses().find(c => c.id === id);
      return { id, name: course?.name ?? 'Unknown', code: course?.code ?? '' };
    });
  });

  protected readonly filteredGrades = computed(() => {
    let result = this.grades();
    const course = this.filterCourse();
    const type = this.filterType();
    if (course) result = result.filter(g => g.courseId === course);
    if (type) result = result.filter(g => g.assessmentType === type);
    return result;
  });

  protected readonly groupedGrades = computed(() => {
    const grades = this.filteredGrades();
    const groups = new Map<string, Grade[]>();
    for (const grade of grades) {
      const course = this.data.courses().find(c => c.id === grade.courseId);
      const key = course?.name ?? 'Unknown Course';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(grade);
    }
    return [...groups.entries()].map(([courseName, items]) => ({ courseName, grades: items }));
  });

  protected readonly quizSubmissions = computed(() => {
    const userId = this.auth.user()?.id;
    if (!userId) return [];
    return this.data.submissions()
      .filter(s => s.studentId === userId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  });

  protected readonly quizStats = computed(() => {
    const subs = this.quizSubmissions();
    const graded = subs.filter(s => s.status === 'graded');
    if (graded.length === 0) return { count: 0, avg: 0, highest: 0, passRate: 0 };
    return {
      count: graded.length,
      avg: Math.round(graded.reduce((sum, s) => sum + s.percentage, 0) / graded.length),
      highest: Math.max(...graded.map(s => s.percentage)),
      passRate: Math.round((graded.filter(s => s.percentage >= 60).length / graded.length) * 100)
    };
  });

  protected readonly totalAssessments = computed(() => this.filteredGrades().length + this.quizStats().count);

  protected readonly averageScore = computed(() => {
    const gradeAvg = this.filteredGrades().length > 0
      ? this.filteredGrades().reduce((sum, g) => sum + g.percentage, 0) / this.filteredGrades().length
      : 0;
    const quizAvg = this.quizStats().avg;
    const total = this.filteredGrades().length + this.quizStats().count;
    if (total === 0) return 0;
    return Math.round(((gradeAvg * this.filteredGrades().length) + (quizAvg * this.quizStats().count)) / total);
  });

  protected readonly highestScore = computed(() => {
    const gradeHighest = this.filteredGrades().length > 0
      ? Math.max(...this.filteredGrades().map(g => g.percentage))
      : 0;
    return Math.max(gradeHighest, this.quizStats().highest);
  });

  protected readonly passRate = computed(() => {
    const total = this.filteredGrades().length + this.quizStats().count;
    if (total === 0) return 0;
    const gradePassed = this.filteredGrades().filter(g => g.percentage >= 60).length;
    const quizPassed = Math.round((this.quizStats().passRate / 100) * this.quizStats().count);
    return Math.round(((gradePassed + quizPassed) / total) * 100);
  });

  constructor(
    protected readonly auth: AuthService,
    protected readonly data: DataService,
  ) {}

  ngOnInit() {
    this.data.loadGrades();
    this.data.loadCourses();
    this.data.loadSubmissions();
  }

  onFilterCourse(event: Event): void {
    this.filterCourse.set((event.target as HTMLSelectElement).value);
  }

  onFilterType(event: Event): void {
    this.filterType.set((event.target as HTMLSelectElement).value);
  }

  toggleSubmission(subId: string): void {
    this.expandedSubmission.set(this.expandedSubmission() === subId ? null : subId);
  }

  getScoreColor(percentage: number): string {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-blue-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  }

  getScoreBarColor(percentage: number): string {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 80) return 'bg-blue-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  getBadgeClass(type: string): string {
    switch (type) {
      case 'quiz': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'exam': return 'bg-red-50 text-red-700 border-red-200';
      case 'assignment': return 'bg-green-50 text-green-700 border-green-200';
      case 'project': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  }
}
