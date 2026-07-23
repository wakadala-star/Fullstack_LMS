import { Component, output, signal, OnInit, ViewChild, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { FeedbackModalComponent } from '../../shared/feedback-modal/feedback-modal.component';
import { TaskCalendarComponent } from '../../shared/task-calendar/task-calendar';
import { environment } from '../../../environments/environment';

const EAT_TIMEZONE = 'Africa/Nairobi';

@Component({
  selector: 'app-header',
  imports: [RouterLink, DatePipe, FeedbackModalComponent, TaskCalendarComponent],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header implements OnInit, OnDestroy {
  @ViewChild('feedbackModal') feedbackModal!: FeedbackModalComponent;
  @ViewChild('notificationDropdown') notificationDropdown!: ElementRef;
  @ViewChild('profileDropdown') profileDropdown!: ElementRef;
  @ViewChild('clockDropdown') clockDropdown!: ElementRef;
  @ViewChild('briefcaseDropdown') briefcaseDropdown!: ElementRef;
  @ViewChild('calendarDropdown') calendarDropdown!: ElementRef;

  toggleSidebar = output();
  protected readonly showNotifications = signal(false);
  protected readonly showProfile = signal(false);
  protected readonly showClockMenu = signal(false);
  protected readonly showBriefcase = signal(false);
  protected readonly showCalendar = signal(false);
  protected readonly notifications = signal<any[]>([]);
  protected readonly unreadCount = signal(0);
  protected readonly isClockedIn = signal(false);
  protected readonly currentEntry = signal<any>(null);
  protected readonly elapsedTime = signal('0h 0m 0s');
  protected readonly clockInDisplay = signal('');
  protected readonly clockMessage = signal('');
  protected readonly staffList = signal<any[]>([]);
  protected readonly selectedTeacherId = signal<number | null>(null);
  protected readonly pendingTaskCount = signal(0);

  private clockInMs: number | null = null;
  private elapsedInterval: any = null;

  constructor(public auth: AuthService, public data: DataService, private http: HttpClient) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    if (this.showNotifications() && this.notificationDropdown) {
      const dropdownEl = this.notificationDropdown.nativeElement;
      if (!dropdownEl.contains(target)) {
        this.showNotifications.set(false);
      }
    }

    if (this.showProfile() && this.profileDropdown) {
      const dropdownEl = this.profileDropdown.nativeElement;
      if (!dropdownEl.contains(target)) {
        this.showProfile.set(false);
      }
    }

    if (this.showClockMenu() && this.clockDropdown) {
      const dropdownEl = this.clockDropdown.nativeElement;
      if (!dropdownEl.contains(target)) {
        this.showClockMenu.set(false);
      }
    }

    if (this.showBriefcase() && this.briefcaseDropdown) {
      const dropdownEl = this.briefcaseDropdown.nativeElement;
      if (!dropdownEl.contains(target)) {
        this.showBriefcase.set(false);
      }
    }

    if (this.showCalendar() && this.calendarDropdown) {
      const dropdownEl = this.calendarDropdown.nativeElement;
      if (!dropdownEl.contains(target)) {
        this.showCalendar.set(false);
      }
    }
  }

  ngOnInit() {
    this.loadNotifications();
    if (this.auth.userRole() === 'teacher') {
      this.checkClockStatus();
      this.loadPendingTaskCount();
      setInterval(() => this.loadPendingTaskCount(), 30000);
    }
    if (this.auth.userRole() === 'admin') {
      this.loadPendingTaskCount();
      setInterval(() => this.loadPendingTaskCount(), 30000);
    }
  }

  ngOnDestroy() {
    this.stopElapsedTimer();
  }

  onLogout() {
    this.showProfile.set(false);
    const role = this.auth.userRole();
    if (role === 'admin') {
      this.auth.logout();
    } else {
      this.feedbackModal.show();
    }
  }

  onFeedbackClosed() {
    this.auth.logout();
  }

  async loadNotifications() {
    if (!this.auth.isLoggedIn()) return;
    const result = await this.auth.fetchNotifications();
    this.notifications.set(result.notifications);
    this.unreadCount.set(result.unreadCount);
  }

  toggleNotifications(): void {
    this.showNotifications.update(v => !v);
    this.showProfile.set(false);
    this.showClockMenu.set(false);
    this.showBriefcase.set(false);
    this.showCalendar.set(false);
    if (!this.showNotifications()) return;
    this.loadNotifications();
  }

  async markAsRead(id: number) {
    await this.auth.markNotificationRead(id);
    this.notifications.update(nots =>
      nots.map(n => n.id === id ? { ...n, read: true } : n)
    );
    this.unreadCount.update(c => Math.max(0, c - 1));
  }

  async markAllAsRead() {
    const unread = this.notifications().filter(n => !n.read);
    for (const notif of unread) {
      await this.auth.markNotificationRead(notif.id);
    }
    this.notifications.update(nots =>
      nots.map(n => ({ ...n, read: true }))
    );
    this.unreadCount.set(0);
  }

  toggleProfile(): void {
    this.showProfile.update(v => !v);
    this.showNotifications.set(false);
    this.showClockMenu.set(false);
    this.showBriefcase.set(false);
    this.showCalendar.set(false);
  }

  toggleClockMenu(): void {
    this.showClockMenu.update(v => !v);
    this.showNotifications.set(false);
    this.showProfile.set(false);
    this.showBriefcase.set(false);
    this.showCalendar.set(false);
    if (this.showClockMenu()) {
      this.checkClockStatus();
    }
  }

  toggleBriefcase(): void {
    this.showBriefcase.update(v => !v);
    this.showNotifications.set(false);
    this.showProfile.set(false);
    this.showClockMenu.set(false);
    this.showCalendar.set(false);
    if (this.showBriefcase()) {
      this.loadStaff();
    }
  }

  toggleCalendar(): void {
    this.showCalendar.update(v => !v);
    this.showNotifications.set(false);
    this.showProfile.set(false);
    this.showClockMenu.set(false);
    this.showBriefcase.set(false);
  }

  onCalendarClose() {
    this.showCalendar.set(false);
  }

  loadStaff(): void {
    this.http.get<{ teachers: any[] }>(`${environment.apiUrl}/tasks/staff`).subscribe({
      next: (res) => {
        this.staffList.set(res.teachers);
      },
      error: () => {}
    });
  }

  loadPendingTaskCount(): void {
    this.http.get<{ total: number; pending: number }>(`${environment.apiUrl}/tasks/stats`).subscribe({
      next: (res) => {
        this.pendingTaskCount.set(res.pending);
      },
      error: () => {}
    });
  }

  checkClockStatus(): void {
    this.http.get<{ status: string; entry: any }>(`${environment.apiUrl}/clock/status`).subscribe({
      next: (res) => {
        if (res.status === 'clocked_in' && res.entry) {
          this.isClockedIn.set(true);
          this.currentEntry.set(res.entry);
          // clock_in_ms is epoch milliseconds - no timezone conversion needed
          if (this.clockInMs === null) {
            this.clockInMs = Number(res.entry.clock_in_ms);
            this.clockInDisplay.set(this.msToEatTime(this.clockInMs));
          }
          this.startElapsedTimer();
        } else {
          this.isClockedIn.set(false);
          this.currentEntry.set(null);
          this.clockInMs = null;
          this.clockInDisplay.set('');
          this.stopElapsedTimer();
          this.elapsedTime.set('0h 0m 0s');
        }
      },
      error: () => {}
    });
  }

  startElapsedTimer(): void {
    if (this.elapsedInterval) return;
    this.updateElapsed();
    this.elapsedInterval = setInterval(() => this.updateElapsed(), 1000);
  }

  stopElapsedTimer(): void {
    if (this.elapsedInterval) {
      clearInterval(this.elapsedInterval);
      this.elapsedInterval = null;
    }
  }

  updateElapsed(): void {
    if (this.clockInMs === null) return;
    const nowMs = Date.now();
    const diffMs = nowMs - this.clockInMs;
    if (diffMs < 0) {
      this.elapsedTime.set('0h 0m 0s');
      return;
    }
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    this.elapsedTime.set(`${hours}h ${minutes}m ${seconds}s`);
  }

  msToEatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString('en-KE', {
      timeZone: EAT_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  clockIn(): void {
    this.clockMessage.set('');
    this.http.post<{ message: string; entry: any }>(`${environment.apiUrl}/clock/clock-in`, {}).subscribe({
      next: (res) => {
        this.isClockedIn.set(true);
        this.currentEntry.set(res.entry);
        this.clockMessage.set('Clocked in successfully!');
        this.clockInMs = Number(res.entry.clock_in_ms);
        this.clockInDisplay.set(this.msToEatTime(this.clockInMs));
        this.startElapsedTimer();
        setTimeout(() => this.clockMessage.set(''), 3000);
      },
      error: (err) => {
        this.clockMessage.set(err.error?.error || 'Failed to clock in');
        setTimeout(() => this.clockMessage.set(''), 3000);
      }
    });
  }

  clockOut(): void {
    this.clockMessage.set('');
    this.http.post<{ message: string; entry: any }>(`${environment.apiUrl}/clock/clock-out`, {}).subscribe({
      next: (res) => {
        this.isClockedIn.set(false);
        this.currentEntry.set(null);
        this.clockInMs = null;
        this.clockInDisplay.set('');
        this.stopElapsedTimer();
        this.clockMessage.set(`Clocked out! Total: ${res.entry.total_hours} hours`);
        this.elapsedTime.set('0h 0m 0s');
        setTimeout(() => this.clockMessage.set(''), 3000);
      },
      error: (err) => {
        this.clockMessage.set(err.error?.error || 'Failed to clock out');
        setTimeout(() => this.clockMessage.set(''), 3000);
      }
    });
  }

  getRoleBadge(): string {
    const role = this.auth.userRole();
    if (role === 'admin') return 'Administrator';
    if (role === 'teacher') return 'Teacher';
    if (role === 'student') return 'Student';
    if (role === 'parent') return 'Parent';
    return '';
  }

  getDashboardRoute(): string {
    const role = this.auth.userRole();
    if (role === 'admin') return '/admin';
    if (role === 'teacher') return '/staff';
    if (role === 'student') return '/student';
    if (role === 'parent') return '/parent';
    return '/';
  }
}
