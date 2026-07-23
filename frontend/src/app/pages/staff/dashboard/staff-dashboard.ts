import { Component, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';

@Component({
  selector: 'app-staff-dashboard',
  imports: [RouterLink],
  templateUrl: './staff-dashboard.html',
  styleUrl: './staff-dashboard.css'
})
export class StaffDashboardComponent implements OnInit {
  protected readonly myCourses = computed(() => {
    const name = this.auth.user()?.name ?? '';
    return this.data.courses().filter(c => c.instructor === name);
  });

  protected readonly stats = computed(() => {
    const courses = this.myCourses();
    const totalStudents = courses.reduce((sum, c) => sum + c.enrolled, 0);
    const activeQuizzes = this.data.quizzes().filter(q =>
      courses.some(c => c.id === q.courseId) && q.status === 'active'
    ).length;

    const courseIds = courses.map(c => c.id);
    const grades = this.data.grades().filter(g => courseIds.includes(g.courseId));
    const avgScore = grades.length > 0
      ? Math.round(grades.reduce((sum, g) => sum + g.percentage, 0) / grades.length)
      : 0;

    return [
      { label: 'My Courses', value: courses.length.toString(), icon: 'courses', color: 'purple' },
      { label: 'Total Students', value: totalStudents.toString(), icon: 'students', color: 'blue' },
      { label: 'Active Quizzes', value: activeQuizzes.toString(), icon: 'quizzes', color: 'green' },
      { label: 'Avg Score', value: courses.length > 0 ? avgScore + '%' : '-', icon: 'score', color: 'yellow' },
    ];
  });

  constructor(public auth: AuthService, public data: DataService) {}

  ngOnInit() {
    this.data.loadCourses();
    this.data.loadGrades();
  }
}
