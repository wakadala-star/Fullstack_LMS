import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models/user.model';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.html',
  styleUrls: ['./user-management.css'],
})
export class UserManagementComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private refreshInterval: any;

  searchTerm = signal('');
  selectedRole = signal<'all' | UserRole>('all');
  showAddModal = signal(false);
  isSubmitting = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  users = signal<any[]>([]);

  newUser = signal({
    name: '',
    email: '',
    phone: '',
    role: 'student' as UserRole,
  });

  ngOnInit() {
    this.loadUsers();
    this.refreshInterval = setInterval(() => this.loadUsers(), 10000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  async loadUsers() {
    const users = await this.authService.fetchAllUsers();
    this.users.set(users);
  }

  filteredUsers = computed(() => {
    let list = this.users();
    const role = this.selectedRole();
    if (role !== 'all') list = list.filter(u => u.role === role);
    const term = this.searchTerm().toLowerCase();
    if (term) {
      list = list.filter(u =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)
      );
    }
    return list;
  });

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  onRoleChange(event: Event): void {
    this.selectedRole.set((event.target as HTMLSelectElement).value as 'all' | UserRole);
  }

  updateNewUser(field: string, value: string): void {
    this.newUser.update(u => ({ ...u, [field]: value }));
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.newUser.set({ name: '', email: '', phone: '', role: 'student' });
    this.isSubmitting.set(false);
  }

  submitNewUser(): void {
    const user = this.newUser();
    if (!user.name || !user.email) return;
    this.isSubmitting.set(true);
    this.authService.createUserLocal(user);
    this.isSubmitting.set(false);
    this.closeAddModal();
    this.successMessage.set('User created successfully!');
    setTimeout(() => this.successMessage.set(''), 3000);
  }

  async toggleSuspend(user: any) {
    const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
    const result = await this.authService.suspendUser(user.id, newStatus);
    if (result.success) {
      this.successMessage.set(result.message);
      await this.loadUsers();
      setTimeout(() => this.successMessage.set(''), 3000);
    } else {
      this.errorMessage.set(result.message);
      setTimeout(() => this.errorMessage.set(''), 3000);
    }
  }

  getInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  getRoleBadgeClass(role: string): string {
    const classes: Record<string, string> = {
      admin: 'bg-red-100 text-red-700',
      teacher: 'bg-green-100 text-green-700',
      student: 'bg-blue-100 text-blue-700',
      parent: 'bg-purple-100 text-purple-700',
    };
    return classes[role] || 'bg-gray-100 text-gray-700';
  }

  getStatusBadgeClass(status: string): string {
    return status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';
  }

  getAvatarBgClass(role: string): string {
    const classes: Record<string, string> = {
      admin: 'bg-red-500',
      teacher: 'bg-green-500',
      student: 'bg-blue-500',
      parent: 'bg-purple-500',
    };
    return classes[role] || 'bg-gray-500';
  }
}
