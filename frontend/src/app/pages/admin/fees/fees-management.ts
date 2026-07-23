import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../../core/services/data.service';

@Component({
  selector: 'app-fees-management',
  templateUrl: './fees-management.html',
  styleUrls: ['./fees-management.css'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class FeesManagementComponent implements OnInit {
  private dataService = inject(DataService);

  searchTerm = signal('');
  selectedStatus = signal('');
  expandedRowId = signal<string | null>(null);

  ngOnInit() {
    this.dataService.loadFees();
  }

  filteredFees = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const status = this.selectedStatus();
    return this.dataService.fees().filter(fee => {
      const matchesSearch = !term ||
        fee.studentName.toLowerCase().includes(term) ||
        fee.description.toLowerCase().includes(term);
      const matchesStatus = !status || fee.status === status;
      return matchesSearch && matchesStatus;
    });
  });

  stats = computed(() => {
    const fees = this.dataService.fees();
    const overdueFees = fees.filter(f => f.status === 'overdue');
    return {
      totalRevenue: this.dataService.getTotalRevenue(),
      totalPending: this.dataService.getTotalPending(),
      totalOverdue: overdueFees.reduce((sum, f) => sum + f.balance, 0),
      overdueCount: overdueFees.length,
    };
  });

  toggleRow(feeId: string) {
    this.expandedRowId.update(current => current === feeId ? null : feeId);
  }

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  onStatusFilter(event: Event) {
    this.selectedStatus.set((event.target as HTMLSelectElement).value);
  }
}
