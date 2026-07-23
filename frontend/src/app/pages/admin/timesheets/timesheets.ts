import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

const EAT_TIMEZONE = 'Africa/Nairobi';

interface TimesheetEntry {
  id: number;
  user_id: number;
  teacher_name: string;
  teacher_email: string;
  clock_in_ms: number;
  clock_out_ms: number | null;
  total_hours: number;
  status: string;
  created_at: string;
}

@Component({
  selector: 'app-timesheets-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './timesheets.html',
  styleUrls: ['./timesheets.css'],
})
export class TimesheetsComponent implements OnInit {
  private http = inject(HttpClient);

  protected readonly timesheets = signal<TimesheetEntry[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly isLoading = signal(true);

  protected readonly filteredTimesheets = signal<TimesheetEntry[]>([]);

  protected readonly totalEntries = signal(0);
  protected readonly clockedInNow = signal(0);
  protected readonly totalHoursWorked = signal(0);
  protected readonly todayEntries = signal(0);

  constructor() {}

  ngOnInit() {
    this.loadTimesheets();
  }

  loadTimesheets() {
    this.isLoading.set(true);
    this.http.get<{ timesheets: any[] }>(`${environment.apiUrl}/clock/timesheets`).subscribe({
      next: (res) => {
        const entries = res.timesheets.map((t: any): TimesheetEntry => ({
          id: t.id,
          user_id: t.user_id,
          teacher_name: t.teacher_name,
          teacher_email: t.teacher_email,
          clock_in_ms: Number(t.clock_in_ms),
          clock_out_ms: t.clock_out_ms ? Number(t.clock_out_ms) : null,
          total_hours: parseFloat(t.total_hours) || 0,
          status: t.status,
          created_at: t.created_at,
        }));
        this.timesheets.set(entries);
        this.filteredTimesheets.set(entries);
        this.computeStats(entries);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  computeStats(entries: TimesheetEntry[]) {
    this.totalEntries.set(entries.length);
    this.clockedInNow.set(entries.filter(e => e.status === 'clocked_in').length);
    this.totalHoursWorked.set(Math.round(entries.reduce((sum, e) => sum + e.total_hours, 0) * 100) / 100);

    const todayMs = new Date().setHours(0, 0, 0, 0);
    const tomorrowMs = todayMs + 86400000;
    this.todayEntries.set(entries.filter(e => e.clock_in_ms >= todayMs && e.clock_in_ms < tomorrowMs).length);
  }

  onSearch(event: Event) {
    const term = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchTerm.set(term);
    if (!term) {
      this.filteredTimesheets.set(this.timesheets());
      return;
    }
    this.filteredTimesheets.set(
      this.timesheets().filter(t =>
        t.teacher_name.toLowerCase().includes(term) ||
        t.teacher_email.toLowerCase().includes(term)
      )
    );
  }

  msToEatDate(ms: number): string {
    return new Date(ms).toLocaleDateString('en-KE', {
      timeZone: EAT_TIMEZONE,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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

  getDuration(entry: TimesheetEntry): string {
    const endMs = entry.clock_out_ms ?? Date.now();
    const diffMs = endMs - entry.clock_in_ms;
    if (diffMs < 0) return '0h 0m';
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (entry.status === 'clocked_in') {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${hours}h ${minutes}m`;
  }
}
