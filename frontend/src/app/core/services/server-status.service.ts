import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ServerStatusService {
  readonly isServerDown = signal(false);
  private checkInterval: any;
  private readonly CHECK_INTERVAL = 5000;

  constructor(private http: HttpClient) {}

  markDown() {
    if (this.isServerDown()) return;
    this.isServerDown.set(true);
    this.startReconnectLoop();
  }

  markUp() {
    this.isServerDown.set(false);
    this.stopReconnectLoop();
  }

  private startReconnectLoop() {
    this.stopReconnectLoop();
    this.checkInterval = setInterval(() => this.ping(), this.CHECK_INTERVAL);
  }

  private stopReconnectLoop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private ping() {
    this.http.get(`${environment.apiUrl}/health`, { timeout: 3000 }).subscribe({
      next: () => this.markUp(),
      error: () => {}
    });
  }
}
