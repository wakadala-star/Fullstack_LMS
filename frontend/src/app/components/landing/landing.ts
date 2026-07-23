import { Component, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Navbar } from '../navbar/navbar';
import { Footer } from '../footer/footer';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Feedback {
  id: number;
  name: string;
  role: string;
  rating: number;
  comment: string;
  created_at: string;
}

@Component({
  selector: 'app-landing',
  imports: [Navbar, Footer],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class Landing implements OnInit {
  protected readonly stats = [
    { value: '50K+', label: 'Active Students' },
    { value: '200+', label: 'Expert Courses' },
    { value: '100+', label: 'Certified Instructors' },
    { value: '95%', label: 'Completion Rate' },
  ];

  protected readonly features = [
    {
      title: 'Course Management',
      description: 'Create, organize, and manage courses with rich multimedia content, assignments, and assessments.',
      icon: 'course',
    },
    {
      title: 'Progress Tracking',
      description: 'Track learner progress with detailed analytics, dashboards, and completion certificates.',
      icon: 'progress',
    },
    {
      title: 'Live Classes',
      description: 'Host live video sessions with real-time chat, screen sharing, and interactive whiteboards.',
      icon: 'live',
    },
    {
      title: 'Assessments & Quizzes',
      description: 'Build quizzes, assignments, and exams with auto-grading and detailed feedback.',
      icon: 'assessment',
    },
    {
      title: 'Discussion Forums',
      description: 'Foster community with discussion boards, peer reviews, and collaborative projects.',
      icon: 'forum',
    },
    {
      title: 'Certificates',
      description: 'Award verified certificates upon course completion to boost learner credentials.',
      icon: 'certificate',
    },
  ];

  protected readonly categories = [
    { name: 'Web Development', count: 45, icon: 'code' },
    { name: 'Data Science', count: 32, icon: 'data' },
    { name: 'Mobile Development', count: 28, icon: 'mobile' },
    { name: 'Cloud & DevOps', count: 21, icon: 'cloud' },
    { name: 'AI & Machine Learning', count: 19, icon: 'ai' },
    { name: 'Cybersecurity', count: 16, icon: 'security' },
  ];

  protected readonly testimonials = signal<Feedback[]>([
    {
      id: 0,
      name: 'Sarah Johnson',
      role: 'student',
      rating: 5,
      comment: 'LearnHub transformed my career. I went from knowing nothing about web development to landing my dream job in just 6 months.',
      created_at: '',
    },
    {
      id: 0,
      name: 'Michael Chen',
      role: 'student',
      rating: 5,
      comment: 'The data science courses are incredible. Real-world projects and expert instructors made all the difference.',
      created_at: '',
    },
    {
      id: 0,
      name: 'Emily Rodriguez',
      role: 'student',
      rating: 5,
      comment: 'The flexibility to learn at my own pace while maintaining a full-time job was exactly what I needed.',
      created_at: '',
    },
  ]);

  protected readonly pricingPlans = [
    {
      name: 'Basic',
      price: 'Free',
      period: '',
      description: 'Perfect for getting started',
      features: [
        'Access to free courses',
        'Basic progress tracking',
        'Community forums',
        'Mobile app access',
      ],
      cta: 'Get Started',
      featured: false,
    },
    {
      name: 'Pro',
      price: 'UGX 110,000',
      period: '/month',
      description: 'Best for serious learners',
      features: [
        'All Basic features',
        'Unlimited course access',
        'Verified certificates',
        'Priority support',
        'Offline downloads',
        'Live class access',
      ],
      cta: 'Start Free Trial',
      featured: true,
    },
    {
      name: 'Enterprise',
      price: 'UGX 370,000',
      period: '/month',
      description: 'For teams and organizations',
      features: [
        'All Pro features',
        'Team management',
        'Custom branding',
        'API access',
        'Dedicated account manager',
        'SSO integration',
      ],
      cta: 'Contact Sales',
      featured: false,
    },
  ];

  protected readonly activeTestimonial = signal(0);

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadFeedback();
  }

  loadFeedback() {
    this.http.get<{ feedback: Feedback[] }>(`${environment.apiUrl}/auth/feedback/public`).subscribe({
      next: (res) => {
        if (res.feedback.length > 0) {
          this.testimonials.set(res.feedback);
        }
      },
      error: () => {}
    });
  }

  nextTestimonial(): void {
    this.activeTestimonial.update(v => (v + 1) % this.testimonials().length);
  }

  prevTestimonial(): void {
    this.activeTestimonial.update(v => (v - 1 + this.testimonials().length) % this.testimonials().length);
  }
}
