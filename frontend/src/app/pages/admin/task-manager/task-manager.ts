import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog';
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
  teacher_name: string;
  teacher_email: string;
  admin_name: string;
}

interface Teacher {
  id: number;
  name: string;
  email: string;
}

@Component({
  selector: 'app-task-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  templateUrl: './task-manager.html',
  styleUrls: ['./task-manager.css'],
})
export class TaskManagerComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  protected readonly tasks = signal<Task[]>([]);
  protected readonly teachers = signal<Teacher[]>([]);
  protected readonly selectedTeacher = signal<Teacher | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly showAssignModal = signal(false);
  protected readonly showEditModal = signal(false);
  protected readonly editingTask = signal<Task | null>(null);
  protected readonly searchTerm = signal('');
  protected readonly filterStatus = signal('all');
  protected readonly filterPriority = signal('all');
  protected readonly taskToDelete = signal<number | null>(null);
  protected readonly showDeleteConfirm = signal(false);

  protected readonly newTask = signal({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
  });

  protected readonly filteredTasks = signal<Task[]>([]);

  protected readonly totalTasks = signal(0);
  protected readonly pendingTasks = signal(0);
  protected readonly completedTasks = signal(0);
  protected readonly overdueTasks = signal(0);

  ngOnInit() {
    this.loadTeachers();
    this.loadAllTasks();

    this.route.queryParams.subscribe(params => {
      if (params['teacherId']) {
        const tid = parseInt(params['teacherId'], 10);
        this.selectTeacher(tid);
      }
    });
  }

  loadTeachers() {
    this.http.get<{ teachers: Teacher[] }>(`${environment.apiUrl}/tasks/staff`).subscribe({
      next: (res) => this.teachers.set(res.teachers),
    });
  }

  loadAllTasks() {
    this.isLoading.set(true);
    this.http.get<{ tasks: Task[] }>(`${environment.apiUrl}/tasks`).subscribe({
      next: (res) => {
        this.tasks.set(res.tasks);
        this.applyFilters();
        this.computeStats(res.tasks);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  loadTeacherTasks(teacherId: number) {
    this.isLoading.set(true);
    this.http.get<{ tasks: Task[] }>(`${environment.apiUrl}/tasks/teacher/${teacherId}`).subscribe({
      next: (res) => {
        this.tasks.set(res.tasks);
        this.applyFilters();
        this.computeStats(res.tasks);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  selectTeacher(teacherId: number | null) {
    if (teacherId === null) {
      this.selectedTeacher.set(null);
      this.loadAllTasks();
    } else {
      const teacher = this.teachers().find(t => t.id === teacherId) || null;
      this.selectedTeacher.set(teacher);
      this.loadTeacherTasks(teacherId);
    }
  }

  computeStats(tasks: Task[]) {
    const today = new Date().toISOString().split('T')[0];
    this.totalTasks.set(tasks.length);
    this.pendingTasks.set(tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length);
    this.completedTasks.set(tasks.filter(t => t.status === 'completed').length);
    this.overdueTasks.set(tasks.filter(t => t.due_date < today && t.status !== 'completed').length);
  }

  applyFilters() {
    let filtered = [...this.tasks()];

    if (this.searchTerm()) {
      const term = this.searchTerm().toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(term) ||
        t.teacher_name.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term)
      );
    }

    if (this.filterStatus() !== 'all') {
      filtered = filtered.filter(t => t.status === this.filterStatus());
    }

    if (this.filterPriority() !== 'all') {
      filtered = filtered.filter(t => t.priority === this.filterPriority());
    }

    this.filteredTasks.set(filtered);
  }

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.applyFilters();
  }

  onFilterStatus(event: Event) {
    this.filterStatus.set((event.target as HTMLSelectElement).value);
    this.applyFilters();
  }

  onFilterPriority(event: Event) {
    this.filterPriority.set((event.target as HTMLSelectElement).value);
    this.applyFilters();
  }

  openAssignModal() {
    const today = new Date().toISOString().split('T')[0];
    this.newTask.set({ title: '', description: '', dueDate: today, priority: 'medium' });
    this.showAssignModal.set(true);
  }

  closeAssignModal() {
    this.showAssignModal.set(false);
  }

  openEditModal(task: Task) {
    this.editingTask.set(task);
    this.newTask.set({
      title: task.title,
      description: task.description,
      dueDate: task.due_date,
      priority: task.priority,
    });
    this.showEditModal.set(true);
  }

  closeEditModal() {
    this.showEditModal.set(false);
    this.editingTask.set(null);
  }

  assignTask() {
    const task = this.newTask();
    const teacher = this.selectedTeacher();
    if (!teacher || !task.title || !task.dueDate) return;

    this.http.post(`${environment.apiUrl}/tasks`, {
      teacherId: teacher.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      priority: task.priority,
    }).subscribe({
      next: () => {
        this.closeAssignModal();
        this.loadTeacherTasks(teacher.id);
      },
    });
  }

  updateTask() {
    const task = this.newTask();
    const editing = this.editingTask();
    if (!editing || !task.title || !task.dueDate) return;

    this.http.put(`${environment.apiUrl}/tasks/${editing.id}`, {
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      priority: task.priority,
    }).subscribe({
      next: () => {
        this.closeEditModal();
        if (this.selectedTeacher()) {
          this.loadTeacherTasks(this.selectedTeacher()!.id);
        } else {
          this.loadAllTasks();
        }
      },
    });
  }

  deleteTask(taskId: number) {
    this.taskToDelete.set(taskId);
    this.showDeleteConfirm.set(true);
  }

  confirmDelete() {
    const taskId = this.taskToDelete();
    if (!taskId) return;
    this.http.delete(`${environment.apiUrl}/tasks/${taskId}`).subscribe({
      next: () => {
        this.taskToDelete.set(null);
        this.showDeleteConfirm.set(false);
        if (this.selectedTeacher()) {
          this.loadTeacherTasks(this.selectedTeacher()!.id);
        } else {
          this.loadAllTasks();
        }
      },
    });
  }

  cancelDelete() {
    this.taskToDelete.set(null);
    this.showDeleteConfirm.set(false);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'medium': return 'bg-blue-100 text-blue-700';
      case 'low': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700';
      case 'pending': return 'bg-blue-100 text-blue-700';
      case 'cancelled': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  isOverdue(task: Task): boolean {
    const today = new Date().toISOString().split('T')[0];
    return task.due_date < today && task.status !== 'completed';
  }
}
