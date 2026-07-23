import { Component, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';

@Component({
  selector: 'app-parent-dashboard',
  imports: [RouterLink],
  templateUrl: './parent-dashboard.html',
  styleUrl: './parent-dashboard.css'
})
export class ParentDashboardComponent implements OnInit {
  protected readonly stats = computed(() => {
    const fees = this.data.fees();
    const grades = this.data.grades();
    const children = this.data.children();
    const totalFees = fees.reduce((sum, f) => sum + f.amount, 0);
    const pendingFees = fees.filter(f => f.balance > 0).reduce((sum, f) => sum + f.balance, 0);
    const avgGrade = grades.length > 0
      ? Math.round(grades.reduce((sum, g) => sum + g.percentage, 0) / grades.length) + '%'
      : '-';

    return [
      { label: 'Children', value: children.length.toString(), icon: 'children', color: 'blue' },
      { label: 'Average Grade', value: avgGrade, icon: 'grade', color: 'green' },
      { label: 'Total Fees', value: totalFees > 0 ? '$' + totalFees.toLocaleString() : '$0', icon: 'fees', color: 'yellow' },
      { label: 'Pending', value: pendingFees > 0 ? '$' + pendingFees.toLocaleString() : '$0', icon: 'pending', color: 'red' },
    ];
  });

  constructor(public auth: AuthService, public data: DataService) {}

  ngOnInit() {
    this.data.loadChildren();
    this.data.loadGrades();
    this.data.loadFees();
    this.data.loadCourses();
  }
}
