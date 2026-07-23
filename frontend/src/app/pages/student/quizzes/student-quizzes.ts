import { Component, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-student-quizzes',
  imports: [NgClass, FormsModule, DatePipe],
  templateUrl: './student-quizzes.html',
  styleUrls: ['./student-quizzes.css'],
})
export class StudentQuizzesComponent implements OnInit, OnDestroy {
  protected readonly filterStatus = signal('');
  protected readonly showTakeModal = signal(false);
  protected readonly showTakeHomeModal = signal(false);
  protected readonly selectedQuiz = signal<any>(null);
  protected readonly answers = signal<number[]>([]);
  protected readonly timeRemaining = signal(0);
  protected readonly timerInterval = signal<any>(null);
  protected readonly submitting = signal(false);
  protected readonly message = signal('');
  protected readonly messageType = signal<'success' | 'error'>('success');
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly uploading = signal(false);
  protected readonly now = signal(Date.now());
  private deadlineInterval: any = null;
  private refreshInterval: any = null;

  private readonly QUIZ_DURATION = 50 * 60; // 50 minutes in seconds

  protected readonly quizzes = computed(() => {
    const all = this.data.quizzes();
    const status = this.filterStatus();
    const userId = this.auth.user()?.id ?? '';
    const submittedQuizIds = this.data.submissions()
      .filter(s => s.studentId === userId)
      .map(s => s.quizId);
    const now = this.now();

    return all
      .map(q => {
        // Override status based on real-time
        let realStatus = q.status;
        if (q.startDate && q.endDate) {
          const start = new Date(q.startDate).getTime();
          const end = new Date(q.endDate).getTime();
          if (now < start) realStatus = 'upcoming';
          else if (now >= start && now <= end) realStatus = 'active';
          else realStatus = 'completed';
        } else if (q.startDate) {
          const start = new Date(q.startDate).getTime();
          if (now < start) realStatus = 'upcoming';
          else realStatus = 'active';
        }
        return { ...q, status: realStatus };
      })
      .filter(q => {
        if (submittedQuizIds.includes(q.id)) {
          return status ? status === 'completed' : true;
        }
        return true;
      })
      .filter(q => !status || q.status === status);
  });

  protected readonly upcomingCount = computed(() => {
    const userId = this.auth.user()?.id ?? '';
    const submittedIds = this.data.submissions().filter(s => s.studentId === userId).map(s => s.quizId);
    return this.quizzes().filter(q => q.status === 'upcoming' && !submittedIds.includes(q.id)).length;
  });
  protected readonly activeCount = computed(() => {
    const userId = this.auth.user()?.id ?? '';
    const submittedIds = this.data.submissions().filter(s => s.studentId === userId).map(s => s.quizId);
    return this.quizzes().filter(q => q.status === 'active' && !submittedIds.includes(q.id)).length;
  });
  protected readonly completedCount = computed(() => {
    const userId = this.auth.user()?.id ?? '';
    const submittedIds = this.data.submissions().filter(s => s.studentId === userId).map(s => s.quizId);
    return this.quizzes().filter(q => q.status === 'completed' || submittedIds.includes(q.id)).length;
  });

  protected readonly timeDisplay = computed(() => {
    const secs = this.timeRemaining();
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  });

  constructor(
    protected readonly auth: AuthService,
    protected readonly data: DataService,
  ) {}

  ngOnInit() {
    this.data.loadCourses();
    this.data.loadQuizzes();
    this.data.loadSubmissions();
    this.deadlineInterval = setInterval(() => this.now.set(Date.now()), 1000);
    this.refreshInterval = setInterval(() => {
      this.data.loadQuizzes();
      this.data.loadSubmissions();
    }, 30000);
  }

