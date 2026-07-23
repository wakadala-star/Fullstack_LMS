import { Component, OnInit, OnDestroy, signal, computed, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: string;
  is_online: boolean;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`:host { display: block; height: 100%; overflow: hidden; }`],
  template: `
    <div class="h-full bg-gray-50 p-6 flex flex-col overflow-hidden">
      <div class="flex items-center justify-between mb-4 shrink-0">
        <h1 class="text-2xl font-bold text-gray-800">Messages</h1>
        <div class="flex items-center gap-2 text-sm text-gray-500">
          <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          {{ onlineCount() }} online
        </div>
      </div>

      <div class="flex flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <!-- Left: Staff List -->
        <div class="w-80 border-r border-gray-200 flex flex-col shrink-0">
          <div class="p-3 border-b border-gray-200 shrink-0">
            <input type="text" placeholder="Search staff..."
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              class="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div class="flex-1 overflow-y-auto">
            @for (staff of filteredStaff(); track staff.id) {
              <div (click)="selectStaff(staff)"
                class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-blue-50 transition border-b border-gray-100"
                [class.bg-blue-50]="selectedStaff()?.id === staff.id"
                [class.border-l-2]="selectedStaff()?.id === staff.id"
                [class.border-l-blue-500]="selectedStaff()?.id === staff.id">
                <div class="relative flex-shrink-0">
                  @if (staff.avatar) {
                    <img [src]="staff.avatar" [alt]="staff.name"
                      class="w-10 h-10 rounded-full object-cover" />
                  } @else {
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                      [class.bg-blue-500]="staff.role === 'admin'"
                      [class.bg-green-500]="staff.role === 'teacher'">
                      {{ getInitials(staff.name) }}
                    </div>
                  }
                  @if (staff.is_online) {
                    <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                  }
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-sm text-gray-800 truncate">{{ staff.name }}</span>
                    @if (staff.last_message_at) {
                      <span class="text-[10px] text-gray-400 flex-shrink-0 ml-2">{{ formatTime(staff.last_message_at) }}</span>
                    }
                  </div>
                  <div class="flex items-center justify-between mt-0.5">
                    @if (staff.last_message) {
                      <p class="text-xs text-gray-500 truncate">{{ staff.last_message }}</p>
                    } @else {
                      <p class="text-xs text-gray-400 italic">No messages yet</p>
                    }
                    @if (staff.unread_count > 0) {
                      <span class="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0">
                        {{ staff.unread_count }}
                      </span>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Right: Conversation -->
        <div class="flex-1 flex flex-col min-w-0">
          @if (selectedStaff()) {
            <div class="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white shrink-0">
              <div class="relative">
                @if (selectedStaff()!.avatar) {
                  <img [src]="selectedStaff()!.avatar" [alt]="selectedStaff()!.name"
                    class="w-10 h-10 rounded-full object-cover" />
                } @else {
                  <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    [class.bg-blue-500]="selectedStaff()!.role === 'admin'"
                    [class.bg-green-500]="selectedStaff()!.role === 'teacher'">
                    {{ getInitials(selectedStaff()!.name) }}
                  </div>
                }
                @if (selectedStaff()!.is_online) {
                  <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                }
              </div>
              <div>
                <h3 class="font-semibold text-gray-800">{{ selectedStaff()!.name }}</h3>
                <p class="text-xs text-gray-400">
                  {{ selectedStaff()!.is_online ? 'Online' : 'Offline' }}
                  · {{ selectedStaff()!.role | titlecase }}
                </p>
              </div>
            </div>

            <div #messageList class="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-gray-50">
              @if (messages().length === 0) {
                <div class="flex items-center justify-center h-full text-gray-400">
                  <div class="text-center">
                    <p class="text-sm">No messages yet</p>
                    <p class="text-xs mt-1">Send a message to start the conversation</p>
                  </div>
                </div>
              }
              @for (msg of messages(); track msg.id) {
                <div class="flex" [class.justify-end]="isMine(msg)">
                  <div class="max-w-xs lg:max-w-md">
                    <div class="px-4 py-2.5 rounded-2xl text-sm shadow-sm"
                      [class.bg-blue-500]="isMine(msg)"
                      [class.text-white]="isMine(msg)"
                      [class.bg-white]="!isMine(msg)"
                      [class.text-gray-800]="!isMine(msg)"
                      [class.border]="!isMine(msg)"
                      [class.border-gray-200]="!isMine(msg)">
                      {{ msg.message }}
                    </div>
                    <p class="text-[10px] mt-1 px-1"
                      [class.text-right]="isMine(msg)"
                      class="text-gray-400">
                      {{ formatTime(msg.created_at) }}
                    </p>
                  </div>
                </div>
              }
            </div>

            <div class="px-6 py-4 border-t border-gray-200 bg-white shrink-0">
              <div class="flex items-center gap-3">
                <input type="text" [(ngModel)]="newMessage" (keyup.enter)="sendMessage()"
                  placeholder="Type a message..."
                  class="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <button (click)="sendMessage()" [disabled]="!newMessage.trim()"
                  class="bg-blue-500 hover:bg-blue-600 text-white p-2.5 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                  </svg>
                </button>
              </div>
            </div>
          } @else {
            <div class="flex-1 flex items-center justify-center text-gray-400">
              <div class="text-center">
                <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
                <p class="text-lg font-medium">Select a staff member</p>
                <p class="text-sm mt-1">Choose someone from the list to start chatting</p>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class MessagesComponent implements OnInit, OnDestroy {
  @ViewChild('messageList') messageList!: ElementRef;

  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private pollInterval: any;

  staffList = signal<StaffUser[]>([]);
  messages = signal<Message[]>([]);
  selectedStaff = signal<StaffUser | null>(null);
  newMessage = '';
  searchQuery = signal('');
  currentUserId = 0;

  filteredStaff = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.staffList().filter(s =>
      s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  });

  onlineCount = computed(() => this.staffList().filter(s => s.is_online).length);

  ngOnInit() {
    const user = this.auth.user();
    this.currentUserId = Number(user?.id) || 0;
    this.loadStaff();
    this.pollInterval = setInterval(() => {
      this.loadStaff();
      if (this.selectedStaff()) {
        this.loadMessages(this.selectedStaff()!.id);
      }
    }, 5000);
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  loadStaff() {
    this.http.get<{ users: any[] }>(`${environment.apiUrl}/messages/users`)
      .subscribe({
        next: (res) => {
          const staff = res.users.map((u: any) => ({
            id: Number(u.id),
            name: u.name,
            email: u.email,
            role: u.role,
            avatar: u.avatar || '',
            is_online: u.is_online,
            last_message: u.last_message || '',
            last_message_at: u.last_message_at || '',
            unread_count: Number(u.unread_count) || 0,
          }));
          this.staffList.set(staff);
        },
        error: () => {}
      });
  }

  selectStaff(staff: StaffUser) {
    this.selectedStaff.set(staff);
    this.loadMessages(staff.id);
    // Refresh list to clear unread
    setTimeout(() => this.loadStaff(), 300);
  }

  loadMessages(userId: number) {
    this.http.get<{ messages: Message[] }>(`${environment.apiUrl}/messages/conversation/${userId}`)
      .subscribe({
        next: (res) => {
          this.messages.set(res.messages);
          this.scrollToBottom();
        },
        error: () => {}
      });
  }

  sendMessage() {
    const staff = this.selectedStaff();
    if (!staff || !this.newMessage.trim()) return;

    const msgText = this.newMessage.trim();
    this.newMessage = '';

    this.http.post(`${environment.apiUrl}/messages/send`, {
      receiverId: staff.id,
      message: msgText
    }).subscribe({
      next: () => {
        this.loadMessages(staff.id);
        this.loadStaff();
      },
      error: () => { this.newMessage = msgText; }
    });
  }

  isMine(msg: Message): boolean {
    return Number(msg.sender_id) === this.currentUserId;
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHrs < 24) return `${diffHrs}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.messageList?.nativeElement) {
        const el = this.messageList.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 100);
  }
}