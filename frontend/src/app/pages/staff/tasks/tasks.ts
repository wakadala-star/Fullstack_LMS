import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Task {
  id: number;
  admin_id: number;
  teacher_id: number;
  title: string;
  description: string;
  due_date: string;
  priority: string;
  status: string;
  completed_at: string | null;
  created_at: string;
  admin_name: string;
}

@Component({
  selector: 'app-staff-tasks',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tasks.html',
  styleUrls: ['./tasks.css'],
})
export class StaffTasksComponent implements OnInit {
  private http = inject(HttpClient);

  protected readonly allTasks = signal<Task[]>([]);
  protected readonly todayTasks = signal<Task[]>([]);
  protected readonly upcomingTasks = signal<Task[]>([]);
  protected readonly completedTasks = signal<Task[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly activeTab = signal<'today' | 'upcoming' | 'completed'>('today');
  protected readonly stats = signal({ total: 0, pending: 0, completed: 0, todayDue: 0, overdue: 0 });
  protected readonly completionMessage = signal('');

  ngOnInit() {
    this.loadTasks();
    this.loadStats();
  }

  loadTasks() {
    this.isLoading.set(true);
    this.http.get<{ tasks: Task[] }>(`${environment.apiUrl}/tasks/my-tasks`).subscribe({
      next: (res) => {
        const tasks = res.tasks;
        const today = new Date().toISOString().split('T')[0];
        const todayTs = new Date(today).getTime();

        this.allTasks.set(tasks);
        this.todayTasks.set(tasks.filter(t => t.due_date === today && t.status !== 'completed'));
        this.completedTasks.set(tasks.filter(t => t.status === 'completed'));
        this.upcomingTasks.set(tasks.filter(t => t.due_date > today && t.status !== 'completed'));
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  loadStats() {
    this.http.get<any>(`${environment.apiUrl}/tasks/stats`).subscribe({
      next: (res) => this.stats.set(res),
    });
  }

  toggleTask(task: Task) {
    if (task.status === 'completed') {
      // Reopen
      this.http.patch(`${environment.apiUrl}/tasks/${task.id}/reopen`, {}).subscribe({
        next: () => {
          this.loadTasks();
          this.loadStats();
        },
      });
    } else {
      // Mark complete
      this.http.patch(`${environment.apiUrl}/tasks/${task.id}/complete`, {}).subscribe({
        next: () => {
          this.completionMessage.set(`"${task.title}" marked as completed!`);
          setTimeout(() => this.completionMessage.set(''), 3000);
          this.loadTasks();
          this.loadStats();
        },
      });
    }
  }

  setTab(tab: 'today' | 'upcoming' | 'completed') {
    this.activeTab.set(tab);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-KE', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-600 border-gray-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  }

  isOverdue(task: Task): boolean {
    const today = new Date().toISOString().split('T')[0];
    return task.due_date < today && task.status !== 'completed';
  }

  getDayLabel(dateStr: string): string {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    if (dateStr === today) return 'Today';
    if (dateStr === tomorrow) return 'Tomorrow';
    return this.formatDate(dateStr);
  }
}
