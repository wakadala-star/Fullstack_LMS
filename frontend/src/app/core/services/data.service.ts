import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Course, Grade, FeeRecord, Quiz, QuizSubmission, Notification } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly _courses = signal<Course[]>([]);
  private readonly _grades = signal<Grade[]>([]);
  private readonly _fees = signal<FeeRecord[]>([]);
  private readonly _quizzes = signal<Quiz[]>([]);
  private readonly _submissions = signal<QuizSubmission[]>([]);
  private readonly _notifications = signal<Notification[]>([]);
  private readonly _children = signal<any[]>([]);

  readonly courses = this._courses.asReadonly();
  readonly grades = this._grades.asReadonly();
  readonly fees = this._fees.asReadonly();
  readonly quizzes = this._quizzes.asReadonly();
  readonly submissions = this._submissions.asReadonly();
  readonly notifications = this._notifications.asReadonly();
  readonly children = this._children.asReadonly();

  constructor(public http: HttpClient) {}

  loadCourses(): void {
    this.http.get<{ courses: Course[] }>(`${environment.apiUrl}/courses`).subscribe({
      next: (res) => {
        this._courses.set(res.courses || []);
      },
      error: (err) => {
        console.error('Failed to load courses:', err);
      }
    });
  }

  loadGrades(): void {
    this.http.get<{ grades: any[] }>(`${environment.apiUrl}/grades`).subscribe({
      next: (res) => {
        const grades = (res.grades || []).map(g => this.mapGrade(g));
        this._grades.set(grades);
      },
      error: (err) => {
        console.error('Failed to load grades:', err);
      }
    });
  }

  loadFees(): void {
    this.http.get<{ fees: any[] }>(`${environment.apiUrl}/fees`).subscribe({
      next: (res) => {
        const fees = (res.fees || []).map(f => this.mapFee(f));
        this._fees.set(fees);
      },
      error: (err) => {
        console.error('Failed to load fees:', err);
      }
    });
  }

  loadChildren(): void {
    this.http.get<{ children: any[] }>(`${environment.apiUrl}/parent-student/children`).subscribe({
      next: (res) => {
        this._children.set(res.children || []);
      },
      error: (err) => {
        console.error('Failed to load children:', err);
      }
    });
  }

  loadQuizzes(courseId?: string): void {
    const url = courseId ? `${environment.apiUrl}/quizzes?course_id=${courseId}` : `${environment.apiUrl}/quizzes`;
    this.http.get<{ quizzes: any[] }>(url).subscribe({
      next: (res) => {
        const quizzes = (res.quizzes || []).map(q => this.mapQuiz(q));
        this._quizzes.set(quizzes);
      },
      error: (err) => {
        console.error('Failed to load quizzes:', err);
      }
    });
  }

  loadSubmissions(quizId?: string): void {
    const url = quizId
      ? `${environment.apiUrl}/quizzes/${quizId}/submissions`
      : `${environment.apiUrl}/quizzes/my-submissions`;
    this.http.get<{ submissions: any[] }>(url).subscribe({
      next: (res) => {
        const subs = (res.submissions || []).map(s => this.mapSubmission(s));
        this._submissions.set(subs);
      },
      error: (err) => {
        console.error('Failed to load submissions:', err);
      }
    });
  }

  createQuiz(quizData: any): Promise<any> {
    return this.http.post<any>(`${environment.apiUrl}/quizzes`, quizData).toPromise();
  }

  updateQuiz(id: string, quizData: any): Promise<any> {
    return this.http.put<any>(`${environment.apiUrl}/quizzes/${id}`, quizData).toPromise();
  }

  deleteQuiz(id: string): Promise<any> {
    return this.http.delete<any>(`${environment.apiUrl}/quizzes/${id}`).toPromise();
  }

  uploadQuizMaterials(quizId: string, files: File[]): Promise<any> {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    return this.http.post<any>(`${environment.apiUrl}/quizzes/${quizId}/materials`, formData).toPromise();
  }

  deleteQuizMaterial(quizId: string, filename: string): Promise<any> {
    return this.http.delete<any>(`${environment.apiUrl}/quizzes/${quizId}/materials/${filename}`).toPromise();
  }

  submitQuiz(quizId: string, data: { answers?: number[]; file?: File; timeTaken?: number }): Promise<any> {
    const formData = new FormData();
    if (data.answers) {
      formData.append('answers', JSON.stringify(data.answers));
    }
    if (data.file) {
      formData.append('file', data.file);
    }
    if (data.timeTaken !== undefined) {
      formData.append('time_taken', data.timeTaken.toString());
    }
    return this.http.post<any>(`${environment.apiUrl}/quizzes/${quizId}/submit`, formData).toPromise();
  }

  gradeSubmission(quizId: string, submissionId: string, score: number, totalPoints?: number, feedback?: string): Promise<any> {
    return this.http.patch<any>(`${environment.apiUrl}/quizzes/${quizId}/submissions/${submissionId}/grade`, { score, total_points: totalPoints, feedback }).toPromise();
  }

  private mapQuiz(q: any): Quiz {
    const questions = q.questions || [];
    const materials = q.materials || [];
    return {
      id: q.id?.toString() || '',
      title: q.title || '',
      description: q.description || '',
      courseId: q.course_id?.toString() || '',
      courseName: q.course_name || '',
      courseCode: q.course_code || '',
      instructorId: q.instructor_id,
      quizType: q.quiz_type || 'online',
      duration: q.duration || 50,
      totalQuestions: questions.length,
      totalPoints: q.total_points || questions.reduce((sum: number, q: any) => sum + (q.points || 1), 0),
      status: q.status || 'upcoming',
      startDate: q.start_time || q.created_at || '',
      endDate: q.end_time || '',
      questions: questions.map((q: any, i: number) => ({
        id: q.id || i.toString(),
        question: q.question || '',
        options: q.options || [],
        correctAnswer: q.correctAnswer ?? 0,
        points: q.points || 1
      })),
      materials: materials.map((m: any) => ({
        name: m.name || '',
        type: m.type || '',
        size: m.size || '',
        url: m.url || '',
        filename: m.filename || ''
      })),
      createdAt: q.created_at
    };
  }

  private mapSubmission(s: any): QuizSubmission {
    return {
      id: s.id?.toString() || '',
      quizId: s.quiz_id?.toString() || '',
      studentId: s.student_id?.toString() || '',
      studentName: s.student_name || '',
      studentEmail: s.student_email || '',
      answers: s.answers || [],
      fileUrl: s.file_url || '',
      fileName: s.file_name || '',
      score: s.score || 0,
      totalPoints: s.total_points || 0,
      percentage: Math.round(s.percentage || 0),
      timeTaken: s.time_taken || 0,
      status: s.status || 'pending',
      feedback: s.feedback || '',
      submittedAt: s.submitted_at || '',
      gradedAt: s.graded_at || '',
      quizTitle: s.quiz_title || '',
      quizType: s.quiz_type || '',
      courseName: s.course_name || '',
      quizQuestions: s.quiz_questions || []
    };
  }

  getStudentGrades(studentId: string): Grade[] {
    return this._grades().filter(g => g.studentId === studentId);
  }

  getStudentFees(studentId: string): FeeRecord[] {
    return this._fees().filter(f => f.studentId === studentId);
  }

  getStudentCourses(studentId: string): Course[] {
    return this._courses().filter(c => c.status === 'active');
  }

  getCourseGrades(courseId: string): Grade[] {
    return this._grades().filter(g => g.courseId === courseId);
  }

  getQuizSubmissions(quizId: string): QuizSubmission[] {
    return this._submissions().filter(s => s.quizId === quizId);
  }

  getTotalRevenue(): number {
    return this._fees().reduce((sum, f) => sum + f.paid, 0);
  }

  getTotalPending(): number {
    return this._fees().reduce((sum, f) => sum + f.balance, 0);
  }

  markNotificationRead(id: string): void {
    this._notifications.update(nots =>
      nots.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }

  getUnreadCount(): number {
    return this._notifications().filter(n => !n.read).length;
  }

  addCourse(course: Omit<Course, 'id'>): void {
    const newCourse: Course = {
      ...course,
      id: (this._courses().length + 1).toString(),
    };
    this._courses.update(courses => [...courses, newCourse]);
  }

  addGrade(grade: Omit<Grade, 'id'>): void {
    this.http.post<any>(`${environment.apiUrl}/grades`, {
      student_id: grade.studentId,
      course_id: grade.courseId,
      assessment_type: grade.assessmentType,
      assessment_name: grade.assessmentName,
      score: grade.score,
      max_score: grade.maxScore,
      term: grade.term,
    }).subscribe({
      next: () => this.loadGrades(),
      error: (err) => console.error('Failed to create grade:', err),
    });
  }

  addFeeRecord(record: Omit<FeeRecord, 'id'>): void {
    this.http.post<any>(`${environment.apiUrl}/fees`, {
      student_id: record.studentId,
      description: record.description,
      amount: record.amount,
      due_date: record.dueDate,
    }).subscribe({
      next: () => this.loadFees(),
      error: (err) => console.error('Failed to create fee:', err),
    });
  }

  processPayment(feeId: string, amount: number, method: string): void {
    this.http.post<any>(`${environment.apiUrl}/fees/${feeId}/pay`, {
      amount,
      method,
      reference: `PAY-${Date.now()}`,
    }).subscribe({
      next: () => this.loadFees(),
      error: (err) => console.error('Failed to process payment:', err),
    });
  }

  private mapGrade(g: any): Grade {
    return {
      id: g.id?.toString() || '',
      studentId: g.student_id?.toString() || '',
      studentName: g.student_name || '',
      courseId: g.course_id?.toString() || '',
      assessmentType: g.assessment_type || 'quiz',
      assessmentName: g.assessment_name || '',
      score: parseFloat(g.score) || 0,
      maxScore: parseFloat(g.max_score) || 100,
      percentage: Math.round(parseFloat(g.percentage) || 0),
      letterGrade: g.letter_grade || 'F',
      date: g.created_at || '',
      term: g.term || '',
    };
  }

  private mapFee(f: any): FeeRecord {
    return {
      id: f.id?.toString() || '',
      studentId: f.student_id?.toString() || '',
      studentName: f.student_name || '',
      description: f.description || '',
      amount: parseFloat(f.amount) || 0,
      paid: parseFloat(f.paid) || 0,
      balance: parseFloat(f.balance) || 0,
      dueDate: f.due_date || '',
      status: f.status || 'unpaid',
      payments: (f.payments || []).map((p: any) => ({
        id: p.id?.toString() || '',
        amount: parseFloat(p.amount) || 0,
        date: p.date || '',
        method: p.method || '',
        reference: p.reference || '',
      })),
    };
  }
}
