import { Component, signal, OnInit, inject, output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

interface ChatUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: string;
  is_online: boolean;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

@Component({
  selector: 'app-live-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/30 z-40 transition-opacity" (click)="close.emit()"></div>

    <!-- Panel -->
    <div class="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out"
      [style.transform]="showPanel() ? 'translateX(0)' : 'translateX(100%)'">

      <!-- Header -->
      <div class="bg-gradient-to-r from-blue-500 to-blue-600 p-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 class="text-lg font-bold text-white">Live Chat</h2>
          <p class="text-xs text-blue-100">Staff & Admin</p>
        </div>
        <button (click)="close.emit()" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Search -->
      <div class="p-3 border-b border-gray-100 flex-shrink-0">
        <div class="relative">
          <input type="text" [value]="searchTerm()" (input)="searchTerm.set($any($event.target).value)"
            class="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Search user..." />
          <svg class="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <!-- User List -->
      <div class="flex-1 overflow-y-auto">
        @for (user of filteredUsers(); track user.id) {
          <div class="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center gap-3 cursor-pointer"
            (click)="openChat.emit(user)">
            <!-- Avatar -->
            <div class="relative flex-shrink-0">
              @if (user.avatar) {
                <img [src]="user.avatar" [alt]="user.name"
                  class="w-11 h-11 rounded-full border-2 border-white object-cover" />
              } @else {
                <div class="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  [class]="getAvatarColor(user.name)">
                  {{ user.name.charAt(0) }}
                </div>
              }
              <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white"
                [class]="user.is_online ? 'bg-green-500' : 'bg-gray-300'"></span>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <p class="text-sm font-semibold text-gray-900 truncate">{{ user.name }}</p>
                <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  [class]="user.is_online ? 'text-green-600' : 'text-gray-400'">
                  {{ user.is_online ? 'Online' : 'Offline' }}
                </span>
              </div>
              <div class="flex items-center justify-between mt-0.5">
                <p class="text-xs text-gray-400 truncate">
                  {{ user.last_message || 'No Chats yet.' }}
                </p>
                @if (user.unread_count > 0) {
                  <span class="ml-2 w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                    {{ user.unread_count > 9 ? '9+' : user.unread_count }}
                  </span>
                }
              </div>
            </div>
          </div>
        }

        @if (filteredUsers().length === 0) {
          <div class="p-8 text-center text-sm text-gray-400">No users found</div>
        }
      </div>
    </div>
  `,
})
export class LiveChatPanelComponent implements OnInit {
  private http = inject(HttpClient);

  close = output<void>();
  openChat = output<ChatUser>();

  protected readonly showPanel = signal(true);
  protected readonly users = signal<ChatUser[]>([]);
  protected readonly searchTerm = signal('');

  protected readonly filteredUsers = signal<ChatUser[]>([]);

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.http.get<{ users: ChatUser[] }>(`${environment.apiUrl}/messages/users`).subscribe({
      next: (res) => {
        this.users.set(res.users);
        this.applySearch();
      },
    });
  }

  applySearch() {
    const term = this.searchTerm().toLowerCase();
    if (!term) {
      this.filteredUsers.set(this.users());
      return;
    }
    this.filteredUsers.set(
      this.users().filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
    );
  }

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.applySearch();
  }

  getAvatarColor(name: string): string {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-red-500', 'bg-cyan-500'];
    const idx = name.charCodeAt(0) % colors.length;
    return colors[idx];
  }
}
