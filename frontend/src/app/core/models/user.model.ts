export type UserRole = 'admin' | 'teacher' | 'student' | 'parent';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  joinDate: string;
  status: 'active' | 'inactive';
}

export interface Student extends User {
  role: 'student';
  studentId: string;
  class: string;
  section: string;
  parentId?: string;
  feeBalance: number;
}

export interface Staff extends User {
  role: 'teacher';
  staffId: string;
  department: string;
  position: string;
  subjects: string[];
}

export interface Parent extends User {
  role: 'parent';
  children: string[];
}

export interface CourseMaterial {
  name: string;
  type: string;
  size: string;
  url: string;
  filename?: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  description: string;
  instructor: string;
  instructor_id?: number;
  category: string;
  credits: number;
  enrolled: number;
  maxEnrolled: number;
  status: 'active' | 'inactive' | 'completed';
  schedule: string;
  materials: CourseMaterial[];
}

export interface Grade {
  id: string;
  studentId: string;
  studentName?: string;
  courseId: string;
  assessmentType: 'quiz' | 'exam' | 'assignment' | 'project';
  assessmentName: string;
  score: number;
  maxScore: number;
  percentage: number;
  letterGrade: string;
  date: string;
  term: string;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  studentName: string;
  description: string;
  amount: number;
  paid: number;
  balance: number;
  dueDate: string;
  status: 'paid' | 'partial' | 'unpaid' | 'overdue';
  payments: Payment[];
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  courseId: string;
  courseName: string;
  courseCode?: string;
  instructorId?: number;
  quizType: 'take_home' | 'online';
  duration: number;
  totalQuestions: number;
  totalPoints: number;
  status: 'upcoming' | 'active' | 'completed';
  startDate: string;
  endDate: string;
  questions?: QuizQuestion[];
  materials?: CourseMaterial[];
  createdAt?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  points: number;
}

export interface QuizSubmission {
  id: string;
  quizId: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  answers: number[];
  fileUrl?: string;
  fileName?: string;
  score: number;
  totalPoints: number;
  percentage: number;
  timeTaken: number;
  status: 'pending' | 'submitted' | 'graded';
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
  quizTitle?: string;
  quizType?: string;
  courseName?: string;
  quizQuestions?: any[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  date: string;
  read: boolean;
}
