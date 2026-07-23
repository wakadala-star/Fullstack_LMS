import { Component, computed, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';
import { environment } from '../../../../environments/environment';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-staff-quizzes',
  imports: [FormsModule, ConfirmDialogComponent],
  templateUrl: './staff-quizzes.html',
  styleUrl: './staff-quizzes.css'
})
export class StaffQuizzesComponent implements OnInit {
  protected readonly selectedStatus = signal('');
  protected readonly expandedQuizId = signal<string | null>(null);
  protected readonly showCreateModal = signal(false);
  protected readonly showEditModal = signal(false);
  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly editMessage = signal('');

  // Confirm dialogs
  protected readonly showDeleteQuizConfirm = signal(false);
  protected readonly deleteQuizId = signal('');
  protected readonly showRemoveMaterialConfirm = signal(false);
  protected readonly removeMaterialFilename = signal('');

  // Create quiz form
  protected readonly newQuizTitle = signal('');
  protected readonly newQuizDescription = signal('');
  protected readonly newQuizCourseId = signal('');
  protected readonly newQuizType = signal<'take_home' | 'online'>('online');
  protected readonly newQuizDuration = signal(50);
  protected readonly newQuizStartDate = signal('');
  protected readonly newQuizEndDate = signal('');
  protected readonly newQuizQuestions = signal<any[]>([]);
  protected readonly newQuizFiles = signal<File[]>([]);

  // Edit quiz form
  protected readonly editQuizId = signal('');
  protected readonly editTitle = signal('');
  protected readonly editDescription = signal('');
  protected readonly editDuration = signal(50);
  protected readonly editStartDate = signal('');
  protected readonly editEndDate = signal('');
  protected readonly editStatus = signal('');
  protected readonly editQuestions = signal<any[]>([]);
  protected readonly editMaterials = signal<any[]>([]);
  protected readonly editNewFiles = signal<File[]>([]);

  protected readonly myCourses = computed(() => {
    const name = this.auth.user()?.name ?? '';
    const userId = this.auth.user()?.id ?? '';
    return this.data.courses().filter(c =>
      c.instructor === name || c.instructor_id?.toString() === userId
    );
  });

  protected readonly myQuizzes = computed(() => {
    const courseIds = this.myCourses().map(c => c.id);
    const userId = this.auth.user()?.id ?? '';
    const status = this.selectedStatus();
    return this.data.quizzes()
      .filter(q => courseIds.includes(q.courseId) || q.instructorId?.toString() === userId)
      .filter(q => !status || q.status === status);
  });

  constructor(public auth: AuthService, public data: DataService) {}

  ngOnInit() {
    this.data.loadCourses();
    this.data.loadQuizzes();
  }

  protected toggleExpand(quizId: string): void {
    this.expandedQuizId.set(this.expandedQuizId() === quizId ? null : quizId);
  }

  // ===== CREATE MODAL =====

  protected openCreateModal(): void {
    this.newQuizTitle.set('');
    this.newQuizDescription.set('');
    this.newQuizCourseId.set(this.myCourses()[0]?.id || '');
    this.newQuizType.set('online');
    this.newQuizDuration.set(50);
    this.newQuizStartDate.set('');
    this.newQuizEndDate.set('');
    this.newQuizQuestions.set([]);
    this.newQuizFiles.set([]);
    this.showCreateModal.set(true);
    this.message.set('');
  }

