import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { User, UserRole } from '../models/user.model';
import { environment } from '../../../environments/environment';

interface AuthResponse {
  message: string;
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    avatar?: string;
  };
}

interface AdminUserResponse {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  token: string;
  status: string;
  phone: string;
  avatar: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUser = signal<User | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUser() !== null);
  readonly userRole = computed(() => this.currentUser()?.role ?? null);

  constructor(private router: Router, private http: HttpClient) {
    const saved = localStorage.getItem(environment.userKey);
    const token = localStorage.getItem(environment.tokenKey);
    if (saved && token) {
      try {
        this.currentUser.set(JSON.parse(saved));
      } catch {}
    }
  }

  login(email: string, password: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, { email, password })
        .subscribe({
          next: (response) => {
            const user: User = {
              id: response.user.id.toString(),
              name: response.user.name,
              email: response.user.email,
              role: response.user.role,
              phone: '',
              avatar: response.user.avatar || '',
              joinDate: new Date().toISOString().split('T')[0],
              status: 'active',
            };
            this.currentUser.set(user);
            localStorage.setItem(environment.userKey, JSON.stringify(user));
            localStorage.setItem(environment.tokenKey, response.token);
            resolve(true);
          },
          error: () => {
            resolve(false);
          }
        });
    });
  }

  tokenLogin(name: string, token: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      this.http.post<AuthResponse>(`${environment.apiUrl}/auth/token-login`, { name, token })
        .subscribe({
          next: (response) => {
            const user: User = {
              id: response.user.id.toString(),
              name: response.user.name,
              email: response.user.email,
              role: response.user.role,
              phone: '',
              avatar: response.user.avatar || '',
              joinDate: new Date().toISOString().split('T')[0],
              status: 'active',
            };
            this.currentUser.set(user);
            localStorage.setItem(environment.userKey, JSON.stringify(user));
            localStorage.setItem(environment.tokenKey, response.token);
            resolve({ success: true, message: response.message });
          },
          error: (error) => {
            const message = error.error?.error || 'Token login failed';
            resolve({ success: false, message });
          }
        });
    });
  }

  register(name: string, email: string, password: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, { name, email, password })
        .subscribe({
          next: (response) => {
            resolve({ success: true, message: response.message });
          },
          error: (error) => {
            const message = error.error?.error || 'Registration failed';
            resolve({ success: false, message });
          }
        });
    });
  }

  createUser(name: string, email: string, password: string, role: 'teacher' | 'parent'): Promise<{ success: boolean; message: string; token?: string }> {
    return new Promise((resolve) => {
      this.http.post<{ message: string; user: AdminUserResponse }>(`${environment.apiUrl}/auth/create-user`, { name, email, password, role })
        .subscribe({
          next: (response) => {
            resolve({ success: true, message: response.message, token: response.user.token });
          },
          error: (error) => {
            const message = error.error?.error || 'Failed to create user';
            resolve({ success: false, message });
          }
        });
    });
  }

  createUserLocal(userData: Omit<User, 'id' | 'joinDate' | 'status'>): User {
    const newUser: User = {
      ...userData,
      id: Date.now().toString(),
      joinDate: new Date().toISOString().split('T')[0],
      status: 'active',
    };
    return newUser;
  }

  getAllUsers(): User[] {
    return [];
  }

  getUsersByRole(role: UserRole): User[] {
    return [];
  }

  fetchAllUsers(): Promise<AdminUserResponse[]> {
    return new Promise((resolve) => {
      this.http.get<{ users: AdminUserResponse[] }>(`${environment.apiUrl}/auth/users`)
        .subscribe({
          next: (response) => {
            resolve(response.users);
          },
          error: () => {
            resolve([]);
          }
        });
    });
  }

  suspendUser(id: number, status: 'active' | 'suspended'): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      this.http.patch<{ message: string }>(`${environment.apiUrl}/auth/users/${id}/status`, { status })
        .subscribe({
          next: (response) => {
            resolve({ success: true, message: response.message });
          },
          error: (error) => {
            const message = error.error?.error || 'Failed to update user status';
            resolve({ success: false, message });
          }
        });
    });
  }

  updateProfile(data: { name?: string; phone?: string; avatar?: string }): Promise<{ success: boolean; message: string; user?: any }> {
    return new Promise((resolve) => {
      this.http.put<{ message: string; user: any }>(`${environment.apiUrl}/auth/profile`, data)
        .subscribe({
          next: (response) => {
            // Update local user data
            const current = this.currentUser();
            if (current && response.user) {
              const updated: User = {
                ...current,
                name: response.user.name,
                phone: response.user.phone || '',
                avatar: response.user.avatar || current.avatar,
              };
              this.currentUser.set(updated);
              localStorage.setItem(environment.userKey, JSON.stringify(updated));
            }
            resolve({ success: true, message: response.message, user: response.user });
          },
          error: (error) => {
            const message = error.error?.error || 'Failed to update profile';
            resolve({ success: false, message });
          }
        });
    });
  }

  changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      this.http.put<{ message: string }>(`${environment.apiUrl}/auth/password`, { currentPassword, newPassword })
        .subscribe({
          next: (response) => {
            resolve({ success: true, message: response.message });
          },
          error: (error) => {
            const message = error.error?.error || 'Failed to change password';
            resolve({ success: false, message });
          }
        });
    });
  }

  fetchNotifications(): Promise<{ notifications: any[]; unreadCount: number }> {
    return new Promise((resolve) => {
      this.http.get<{ notifications: any[]; unreadCount: number }>(`${environment.apiUrl}/auth/notifications`)
        .subscribe({
          next: (response) => {
            resolve({ notifications: response.notifications, unreadCount: response.unreadCount });
          },
          error: () => {
            resolve({ notifications: [], unreadCount: 0 });
          }
        });
    });
  }

  markNotificationRead(id: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.http.patch(`${environment.apiUrl}/auth/notifications/${id}/read`, {})
        .subscribe({
          next: () => resolve(true),
          error: () => resolve(false)
        });
    });
  }

  logout(): void {
    this.currentUser.set(null);
    localStorage.removeItem(environment.userKey);
    localStorage.removeItem(environment.tokenKey);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(environment.tokenKey);
  }
}
