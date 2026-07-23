import { Component, computed, OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';
import { FeeRecord } from '../../../core/models/user.model';

@Component({
  selector: 'app-student-fees',
  imports: [NgClass],
  templateUrl: './student-fees.html',
  styleUrls: ['./student-fees.css'],
})
export class StudentFeesComponent implements OnInit {
  protected readonly expandedId = signal<string | null>(null);

  protected readonly fees = computed(() => {
    const userId = this.auth.user()?.id;
    if (!userId) return [];
    return this.data.getStudentFees(userId);
  });

  protected readonly totalFees = computed(() =>
    this.fees().reduce((sum, f) => sum + f.amount, 0)
  );

  protected readonly totalPaid = computed(() =>
    this.fees().reduce((sum, f) => sum + f.paid, 0)
  );

  protected readonly totalBalance = computed(() =>
    this.fees().reduce((sum, f) => sum + f.balance, 0)
  );

  protected readonly overdueCount = computed(() =>
    this.fees().filter(f => f.status === 'overdue').length
  );

  constructor(
    protected readonly auth: AuthService,
    protected readonly data: DataService,
  ) {}

  ngOnInit() {
    this.data.loadFees();
    this.data.loadCourses();
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'paid': return 'bg-green-50 text-green-700 border-green-200';
      case 'partial': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'unpaid': return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'overdue': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  }

  getProgressPercent(fee: FeeRecord): number {
    if (fee.amount === 0) return 0;
    return Math.round((fee.paid / fee.amount) * 100);
  }
}
