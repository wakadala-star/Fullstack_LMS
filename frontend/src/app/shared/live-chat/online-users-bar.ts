import { Component, signal, OnInit, OnDestroy, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-online-users-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button (click)="togglePanel.emit()"
      class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 hover:from-green-100 hover:to-emerald-100 transition-all group">
      <div class="flex -space-x-2">
        @for (user of onlineUsers().slice(0, 4); track user.id) {
          @if (user.avatar) {
            <img [src]="user.avatar" [alt]="user.name"
              class="w-7 h-7 rounded-full border-2 border-white object-cover flex-shrink-0" />
          } @else {
            <div class="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              [class]="getAvatarColor(user.name)">
              {{ user.name.charAt(0) }}
            </div>
          }
        }
      </div>
      <span class="text-xs font-semibold text-green-700 group-hover:text-green-800">
        {{ onlineCount() }} users online!
      </span>
    </button>
  `,
})
export class OnlineUsersBarComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private interval: any;

  togglePanel = output<void>();

  protected readonly onlineUsers = signal<any[]>([]);
  protected readonly onlineCount = signal(0);

  ngOnInit() {
    this.loadOnline();
    this.interval = setInterval(() => this.loadOnline(), 10000);
  }

  ngOnDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  loadOnline() {
    this.http.get<{ online: any[]; count: number }>(`${environment.apiUrl}/messages/online`).subscribe({
      next: (res) => {
        this.onlineUsers.set(res.online);
        this.onlineCount.set(res.count);
      },
    });
  }

  getAvatarColor(name: string): string {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500'];
    const idx = name.charCodeAt(0) % colors.length;
    return colors[idx];
  }
}
