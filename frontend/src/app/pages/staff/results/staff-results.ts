import { Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';

@Component({
  selector: 'app-staff-results',
  imports: [FormsModule],
  templateUrl: './staff-results.html',
  styleUrl: './staff-results.css'
})
export class StaffResultsComponent implements OnInit {
  protected readonly searchQuery = signal('');
  protected readonly selectedCourse = signal('');
  protected readonly selectedType = signal('');

  protected readonly courseOptions = computed(() => {
    const name = this.auth.user()?.name ?? '';
    return this.data.courses().filter(c => c.instructor === name);
  });

  protected readonly filteredGrades = computed(() => {
    const name = this.auth.user()?.name ?? '';
    const courseIds = this.data.courses()
      .filter(c => c.instructor === name)
      .map(c => c.id);
    const query = this.searchQuery().toLowerCase();
    const courseId = this.selectedCourse();
    const type = this.selectedType();

    return this.data.grades()
      .filter(g => courseIds.includes(g.courseId))
      .filter(g => !courseId || g.courseId === courseId)
      .filter(g => !type || g.assessmentType === type)
      .filter(g => {
        if (!query) return true;
        const course = this.data.courses().find(c => c.id === g.courseId);
        return (
          course?.name.toLowerCase().includes(query) ||
          g.assessmentName.toLowerCase().includes(query)
        );
      })
      .map(g => {
        const course = this.data.courses().find(c => c.id === g.courseId);
        return { ...g, courseName: course?.name ?? '' };
      });
  });

  protected readonly stats = computed(() => {
    const grades = this.filteredGrades();
    const total = grades.length;
    const avg = total > 0 ? Math.round(grades.reduce((s, g) => s + g.percentage, 0) / total) : 0;
    const passRate = total > 0 ? Math.round(grades.filter(g => g.percentage >= 60).length / total * 100) : 0;
    return { total, avg, passRate };
  });

  constructor(public auth: AuthService, public data: DataService) {}

  ngOnInit() {
    this.data.loadGrades();
  }
}
