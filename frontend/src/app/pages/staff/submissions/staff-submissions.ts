import { Component, computed, signal, OnInit, effect } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-staff-submissions',
  imports: [DatePipe, FormsModule],
  templateUrl: './staff-submissions.html',
  styleUrl: './staff-submissions.css'
})
export class StaffSubmissionsComponent implements OnInit {
  protected readonly searchTerm = signal('');
  protected readonly filterStatus = signal('all');
  protected readonly filterQuizId = signal('all');
  protected readonly gradingId = signal<string | null>(null);
  protected readonly gradeScore = signal(0);
  protected readonly gradeTotalPoints = signal(0);
  protected readonly gradeFeedback = signal('');
  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly gradingQuizQuestions = signal<any[]>([]);
  protected readonly gradingStudentAnswers = signal<any[]>([]);

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
    return this.data.quizzes().filter(q =>
      courseIds.includes(q.courseId) || q.instructorId?.toString() === userId
    );
  });

  protected readonly allSubmissions = signal<any[]>([]);

  protected readonly filteredSubmissions = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const status = this.filterStatus();
    const quizId = this.filterQuizId();
    return this.allSubmissions().filter(s => {
      const matchesSearch = !term ||
        (s.student_name || '').toLowerCase().includes(term) ||
        (s.student_email || '').toLowerCase().includes(term) ||
        (s.quiz_title || '').toLowerCase().includes(term);
      const matchesStatus = status === 'all' || s.status === status;
      const matchesQuiz = quizId === 'all' || s.quiz_id?.toString() === quizId;
      return matchesSearch && matchesStatus && matchesQuiz;
    });
  });

  protected readonly totalSubmissions = computed(() => this.allSubmissions().length);
  protected readonly pendingCount = computed(() => this.allSubmissions().filter(s => s.status === 'pending').length);
  protected readonly submittedCount = computed(() => this.allSubmissions().filter(s => s.status === 'submitted').length);
  protected readonly gradedCount = computed(() => this.allSubmissions().filter(s => s.status === 'graded').length);
  protected readonly avgScore = computed(() => {
    const graded = this.allSubmissions().filter(s => s.status === 'graded');
    if (graded.length === 0) return 0;
    return Math.round(graded.reduce((sum, s) => sum + (s.percentage || 0), 0) / graded.length);
  });

  protected readonly gradingQuestionResults = computed(() => {
    const questions = this.gradingQuizQuestions();
    const answers = this.gradingStudentAnswers();
    if (!questions || questions.length === 0 || !answers || answers.length === 0) return [];
    return questions.map((q: any, i: number) => {
      const studentAnswer = answers[i];
      const isCorrect = studentAnswer === q.correctAnswer;
      const letterLabels = ['A', 'B', 'C', 'D'];
      return {
        question: q.question,
        options: q.options,
        points: q.points || 1,
        studentAnswer: studentAnswer,
        studentLetter: studentAnswer >= 0 && studentAnswer <= 3 ? letterLabels[studentAnswer] : '—',
        correctAnswer: q.correctAnswer,
        correctLetter: letterLabels[q.correctAnswer] || '?',
        isCorrect
      };
    });
  });

  protected readonly gradingAutoScore = computed(() => {
    return this.gradingQuestionResults().filter((r: any) => r.isCorrect).reduce((sum: number, r: any) => sum + r.points, 0);
  });

  protected readonly gradingAutoTotal = computed(() => {
    return this.gradingQuestionResults().reduce((sum: number, r: any) => sum + r.points, 0);
  });

  private hasLoadedSubmissions = false;

  constructor(public auth: AuthService, public data: DataService) {
    effect(() => {
      const quizzes = this.myQuizzes();
      if (quizzes.length > 0 && !this.hasLoadedSubmissions) {
        this.hasLoadedSubmissions = true;
        this.loadAllSubmissions();
      }
    });
  }

  ngOnInit() {
    this.data.loadCourses();
    this.data.loadQuizzes();
    this.loadAllSubmissions();
  }

  protected async loadAllSubmissions(): Promise<void> {
    try {
      const quizIds = this.myQuizzes().map(q => q.id);
      const allSubs: any[] = [];
      for (const qid of quizIds) {
        try {
          const result = await this.data.http.get<{ submissions: any[] }>(
            `${environment.apiUrl}/quizzes/${qid}/submissions`
          ).toPromise();
          if (result?.submissions) {
            allSubs.push(...result.submissions);
          }
        } catch {}
      }
      this.allSubmissions.set(allSubs);
    } catch {
      this.allSubmissions.set([]);
    }
  }

  protected startGrading(sub: any): void {
    this.gradingId.set(sub.id);
    this.gradingQuizQuestions.set(sub.quiz_questions || []);
    this.gradingStudentAnswers.set(sub.answers || []);
    if (sub.quiz_type === 'online' && sub.quiz_questions?.length > 0) {
      const autoScore = sub.quiz_questions.reduce((sum: number, q: any, i: number) => {
        return sum + ((sub.answers?.[i] === q.correctAnswer) ? (q.points || 1) : 0);
      }, 0);
      const autoTotal = sub.quiz_questions.reduce((sum: number, q: any) => sum + (q.points || 1), 0);
      this.gradeScore.set(autoScore);
      this.gradeTotalPoints.set(autoTotal);
    } else {
      this.gradeScore.set(sub.score || 0);
      this.gradeTotalPoints.set(sub.quiz_total_points || sub.total_points || 0);
    }
    this.gradeFeedback.set(sub.feedback || '');
  }

  protected cancelGrading(): void {
    this.gradingId.set(null);
    this.gradingQuizQuestions.set([]);
    this.gradingStudentAnswers.set([]);
  }

  protected async submitGrade(quizId: string, submissionId: string): Promise<void> {
    this.loading.set(true);
    try {
      await this.data.gradeSubmission(quizId, submissionId, this.gradeScore(), this.gradeTotalPoints(), this.gradeFeedback());
      this.message.set('Grade saved successfully');
      this.gradingId.set(null);
      this.gradingQuizQuestions.set([]);
      this.gradingStudentAnswers.set([]);
      await this.loadAllSubmissions();
    } catch (e: any) {
      this.message.set(e?.error?.error || 'Failed to grade');
    }
    this.loading.set(false);
  }

  protected autoScoreFromAnswers(): void {
    this.gradeScore.set(this.gradingAutoScore());
    this.gradeTotalPoints.set(this.gradingAutoTotal());
  }

  getFileUrl(url: string): string {
    return url.startsWith('http') ? url : `${environment.apiUrl.replace('/api', '')}${url}`;
  }
}
