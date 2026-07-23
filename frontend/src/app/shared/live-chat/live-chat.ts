import { Component, signal, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { OnlineUsersBarComponent } from './online-users-bar';
import { LiveChatPanelComponent } from './live-chat-panel';
import { ChatModalComponent } from './chat-modal';
import { environment } from '../../../environments/environment';

interface ChatUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: string;
  is_online: boolean;
}

@Component({
  selector: 'app-live-chat',
  standalone: true,
  imports: [CommonModule, OnlineUsersBarComponent, LiveChatPanelComponent, ChatModalComponent],
  template: `
    <!-- Online Users Bar -->
    <div class="px-3 pb-3">
      <app-online-users-bar (togglePanel)="showPanel.set(true)" />
    </div>

    <!-- Live Chat Side Panel -->
    @if (showPanel()) {
      <app-live-chat-panel
        (close)="showPanel.set(false)"
        (openChat)="openChat($event)" />
    }

    <!-- Chat Modal -->
    @if (showChat() && selectedUser()) {
      <app-chat-modal
        [chatUser]="selectedUser"
        (close)="showChat.set(false)" />
    }
  `,
})
export class LiveChatComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private heartbeatInterval: any;
  private unreadInterval: any;

  protected readonly showPanel = signal(false);
  protected readonly showChat = signal(false);
  protected readonly selectedUser = signal<ChatUser | null>(null);
  protected readonly unreadCount = signal(0);

  ngOnInit() {
    this.sendHeartbeat();
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), 30000);
    this.loadUnreadCount();
    this.unreadInterval = setInterval(() => this.loadUnreadCount(), 10000);
  }

  ngOnDestroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.unreadInterval) clearInterval(this.unreadInterval);
  }

  sendHeartbeat() {
    if (!this.auth.isLoggedIn()) return;
    this.http.post(`${environment.apiUrl}/messages/heartbeat`, {}).subscribe({
      error: () => {},
    });
  }

  loadUnreadCount() {
    if (!this.auth.isLoggedIn()) return;
    this.http.get<{ count: number }>(`${environment.apiUrl}/messages/unread-count`).subscribe({
      next: (res) => this.unreadCount.set(res.count),
      error: () => {},
    });
  }

  openChat(user: ChatUser) {
    this.selectedUser.set(user);
    this.showChat.set(true);
    this.showPanel.set(false);
  }
}
