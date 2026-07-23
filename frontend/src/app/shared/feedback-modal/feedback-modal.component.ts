import { Component, signal, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-feedback-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 w-full">
          <h2 class="text-xl font-bold text-gray-900 mb-1">Share Your Experience</h2>
          <p class="text-sm text-gray-500 mb-6">How was your experience with LearnHub?</p>

          @if (submitted()) {
            <div class="text-center py-8">
              <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p class="text-lg font-semibold text-gray-900">Thank you!</p>
              <p class="text-sm text-gray-500 mt-1">Your feedback helps us improve.</p>
            </div>
          } @else {
            <!-- Stars -->
            <div class="flex items-center gap-2 mb-5">
              @for (i of [1, 2, 3, 4, 5]; track i) {
                <button (click)="setRating(i)" class="focus:outline-none transition-transform hover:scale-110">
                  <svg class="w-9 h-9" [class.text-yellow-400]="i <= rating()" [class.text-gray-300]="i > rating()" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              }
              @if (rating() > 0) {
                <span class="text-sm text-gray-500 ml-2">{{ ratingLabel() }}</span>
              }
            </div>

            <!-- Comment -->
            <div class="mb-5">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Leave a comment (optional)</label>
              <textarea
                [ngModel]="comment()"
                (ngModelChange)="comment.set($event)"
                rows="3"
                placeholder="Tell us what you think..."
                class="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
              ></textarea>
            </div>

            @if (errorMessage()) {
              <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {{ errorMessage() }}
              </div>
            }

            <!-- Actions -->
            <div class="flex items-center gap-3">
              <button (click)="skip()" class="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Not now
              </button>
              <button (click)="submit()" [disabled]="rating() === 0 || isSubmitting()" class="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                @if (isSubmitting()) {
                  Submitting...
                } @else {
                  Submit
                }
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class FeedbackModalComponent {
  @Output() closed = new EventEmitter<void>();

  isOpen = signal(false);
  rating = signal(0);
  comment = signal('');
  isSubmitting = signal(false);
  submitted = signal(false);
  errorMessage = signal('');

  private ratingLabels: Record<number, string> = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent',
  };

  constructor(private auth: AuthService, private http: HttpClient) {}

  show() {
    this.isOpen.set(true);
    this.rating.set(0);
    this.comment.set('');
    this.submitted.set(false);
    this.errorMessage.set('');
  }

  setRating(value: number) {
    this.rating.set(value);
  }

  ratingLabel(): string {
    return this.ratingLabels[this.rating()] || '';
  }

  skip() {
    this.isOpen.set(false);
    this.closed.emit();
  }

  submit() {
    if (this.rating() === 0) return;
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.http.post(`${environment.apiUrl}/auth/feedback`, {
      rating: this.rating(),
      comment: this.comment() || undefined,
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.submitted.set(true);
        setTimeout(() => {
          this.isOpen.set(false);
          this.closed.emit();
        }, 2000);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.error?.error || 'Failed to submit feedback');
      }
    });
  }
}
