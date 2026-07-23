import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../../core/services/data.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-quiz-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './quiz-management.html',
  styleUrl: './quiz-management.css'
})
export class QuizManagementComponent implements OnInit {
  protected readonly searchTerm = signal('');
  protected readonly selectedStatus = signal('all');
  protected readonly selectedType = signal('all');
  protected readonly expandedQuiz = signal<string | null>(null);

  protected readonly filteredQuizzes = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const status = this.selectedStatus();
    const type = this.selectedType();
    return this.data.quizzes().filter(q => {
      const matchesSearch = !term || q.title.toLowerCase().includes(term) || q.courseName.toLowerCase().includes(term);
      const matchesStatus = status === 'all' || q.status === status;
      const matchesType = type === 'all' || q.quizType === type;
      return matchesSearch && matchesStatus && matchesType;
    });
  });

  protected readonly totalQuizzes = computed(() => this.data.quizzes().length);
  protected readonly activeQuizzes = computed(() => this.data.quizzes().filter(q => q.status === 'active').length);
  protected readonly completedQuizzes = computed(() => this.data.quizzes().filter(q => q.status === 'completed').length);
  protected readonly takeHomeQuizzes = computed(() => this.data.quizzes().filter(q => q.quizType === 'take_home').length);
  protected readonly onlineQuizzes = computed(() => this.data.quizzes().filter(q => q.quizType === 'online').length);

  protected readonly avgScore = computed(() => {
    const graded = this.data.submissions().filter(s => s.status === 'graded');
    if (graded.length === 0) return 0;
    return Math.round(graded.reduce((sum, s) => sum + s.percentage, 0) / graded.length);
  });

  constructor(public data: DataService, public auth: AuthService) {}

  ngOnInit() {
    this.data.loadCourses();
    this.data.loadQuizzes();
  }

  getSubmissions(quizId: string) {
    return this.data.getQuizSubmissions(quizId);
  }

  toggleQuiz(quizId: string) {
    this.expandedQuiz.update(current => current === quizId ? null : quizId);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatSubmittedAt(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
