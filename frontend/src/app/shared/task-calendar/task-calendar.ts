import { Component, signal, OnInit, inject, output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Task {
  id: number;
  title: string;
  description: string;
  due_date: string;
  priority: string;
  status: string;
  admin_name: string;
}

interface CalendarDay {
  dateStr: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: Task[];
  highestPriority: string;
}

@Component({
  selector: 'app-task-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
      <!-- Header -->
      <div class="p-3 bg-gray-900 text-white flex items-center justify-between">
        <button (click)="prevMonth()" class="p-1.5 hover:bg-gray-700 rounded-lg transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 class="text-sm font-semibold">{{ getMonthYear() }}</h3>
        <button (click)="nextMonth()" class="p-1.5 hover:bg-gray-700 rounded-lg transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- Week Days -->
      <div class="grid grid-cols-7 border-b border-gray-100">
        @for (d of weekDays; track d) {
          <div class="py-1.5 text-center text-[10px] font-medium text-gray-400 uppercase">{{ d }}</div>
        }
      </div>

      <!-- Calendar Grid -->
      <div class="grid grid-cols-7 p-1.5 gap-0.5">
        @for (day of calendarDays(); track day.dateStr) {
          <button
            (click)="selectDay(day)"
            class="relative w-full aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all"
            [class]="getCellClasses(day)">
            <span class="font-medium">{{ day.day }}</span>
            @if (day.tasks.length > 0 && day.isCurrentMonth) {
              <div class="flex gap-px mt-px">
                @for (task of day.tasks.slice(0, 4); track task.id) {
                  <span class="w-1 h-1 rounded-full" [class]="getTaskDotColor(task.priority)"></span>
                }
                @if (day.tasks.length > 4) {
                  <span class="w-1 h-1 rounded-full bg-gray-400"></span>
                }
              </div>
            }
          </button>
        }
      </div>

      <!-- Selected Day Tasks -->
      @if (selectedDate() && selectedDateTasks().length > 0) {
        <div class="border-t border-gray-100 p-3 max-h-56 overflow-y-auto">
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{{ getSelectedDateLabel() }}</h4>
            <span class="text-[10px] text-gray-400">{{ selectedDateTasks().length }} task(s)</span>
          </div>
          <div class="space-y-1.5">
            @for (task of selectedDateTasks(); track task.id) {
              <div class="p-2 rounded-lg border-l-[3px] bg-gray-50"
                [class]="getTaskBorderClass(task.priority)">
                <div class="flex items-start justify-between gap-2">
                  <p class="text-xs font-medium text-gray-900 leading-tight">{{ task.title }}</p>
                  <span class="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                    [class]="task.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'">
                    {{ task.status === 'completed' ? 'Done' : 'Pending' }}
                  </span>
                </div>
                @if (task.description) {
                  <p class="text-[10px] text-gray-500 mt-0.5 leading-snug">{{ task.description }}</p>
                }
                <p class="text-[9px] text-gray-400 mt-1">From: {{ task.admin_name }}</p>
              </div>
            }
          </div>
        </div>
      } @else if (selectedDate() && selectedDateTasks().length === 0) {
        <div class="border-t border-gray-100 p-4 text-center">
          <p class="text-xs text-gray-400">No tasks on this day</p>
        </div>
      }

      <!-- Legend -->
      <div class="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <div class="flex items-center gap-2 text-[9px] text-gray-500">
          <span class="flex items-center gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>Urgent</span>
          <span class="flex items-center gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-orange-500"></span>High</span>
          <span class="flex items-center gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Med</span>
          <span class="flex items-center gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>Low</span>
        </div>
        <span class="text-[9px] text-gray-400">{{ totalTaskCount() }} total</span>
      </div>
    </div>
  `,
  styles: []
})
export class TaskCalendarComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private refreshInterval: any;

  close = output();

  protected readonly currentMonth = signal(new Date());
  protected readonly calendarDays = signal<CalendarDay[]>([]);
  protected readonly selectedDate = signal<string | null>(null);
  protected readonly selectedDateTasks = signal<Task[]>([]);
  protected readonly allTasks = signal<Task[]>([]);
  protected readonly totalTaskCount = signal(0);
  protected readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  ngOnInit() {
    this.loadTasks();
    this.refreshInterval = setInterval(() => this.loadTasks(), 15000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  loadTasks() {
    this.http.get<{ tasks: Task[] }>(`${environment.apiUrl}/tasks/my-tasks`).subscribe({
      next: (res) => {
        this.allTasks.set(res.tasks);
        this.totalTaskCount.set(res.tasks.filter(t => t.status !== 'completed').length);
        this.buildCalendar();
      },
    });
  }

  buildCalendar() {
    const month = this.currentMonth().getMonth();
    const year = this.currentMonth().getFullYear();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    const days: CalendarDay[] = [];

    const prevMonthLast = new Date(year, month, 0);
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLast.getDate() - i);
      days.push(this.makeDay(d, false, todayStr));
    }

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      days.push(this.makeDay(date, true, todayStr));
    }

    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      days.push(this.makeDay(date, false, todayStr));
    }

    this.calendarDays.set(days);
  }

  private makeDay(date: Date, isCurrentMonth: boolean, todayStr: string): CalendarDay {
    const dateStr = this.toDateStr(date);
    const tasks = this.allTasks().filter(t => t.due_date === dateStr);
    return {
      dateStr,
      day: date.getDate(),
      isCurrentMonth,
      isToday: dateStr === todayStr,
      tasks,
      highestPriority: this.getHighestPriority(tasks),
    };
  }

  private toDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private getHighestPriority(tasks: Task[]): string {
    if (tasks.length === 0) return '';
    if (tasks.some(t => t.priority === 'urgent')) return 'urgent';
    if (tasks.some(t => t.priority === 'high')) return 'high';
    if (tasks.some(t => t.priority === 'medium')) return 'medium';
    return 'low';
  }

  selectDay(day: CalendarDay) {
    if (day.tasks.length === 0) {
      this.selectedDate.set(null);
      this.selectedDateTasks.set([]);
      return;
    }
    this.selectedDate.set(day.dateStr);
    this.selectedDateTasks.set(day.tasks);
  }

  prevMonth() {
    const curr = this.currentMonth();
    this.currentMonth.set(new Date(curr.getFullYear(), curr.getMonth() - 1, 1));
    this.selectedDate.set(null);
    this.selectedDateTasks.set([]);
    this.buildCalendar();
  }

  nextMonth() {
    const curr = this.currentMonth();
    this.currentMonth.set(new Date(curr.getFullYear(), curr.getMonth() + 1, 1));
    this.selectedDate.set(null);
    this.selectedDateTasks.set([]);
    this.buildCalendar();
  }

  getMonthYear(): string {
    return this.currentMonth().toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
  }

  getSelectedDateLabel(): string {
    const ds = this.selectedDate();
    if (!ds) return '';
    const [y, m, d] = ds.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-KE', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  getCellClasses(day: CalendarDay): string {
    const base = [];
    if (!day.isCurrentMonth) {
      base.push('text-gray-300', 'cursor-default');
    } else {
      base.push('text-gray-900');
    }

    if (day.isToday) {
      base.push('ring-2', 'ring-blue-500', 'ring-inset', 'font-bold');
    }

    if (day.tasks.length > 0 && day.isCurrentMonth) {
      base.push('cursor-pointer');
      switch (day.highestPriority) {
        case 'urgent':
          base.push('bg-red-100', 'hover:bg-red-200', 'border', 'border-red-300');
          break;
        case 'high':
          base.push('bg-orange-100', 'hover:bg-orange-200', 'border', 'border-orange-300');
          break;
        case 'medium':
          base.push('bg-blue-100', 'hover:bg-blue-200', 'border', 'border-blue-300');
          break;
        case 'low':
          base.push('bg-gray-100', 'hover:bg-gray-200', 'border', 'border-gray-300');
          break;
      }
    } else if (day.isCurrentMonth) {
      base.push('hover:bg-gray-50');
    }

    return base.join(' ');
  }

  getTaskDotColor(priority: string): string {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-blue-500';
      case 'low': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  }

  getTaskBorderClass(priority: string): string {
    switch (priority) {
      case 'urgent': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-blue-500';
      case 'low': return 'border-l-gray-400';
      default: return 'border-l-gray-400';
    }
  }
}
