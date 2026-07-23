import { Component, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { DatePipe, TitleCasePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  token: string;
  status: string;
  phone: string;
  avatar: string;
  created_at: string;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, FormsModule, DatePipe, TitleCasePipe, NgClass],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboard implements OnInit, OnDestroy {
  protected readonly stats = computed(() => [
    { label: 'Students', value: this.users().filter(u => u.role === 'student').length.toString(), icon: 'users', color: 'blue' },
    { label: 'Teachers', value: this.users().filter(u => u.role === 'teacher').length.toString(), icon: 'teacher', color: 'green' },
    { label: 'Parents', value: this.users().filter(u => u.role === 'parent').length.toString(), icon: 'parents', color: 'purple' },
    { label: 'Courses', value: this.data.courses().length.toString(), icon: 'courses', color: 'yellow' },
  ]);

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly showCreateForm = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly createdToken = signal('');
  protected readonly newUser = signal({ name: '', email: '', password: '', role: 'teacher' as 'teacher' | 'parent' });

  private refreshInterval: any;

  constructor(public auth: AuthService, public data: DataService) {}

  ngOnInit() {
    this.data.loadCourses();
    this.data.loadGrades();
    this.data.loadFees();
    this.loadUsers();
    this.refreshInterval = setInterval(() => this.loadUsers(), 10000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  async loadUsers() {
    const users = await this.auth.fetchAllUsers();
    this.users.set(users);
  }

  toggleCreateForm() {
    this.showCreateForm.update(v => !v);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.createdToken.set('');
    this.newUser.set({ name: '', email: '', password: '', role: 'teacher' });
  }

  async onCreateUser() {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.createdToken.set('');

    const { name, email, password, role } = this.newUser();

    if (!name || !email || !password) {
      this.errorMessage.set('All fields are required.');
      return;
    }

    if (password.length < 6) {
      this.errorMessage.set('Password must be at least 6 characters.');
      return;
    }

    this.isLoading.set(true);

    const result = await this.auth.createUser(name, email, password, role);

    this.isLoading.set(false);

    if (result.success) {
      this.successMessage.set(result.message);
      this.createdToken.set(result.token || '');
      this.newUser.set({ name: '', email: '', password: '', role: 'teacher' });
      await this.loadUsers();
    } else {
      this.errorMessage.set(result.message);
    }
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700';
      case 'teacher': return 'bg-green-100 text-green-700';
      case 'parent': return 'bg-purple-100 text-purple-700';
      case 'student': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }
}
