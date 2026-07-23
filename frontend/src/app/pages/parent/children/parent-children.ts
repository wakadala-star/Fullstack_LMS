import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';

@Component({
  selector: 'app-parent-children',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './parent-children.html',
  styleUrls: ['./parent-children.css']
})
export class ParentChildrenComponent implements OnInit {
  private authService = inject(AuthService);
  private dataService = inject(DataService);

  expandedChild = signal<string | null>(null);

  children = computed(() => {
    return this.dataService.children();
  });

  ngOnInit() {
    this.dataService.loadChildren();
    this.dataService.loadGrades();
    this.dataService.loadCourses();
  }

  getChildCourses(studentId: string) {
    const courses = this.dataService.courses();
    const grades = this.dataService.grades();
    const enrolledCourseIds = [...new Set(grades.filter(grade => grade.studentId === studentId).map(grade => grade.courseId))];
    return courses.filter(course => enrolledCourseIds.includes(course.id));
  }

  getChildGrades(studentId: string) {
    return this.dataService.grades()
      .filter(grade => grade.studentId === studentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }

  getCourseName(courseId: string): string {
    const courses = this.dataService.courses();
    const course = courses.find(c => c.id === courseId);
    return course ? course.name : 'Unknown Course';
  }

  toggleExpand(childId: string) {
    if (this.expandedChild() === childId) {
      this.expandedChild.set(null);
    } else {
      this.expandedChild.set(childId);
    }
  }

  getGradeColor(percentage: number): string {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-blue-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  }

  getChildAverageGrade(studentId: string): number {
    const grades = this.dataService.grades();
    const childGrades = grades.filter(grade => grade.studentId === studentId);
    if (childGrades.length === 0) return 0;
    const sum = childGrades.reduce((acc, grade) => acc + grade.percentage, 0);
    return Math.round(sum / childGrades.length);
  }
}