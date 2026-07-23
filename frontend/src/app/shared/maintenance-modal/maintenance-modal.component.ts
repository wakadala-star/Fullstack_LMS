import { Component } from '@angular/core';
import { ServerStatusService } from '../../core/services/server-status.service';

@Component({
  selector: 'app-maintenance-modal',
  standalone: true,
  template: `
    @if (serverStatus.isServerDown()) {
      <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center">
          <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg class="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">Server Under Maintenance</h2>
          <p class="text-gray-500 mb-6">
            The backend server is currently unavailable. We're automatically trying to reconnect.
          </p>
          <div class="flex items-center justify-center gap-2 text-sm text-gray-400">
            <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Attempting to reconnect...</span>
          </div>
        </div>
      </div>
    }
  `,
})
export class MaintenanceModalComponent {
  constructor(public serverStatus: ServerStatusService) {}
}
