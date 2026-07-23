import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';

@Component({
  selector: 'app-parent-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parent-results.html',
  styleUrls: ['./parent-results.css']
})
export class ParentResultsComponent implements OnInit {
  private authService = inject(AuthService);
  private dataService = inject(DataService);

  selectedChildId = signal<string>('all');

  children = computed(() => {
    return this.dataService.children();
  });

  filteredGrades = computed(() => {
    const grades = this.dataService.grades();
    const children = this.dataService.children();
    const childrenIds = children.map(c => c.id?.toString());
    const selectedChildId = this.selectedChildId();
    
    let filtered = grades.filter(grade => childrenIds.includes(grade.studentId));
    
    if (selectedChildId !== 'all') {
      filtered = filtered.filter(grade => grade.studentId === selectedChildId);
    }
    
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  childAverageGrades = computed(() => {
    const grades = this.dataService.grades();
    const children = this.dataService.children();
    const childrenIds = children.map(c => c.id?.toString());
    const averages: { [key: string]: number } = {};
    
    childrenIds.forEach(childId => {
      const childGrades = grades.filter(grade => grade.studentId === childId);
      if (childGrades.length > 0) {
        const sum = childGrades.reduce((acc, grade) => acc + grade.percentage, 0);
        averages[childId] = Math.round(sum / childGrades.length);
      } else {
        averages[childId] = 0;
      }
    });
    
    return averages;
  });

  overallAverage = computed(() => {
    const averages = this.childAverageGrades();
    const values = Object.values(averages);
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / values.length);
  });

  ngOnInit() {
    this.dataService.loadChildren();
    this.dataService.loadGrades();
    this.dataService.loadCourses();
  }

  getChildName(studentId: string): string {
    const children = this.dataService.children();
    const child = children.find((c: any) => c.id?.toString() === studentId);
    return child ? child.name : 'Unknown';
  }

  getCourseName(courseId: string): string {
    const courses = this.dataService.courses();
    const course = courses.find(c => c.id === courseId);
    return course ? course.name : 'Unknown Course';
  }

  getGradeColor(percentage: number): string {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-blue-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  }

  getAssessmentBadgeClass(type: string): string {
    switch (type.toLowerCase()) {
      case 'exam': return 'bg-red-100 text-red-800';
      case 'quiz': return 'bg-blue-100 text-blue-800';
      case 'assignment': return 'bg-green-100 text-green-800';
      case 'project': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  onChildChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedChildId.set(target.value);
  }
}