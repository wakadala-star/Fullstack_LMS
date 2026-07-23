import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" (click)="onCancel()">
      <div class="bg-white rounded-2xl w-full max-w-sm shadow-2xl" (click)="$event.stopPropagation()">
        <div class="p-6 text-center">
          <div class="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
            [class.bg-red-100]="variant() === 'danger'"
            [class.bg-yellow-100]="variant() === 'warning'"
            [class.bg-blue-100]="variant() === 'info'">
            @if (variant() === 'danger') {
              <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            }
            @if (variant() === 'warning') {
              <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            }
            @if (variant() === 'info') {
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          </div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ title() }}</h3>
          <p class="text-sm text-gray-500 mb-6">{{ message() }}</p>
          <div class="flex items-center gap-3 justify-center">
            <button (click)="onCancel()"
              class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              {{ cancelText() }}
            </button>
            <button (click)="onConfirm()"
              class="px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors"
              [class.bg-red-600]="variant() === 'danger'"
              [class.hover:bg-red-700]="variant() === 'danger'"
              [class.bg-yellow-600]="variant() === 'warning'"
              [class.hover:bg-yellow-700]="variant() === 'warning'"
              [class.bg-blue-600]="variant() === 'info'"
              [class.hover:bg-blue-700]="variant() === 'info'">
              {{ confirmText() }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ConfirmDialogComponent {
  title = input('Are you sure?');
  message = input('');
  confirmText = input('Delete');
  cancelText = input('Cancel');
  variant = input<'danger' | 'warning' | 'info'>('danger');

  confirmed = output<void>();
  cancelled = output<void>();

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