  protected closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.message.set('');
  }

  protected addQuestion(): void {
    this.newQuizQuestions.update(qs => [...qs, {
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      points: 1
    }]);
  }

  protected removeQuestion(index: number): void {
    this.newQuizQuestions.update(qs => qs.filter((_: any, i: number) => i !== index));
  }

  protected updateQuestionText(index: number, value: string): void {
    this.newQuizQuestions.update(qs => {
      const copy = [...qs];
      copy[index] = { ...copy[index], question: value };
      return copy;
    });
  }

  protected updateOption(qIndex: number, oIndex: number, value: string): void {
    this.newQuizQuestions.update(qs => {
      const copy = [...qs];
      const opts = [...copy[qIndex].options];
      opts[oIndex] = value;
      copy[qIndex] = { ...copy[qIndex], options: opts };
      return copy;
    });
  }

  protected updateCorrectAnswer(qIndex: number, oIndex: number): void {
    this.newQuizQuestions.update(qs => {
      const copy = [...qs];
      copy[qIndex] = { ...copy[qIndex], correctAnswer: oIndex };
      return copy;
    });
  }

  protected updateQuestionPoints(index: number, points: number): void {
    this.newQuizQuestions.update(qs => {
      const copy = [...qs];
      copy[index] = { ...copy[index], points };
      return copy;
    });
  }

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      this.newQuizFiles.update(files => [...files, ...newFiles]);
    }
    input.value = '';
  }

  protected removeFile(index: number): void {
    this.newQuizFiles.update(files => files.filter((_: any, i: number) => i !== index));
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  protected async createQuiz(): Promise<void> {
    const title = this.newQuizTitle();
    const courseId = this.newQuizCourseId();
    if (!title || !courseId) {
      this.message.set('Title and course are required');
      return;
    }

    this.loading.set(true);
    try {
      const questions = this.newQuizQuestions();
      const totalPoints = questions.reduce((sum: number, q: any) => sum + (q.points || 1), 0);
      const result = await this.data.createQuiz({
        title,
        description: this.newQuizDescription(),
        course_id: parseInt(courseId),
        quiz_type: this.newQuizType(),
        duration: this.newQuizDuration(),
        total_points: totalPoints,
        start_time: this.newQuizStartDate() || null,
        end_time: this.newQuizEndDate() || null,
        questions: questions.map((q: any, i: number) => ({
          id: i.toString(),
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          points: q.points
        }))
      });

      if (this.newQuizType() === 'take_home' && this.newQuizFiles().length > 0 && result?.quiz?.id) {
        await this.data.uploadQuizMaterials(result.quiz.id, this.newQuizFiles());
      }

      this.data.loadQuizzes();
      this.closeCreateModal();
      this.message.set('Quiz created successfully');
    } catch (e: any) {
      this.message.set(e?.error?.error || 'Failed to create quiz');
    }
    this.loading.set(false);
  }

  // ===== EDIT MODAL =====

  protected openEditModal(quiz: any): void {
    this.editQuizId.set(quiz.id);
    this.editTitle.set(quiz.title);
    this.editDescription.set(quiz.description || '');
    this.editDuration.set(quiz.duration);
    this.editStartDate.set(quiz.startDate ? this.toDateTimeLocal(quiz.startDate) : '');
    this.editEndDate.set(quiz.endDate ? this.toDateTimeLocal(quiz.endDate) : '');
    this.editStatus.set(quiz.status);
    this.editQuestions.set((quiz.questions || []).map((q: any) => ({
      id: q.id,
      question: q.question,
      options: [...q.options],
      correctAnswer: q.correctAnswer,
      points: q.points || 1
    })));
    this.editMaterials.set(quiz.materials || []);
    this.editNewFiles.set([]);
    this.editMessage.set('');
    this.showEditModal.set(true);
  }

  protected closeEditModal(): void {
    this.showEditModal.set(false);
    this.editMessage.set('');
  }

  private toDateTimeLocal(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  }

  protected editAddQuestion(): void {
    this.editQuestions.update(qs => [...qs, {
      id: Date.now().toString(),
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      points: 1
    }]);
  }

  protected editRemoveQuestion(index: number): void {
    this.editQuestions.update(qs => qs.filter((_: any, i: number) => i !== index));
  }

  protected editUpdateQuestionText(index: number, value: string): void {
    this.editQuestions.update(qs => {
      const copy = [...qs];
      copy[index] = { ...copy[index], question: value };
      return copy;
    });
  }

  protected editUpdateOption(qIndex: number, oIndex: number, value: string): void {
    this.editQuestions.update(qs => {
      const copy = [...qs];
      const opts = [...copy[qIndex].options];
      opts[oIndex] = value;
      copy[qIndex] = { ...copy[qIndex], options: opts };
      return copy;
    });
  }

  protected editUpdateCorrectAnswer(qIndex: number, oIndex: number): void {
    this.editQuestions.update(qs => {
      const copy = [...qs];
      copy[qIndex] = { ...copy[qIndex], correctAnswer: oIndex };
      return copy;
    });
  }

  protected editUpdateQuestionPoints(index: number, points: number): void {
    this.editQuestions.update(qs => {
      const copy = [...qs];
      copy[index] = { ...copy[index], points };
      return copy;
    });
  }

  protected editOnFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const arr = Array.from(input.files);
      this.editNewFiles.update(files => [...files, ...arr]);
    }
    input.value = '';
  }

  protected editRemoveFile(index: number): void {
    this.editNewFiles.update(files => files.filter((_: any, i: number) => i !== index));
  }

  protected async editRemoveMaterial(filename: string): Promise<void> {
    this.removeMaterialFilename.set(filename);
    this.showRemoveMaterialConfirm.set(true);
  }

  protected async confirmRemoveMaterial(): Promise<void> {
    const filename = this.removeMaterialFilename();
    this.showRemoveMaterialConfirm.set(false);
    try {
      await this.data.deleteQuizMaterial(this.editQuizId(), filename);
      this.editMaterials.update(mats => mats.filter((m: any) => m.filename !== filename));
    } catch (e) {
      console.error('Failed to remove material', e);
    }
  }

  protected async saveQuiz(): Promise<void> {
    const title = this.editTitle();
    if (!title) {
      this.editMessage.set('Title is required');
      return;
    }

    this.loading.set(true);
    try {
      const questions = this.editQuestions();
      const totalPoints = questions.reduce((sum: number, q: any) => sum + (q.points || 1), 0);
      await this.data.updateQuiz(this.editQuizId(), {
        title,
        description: this.editDescription(),
        duration: this.editDuration(),
        total_points: totalPoints,
        start_time: this.editStartDate() || null,
        end_time: this.editEndDate() || null,
        status: this.editStatus(),
        questions: questions.map((q: any, i: number) => ({
          id: q.id || i.toString(),
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          points: q.points
        }))
      });

      if (this.editNewFiles().length > 0) {
        await this.data.uploadQuizMaterials(this.editQuizId(), this.editNewFiles());
      }

      this.data.loadQuizzes();
      this.closeEditModal();
      this.message.set('Quiz updated successfully');
    } catch (e: any) {
      this.editMessage.set(e?.error?.error || 'Failed to update quiz');
    }
    this.loading.set(false);
  }

  // ===== DELETE / SUBMISSIONS =====

  protected async deleteQuiz(quizId: string): Promise<void> {
    this.deleteQuizId.set(quizId);
    this.showDeleteQuizConfirm.set(true);
  }

  protected async confirmDeleteQuiz(): Promise<void> {
    const quizId = this.deleteQuizId();
    this.showDeleteQuizConfirm.set(false);
    try {
      await this.data.deleteQuiz(quizId);
      this.data.loadQuizzes();
    } catch (e) {
      console.error('Delete failed', e);
    }
  }

  getFileUrl(url: string): string {
    return url.startsWith('http') ? url : `${environment.apiUrl.replace('/api', '')}${url}`;
  }
}
