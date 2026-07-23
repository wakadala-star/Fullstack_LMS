import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';

@Component({
  selector: 'app-parent-fees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parent-fees.html',
  styleUrls: ['./parent-fees.css']
})
export class ParentFeesComponent implements OnInit {
  private authService = inject(AuthService);
  private dataService = inject(DataService);

  selectedChildId = signal<string>('all');
  expandedFeeId = signal<string | null>(null);
  showPaymentModal = signal(false);
  selectedFee = signal<any>(null);
  paymentAmount = signal<number>(0);
  phoneNumber = signal('');
  paymentMethod = signal('mtn');
  isProcessing = signal(false);
  paymentSuccess = signal(false);
  paymentRef = signal('');

  children = computed(() => {
    return this.dataService.children();
  });

  filteredFees = computed(() => {
    const fees = this.dataService.fees();
    const children = this.dataService.children();
    const childrenIds = children.map(c => c.id?.toString());
    const selectedChildId = this.selectedChildId();
    let filtered = fees.filter(fee => childrenIds.includes(fee.studentId));
    if (selectedChildId !== 'all') {
      filtered = filtered.filter(fee => fee.studentId === selectedChildId);
    }
    return filtered.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
  });

  totalFees = computed(() => this.filteredFees().reduce((sum, fee) => sum + fee.amount, 0));
  totalPaid = computed(() => this.filteredFees().reduce((sum, fee) => sum + fee.paid, 0));
  totalBalance = computed(() => this.filteredFees().reduce((sum, fee) => sum + fee.balance, 0));

  ngOnInit() {
    this.dataService.loadChildren();
    this.dataService.loadFees();
  }

  getChildName(studentId: string): string {
    const children = this.dataService.children();
    const child = children.find((c: any) => c.id?.toString() === studentId);
    return child ? child.name : 'Unknown';
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'unpaid': return 'bg-gray-100 text-gray-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  toggleExpand(feeId: string): void {
    this.expandedFeeId.set(this.expandedFeeId() === feeId ? null : feeId);
  }

  onChildChange(event: Event): void {
    this.selectedChildId.set((event.target as HTMLSelectElement).value);
  }

  openPaymentModal(fee: any): void {
    this.selectedFee.set(fee);
    this.paymentAmount.set(fee.balance);
    this.paymentSuccess.set(false);
    this.showPaymentModal.set(true);
  }

  closePaymentModal(): void {
    this.showPaymentModal.set(false);
    this.selectedFee.set(null);
    this.paymentAmount.set(0);
    this.phoneNumber.set('');
    this.isProcessing.set(false);
    this.paymentSuccess.set(false);
  }

  processPayment(): void {
    const fee = this.selectedFee();
    const amount = this.paymentAmount();
    const phone = this.phoneNumber();
    if (!fee || amount <= 0 || !phone) return;

    this.isProcessing.set(true);
    const methodName = this.paymentMethod() === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money';
    this.dataService.processPayment(fee.id, amount, methodName);
    setTimeout(() => {
      this.isProcessing.set(false);
      this.paymentRef.set('MOB-' + Date.now());
      this.paymentSuccess.set(true);
      setTimeout(() => this.closePaymentModal(), 2000);
    }, 1500);
  }
}