  ngOnDestroy() {
    this.clearTimer();
    if (this.deadlineInterval) clearInterval(this.deadlineInterval);
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  onFilterChange(event: Event): void {
    this.filterStatus.set((event.target as HTMLSelectElement).value);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'upcoming': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'active': return 'bg-green-50 text-green-700 border-green-200';
      case 'completed': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  }

  getSubmissionStatus(quizId: string): string | null {
    const sub = this.data.submissions().find(s =>
      s.quizId === quizId && s.studentId === this.auth.user()?.id
    );
    return sub?.status || null;
  }

  getScore(quizId: string): number | null {
    const sub = this.data.submissions().find(s =>
      s.quizId === quizId && s.studentId === this.auth.user()?.id && s.status === 'graded'
    );
    return sub?.percentage ?? null;
  }

  startQuiz(quiz: any): void {
    if (quiz.quizType === 'online') {
      this.selectedQuiz.set(quiz);
      this.answers.set(new Array(quiz.totalQuestions).fill(-1));
      // Calculate actual time: min(50 min, time until quiz end_time)
      let maxSeconds = this.QUIZ_DURATION;
      if (quiz.endDate) {
        const endMs = new Date(quiz.endDate).getTime();
        const secondsUntilEnd = Math.floor((endMs - Date.now()) / 1000);
        if (secondsUntilEnd > 0 && secondsUntilEnd < maxSeconds) {
          maxSeconds = secondsUntilEnd;
        }
      }
      this.timeRemaining.set(maxSeconds);
      this.startTimer();
      this.showTakeModal.set(true);
    } else {
      this.selectedQuiz.set(quiz);
      this.selectedFile.set(null);
      this.showTakeHomeModal.set(true);
    }
  }

  private startTimer(): void {
    this.clearTimer();
    const interval = setInterval(() => {
      const remaining = this.timeRemaining();
      if (remaining <= 0) {
        this.submitOnlineQuiz();
        return;
      }
      this.timeRemaining.set(remaining - 1);
    }, 1000);
    this.timerInterval.set(interval);
  }

  private clearTimer(): void {
    if (this.timerInterval()) {
      clearInterval(this.timerInterval());
      this.timerInterval.set(null);
    }
  }

  selectAnswer(qIndex: number, answer: number): void {
    this.answers.update(a => {
      const newAnswers = [...a];
      newAnswers[qIndex] = answer;
      return newAnswers;
    });
  }

  async submitOnlineQuiz(): Promise<void> {
    this.clearTimer();
    this.submitting.set(true);
    try {
      const quiz = this.selectedQuiz();
      const timeTaken = Math.round((this.QUIZ_DURATION - this.timeRemaining()) / 60);
      await this.data.submitQuiz(quiz.id, {
        answers: this.answers(),
        timeTaken
      });
      this.data.loadQuizzes();
      this.data.loadSubmissions();
      this.showTakeModal.set(false);
      this.messageType.set('success');
      this.message.set('Quiz submitted successfully!');
    } catch (e: any) {
      this.messageType.set('error');
      this.message.set(e?.error?.error || 'Failed to submit quiz');
    }
    this.submitting.set(false);
  }

  closeTakeModal(): void {
    this.clearTimer();
    this.showTakeModal.set(false);
    this.selectedQuiz.set(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
    }
  }

  async submitTakeHome(): Promise<void> {
    const quiz = this.selectedQuiz();
    if (!quiz) return;

    this.uploading.set(true);
    try {
      await this.data.submitQuiz(quiz.id, {
        file: this.selectedFile() || undefined,
        timeTaken: 0
      });
      this.data.loadQuizzes();
      this.data.loadSubmissions();
      this.showTakeHomeModal.set(false);
      this.messageType.set('success');
      this.message.set('Submission uploaded successfully!');
    } catch (e: any) {
      this.messageType.set('error');
      this.message.set(e?.error?.error || 'Failed to submit');
    }
    this.uploading.set(false);
  }

  closeTakeHomeModal(): void {
    this.showTakeHomeModal.set(false);
    this.selectedQuiz.set(null);
    this.selectedFile.set(null);
  }

  getFileUrl(url: string): string {
    return url.startsWith('http') ? url : `${environment.apiUrl.replace('/api', '')}${url}`;
  }

  getDeadlineDisplay(quiz: any): string {
    if (!quiz.endDate) return '';
    const end = new Date(quiz.endDate).getTime();
    const now = this.now();
    const diff = end - now;
    if (diff <= 0) return 'Deadline passed';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    if (days > 0) return `${days}d ${hours}h ${mins}m remaining`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s remaining`;
    return `${mins}m ${secs}s remaining`;
  }

  isDeadlineUrgent(quiz: any): boolean {
    if (!quiz.endDate) return false;
    const diff = new Date(quiz.endDate).getTime() - this.now();
    return diff > 0 && diff < 3600000; // less than 1 hour
  }

  isDeadlinePassed(quiz: any): boolean {
    if (!quiz.endDate) return false;
    return new Date(quiz.endDate).getTime() - this.now() <= 0;
  }

  getTimeUntilStart(quiz: any): string {
    if (!quiz.startDate) return '';
    const start = new Date(quiz.startDate).getTime();
    const diff = start - this.now();
    if (diff <= 0) return 'Starting now...';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    if (days > 0) return `Opens in ${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `Opens in ${hours}h ${mins}m ${secs}s`;
    return `Opens in ${mins}m ${secs}s`;
  }

  isStartUrgent(quiz: any): boolean {
    if (!quiz.startDate) return false;
    const diff = new Date(quiz.startDate).getTime() - this.now();
    return diff > 0 && diff < 3600000;
  }
}
