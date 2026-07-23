import { Component, signal, OnInit, inject, output, Input, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  sender_name: string;
  receiver_name: string;
}

interface ChatUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: string;
  is_online: boolean;
}

@Component({
  selector: 'app-chat-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/30 z-40 transition-opacity" (click)="close.emit()"></div>

    <!-- Panel - positioned right side -->
    <div class="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out"
      [style.transform]="showModal() ? 'translateX(0)' : 'translateX(100%)'">

        <!-- Header -->
        <div class="bg-gradient-to-r from-blue-500 to-blue-600 p-4 flex items-center gap-3 flex-shrink-0">
          <div class="relative">
            @if (chatUser()?.avatar) {
              <img [src]="chatUser()?.avatar" [alt]="chatUser()?.name"
                class="w-10 h-10 rounded-full border-2 border-white object-cover" />
            } @else {
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                [class]="getAvatarColor(chatUser()?.name || '')">
                {{ chatUser()?.name?.charAt(0) || '?' }}
              </div>
            }
            <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
              [class]="chatUser()?.is_online ? 'bg-green-400' : 'bg-gray-300'"></span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-white truncate">Chating with</p>
            <p class="text-xs text-blue-100 truncate">{{ chatUser()?.name }}</p>
          </div>
          <button (click)="close.emit()" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Messages -->
        <div #messageContainer class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          @if (messages().length === 0) {
            <div class="flex flex-col items-center justify-center h-full text-center">
              <div class="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p class="text-sm text-gray-500">You have no chat history with {{ chatUser()?.name }}.</p>
              <p class="text-xs text-gray-400 mt-1">Type a message below to start chatting.</p>
            </div>
          }

          @for (msg of messages(); track msg.id) {
            <div class="flex"
              [class.justify-end]="isMine(msg)"
              [class.justify-start]="!isMine(msg)">
              <div class="max-w-[75%] px-4 py-2.5 rounded-2xl"
                [class.bg-blue-600]="isMine(msg)"
                [class.text-white]="isMine(msg)"
                [class.rounded-br-md]="isMine(msg)"
                [class.bg-white]="!isMine(msg)"
                [class.text-gray-900]="!isMine(msg)"
                [class.border]="!isMine(msg)"
                [class.border-gray-200]="!isMine(msg)"
                [class.rounded-bl-md]="!isMine(msg)"
                [class.shadow-sm]="!isMine(msg)">
                <p class="text-sm leading-relaxed">{{ msg.message }}</p>
                <p class="text-[10px] mt-1"
                  [class]="isMine(msg) ? 'text-blue-200' : 'text-gray-400'">
                  {{ formatTime(msg.created_at) }}
                </p>
              </div>
            </div>
          }
        </div>

        <!-- Input -->
        <div class="p-3 border-t border-gray-200 bg-white flex-shrink-0">
          <div class="flex items-center gap-2">
            <input type="text" [value]="newMessage()" (input)="newMessage.set($any($event.target).value)"
              (keydown.enter)="sendMessage()"
              class="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Type your message..." />
            <button (click)="sendMessage()" [disabled]="!newMessage().trim()"
              class="w-10 h-10 rounded-full bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
  `,
})
export class ChatModalComponent implements OnInit, AfterViewChecked {
  @ViewChild('messageContainer') messageContainer!: ElementRef;

  private http = inject(HttpClient);
  private auth = inject(AuthService);

  @Input() chatUser = signal<ChatUser | null>(null);
  close = output<void>();

  protected readonly showModal = signal(true);
  protected readonly messages = signal<Message[]>([]);
  protected readonly newMessage = signal('');
  protected readonly currentUserId = signal(0);
  private refreshInterval: any;
  private shouldScroll = false;

  ngOnInit() {
    const user = this.auth.user();
    if (user) this.currentUserId.set(Number(user.id));
    this.loadMessages();
    this.refreshInterval = setInterval(() => this.loadMessages(), 3000);
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  loadMessages() {
    const user = this.chatUser();
    if (!user) return;

    this.http.get<{ messages: Message[] }>(`${environment.apiUrl}/messages/conversation/${user.id}`).subscribe({
      next: (res) => {
        const prevCount = this.messages().length;
        this.messages.set(res.messages);
        if (res.messages.length > prevCount) {
          this.shouldScroll = true;
        }
      },
    });
  }

  sendMessage() {
    const text = this.newMessage().trim();
    const user = this.chatUser();
    if (!text || !user) return;

    this.http.post(`${environment.apiUrl}/messages/send`, {
      receiverId: user.id,
      message: text,
    }).subscribe({
      next: () => {
        this.newMessage.set('');
        this.loadMessages();
        this.shouldScroll = true;
      },
    });
  }

  scrollToBottom() {
    if (this.messageContainer?.nativeElement) {
      const el = this.messageContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-KE', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  getAvatarColor(name: string): string {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500'];
    const idx = name.charCodeAt(0) % colors.length;
    return colors[idx];
  }

  isMine(msg: Message): boolean {
    return Number(msg.sender_id) === this.currentUserId();
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }
}
