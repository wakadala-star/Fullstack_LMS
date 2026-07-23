import { Component, signal, OnInit, inject, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AgoraService } from '../../../core/services/agora.service';
import { environment } from '../../../../environments/environment';

interface Classroom {
  id: number;
  teacher_id: number;
  title: string;
  class_type: string;
  join_code: string;
  status: string;
  started_at: string | null;
  teacher_name: string;
}

interface Participant {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: string;
  is_muted: boolean;
  is_suspended: boolean;
  can_share_screen: boolean;
  left_at: string | null;
}

@Component({
  selector: 'app-student-classroom',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <!-- LOBBY VIEW -->
      @if (view() === 'lobby') {
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Classroom</h1>
          <p class="mt-1 text-sm text-gray-500">Join a live class session</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button (click)="selectType('audio')"
            class="group p-6 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all text-left">
            <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900">Audio Class</h3>
            <p class="mt-1 text-sm text-gray-500">Join a voice-only live session</p>
          </button>

          <button (click)="selectType('video')"
            class="group p-6 bg-white rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all text-left">
            <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
              <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900">Video Class</h3>
            <p class="mt-1 text-sm text-gray-500">Join a full video live session</p>
          </button>
        </div>
      }

      <!-- ENTER CODE VIEW -->
      @if (view() === 'enter-code') {
        <div class="max-w-md mx-auto">
          <button (click)="goBack()" class="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center"
                [class]="selectedType() === 'audio' ? 'bg-blue-100' : 'bg-purple-100'">
                @if (selectedType() === 'audio') {
                  <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                } @else {
                  <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                }
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900">Join {{ selectedType() === 'audio' ? 'Audio' : 'Video' }} Class</h3>
                <p class="text-sm text-gray-500">Enter the join code from your teacher</p>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Join Code</label>
                <input type="text" [value]="joinCode()" (input)="joinCode.set($any($event.target).value.toUpperCase())"
                  class="w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-2xl font-mono font-bold tracking-widest focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="ENTER CODE" maxlength="8" />
              </div>

              @if (verifyError()) {
                <p class="text-sm text-red-600 text-center">{{ verifyError() }}</p>
              }

              <button (click)="verifyAndJoin()" [disabled]="joinCode().length < 4"
                class="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Verify & Join
              </button>
            </div>
          </div>
        </div>
      }

      <!-- CLASSROOM VIEW -->
      @if (view() === 'classroom' && activeClassroom()) {
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <button (click)="leaveClassroom()" class="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 class="text-lg font-semibold text-gray-900">{{ activeClassroom()!.title }}</h2>
                <p class="text-xs text-gray-500">{{ activeClassroom()!.class_type | titlecase }} Class &middot; by {{ activeClassroom()!.teacher_name }}</p>
              </div>
            </div>
            <span class="px-2.5 py-1 text-xs font-medium rounded-full"
              [class]="activeClassroom()!.status === 'live' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'">
              {{ activeClassroom()!.status === 'live' ? 'LIVE' : 'Waiting' }}
            </span>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <!-- Stage -->
            <div class="lg:col-span-2 bg-gray-900 rounded-xl aspect-video relative overflow-hidden">
              @if (activeClassroom()!.class_type === 'video' && isLive()) {
                <div #localVideo class="w-full h-full"></div>
              } @else if (isLive()) {
                <div class="w-full h-full flex items-center justify-center">
                  <div class="text-center">
                    <div class="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg class="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <p class="text-green-400 text-sm font-medium">Connected to class</p>
                  </div>
                </div>
              } @else {
                <div class="w-full h-full flex items-center justify-center">
                  <div class="text-center">
                    <div class="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                      <svg class="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p class="text-gray-400 text-sm">Waiting for class to start...</p>
                  </div>
                </div>
              }

              <!-- Bottom Controls -->
              <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <button (click)="toggleMic()"
                  class="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                  [class]="isMicOn() ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-red-600 text-white hover:bg-red-500'">
                  @if (isMicOn()) {
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  } @else {
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  }
                </button>

                @if (activeClassroom()!.class_type === 'video') {
                  <button (click)="toggleCamera()"
                    class="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                    [class]="isCameraOn() ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-red-600 text-white hover:bg-red-500'">
                    @if (isCameraOn()) {
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    } @else {
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    }
                  </button>
                }

                <button (click)="leaveClassroom()"
                  class="w-12 h-12 rounded-full bg-red-600 text-white hover:bg-red-500 flex items-center justify-center transition-colors">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Participants -->
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div class="p-4 border-b border-gray-100">
                <h3 class="text-sm font-semibold text-gray-900">In Session ({{ getLiveParticipants().length }})</h3>
              </div>
              <div class="max-h-96 overflow-y-auto divide-y divide-gray-50">
                @for (p of getLiveParticipants(); track p.id) {
                  <div class="p-3 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      [class]="p.role === 'teacher' ? 'bg-purple-100' : 'bg-blue-100'">
                      <span class="text-xs font-medium"
                        [class]="p.role === 'teacher' ? 'text-purple-700' : 'text-blue-700'">{{ p.name.charAt(0) }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 truncate">
                        {{ p.name }}
                        @if (p.role === 'teacher') {
                          <span class="text-[10px] text-purple-600 ml-1">(Teacher)</span>
                        }
                      </p>
                    </div>
                  </div>
                }
                @if (getLiveParticipants().length === 0) {
                  <div class="p-6 text-center text-sm text-gray-400">No one else in the session</div>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`.aspect-video { aspect-ratio: 16 / 9; }`]
})
export class StudentClassroomComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLDivElement>;

  private http = inject(HttpClient);
  private agora = inject(AgoraService);
  private refreshInterval: any;

  protected readonly view = signal<'lobby' | 'enter-code' | 'classroom'>('lobby');
  protected readonly selectedType = signal<'audio' | 'video'>('audio');
  protected readonly joinCode = signal('');
  protected readonly verifyError = signal('');
  protected readonly activeClassroom = signal<Classroom | null>(null);
  protected readonly participants = signal<Participant[]>([]);
  protected readonly isMicOn = signal(true);
  protected readonly isCameraOn = signal(true);
  protected readonly isLive = signal(false);

  ngOnInit() {
    this.setupAgoraCallbacks();
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.agora.leaveChannel();
  }

  setupAgoraCallbacks() {
    this.agora.onUserPublished = (user) => {
      this.participants.update(ps => {
        const existing = ps.find(p => p.user_id === user.uid);
        if (existing) return ps;
        return [...ps, {
          id: user.uid,
          user_id: user.uid,
          name: `User ${user.uid}`,
          email: '',
          role: 'teacher',
          joined_at: new Date().toISOString(),
          left_at: null,
          is_muted: false,
          is_suspended: false,
          can_share_screen: false,
        }];
      });
    };

    this.agora.onUserLeft = (uid) => {
      this.participants.update(ps => ps.filter(p => p.user_id !== uid));
    };
  }

  selectType(type: 'audio' | 'video') {
    this.selectedType.set(type);
    this.view.set('enter-code');
  }

  goBack() {
    this.view.set('lobby');
    this.joinCode.set('');
    this.verifyError.set('');
  }

  verifyAndJoin() {
    const code = this.joinCode().trim();
    if (!code) return;
    this.verifyError.set('');

    this.http.post<{ classroom: Classroom }>(`${environment.apiUrl}/classrooms/verify`, {
      joinCode: code,
    }).subscribe({
      next: (res) => {
        const classroom = res.classroom;
        if (classroom.class_type !== this.selectedType()) {
          this.verifyError.set(`This is a ${classroom.class_type} classroom. Please select the correct type.`);
          return;
        }
        this.joinRoom(classroom);
      },
      error: (err) => {
        this.verifyError.set(err.error?.error || 'Invalid join code');
      },
    });
  }

  joinRoom(classroom: Classroom) {
    this.http.post<{ classroom: Classroom }>(`${environment.apiUrl}/classrooms/${classroom.id}/join`, {}).subscribe({
      next: async (res) => {
        this.activeClassroom.set(res.classroom);
        this.view.set('classroom');
        this.loadParticipants(classroom.id);
        this.startAutoRefresh(classroom.id);

        // Join Agora channel if class is live
        if (res.classroom.status === 'live') {
          try {
            await this.agora.joinChannel(classroom.join_code, classroom.class_type as 'audio' | 'video');
            this.isLive.set(true);
            setTimeout(() => this.renderLocalVideo(), 500);
          } catch (err) {
            console.error('Failed to join Agora:', err);
          }
        }
      },
      error: (err) => {
        this.verifyError.set(err.error?.error || 'Failed to join classroom');
      },
    });
  }

  renderLocalVideo() {
    const track = this.agora.getLocalVideoTrack();
    if (track && this.localVideoRef?.nativeElement) {
      track.play(this.localVideoRef.nativeElement);
    }
  }

  loadParticipants(classroomId: number) {
    this.http.get<{ participants: Participant[] }>(`${environment.apiUrl}/classrooms/${classroomId}/participants`).subscribe({
      next: (res) => this.participants.set(res.participants),
    });
  }

  startAutoRefresh(classroomId: number) {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.refreshInterval = setInterval(() => {
      this.loadParticipants(classroomId);
      // Check if classroom status changed to live
      this.http.get<{ classroom: Classroom }>(`${environment.apiUrl}/classrooms/verify`, {
        params: { joinCode: this.activeClassroom()?.join_code || '' }
      }).subscribe({
        next: async (res) => {
          if (res.classroom && res.classroom.status === 'live' && !this.isLive()) {
            this.activeClassroom.set(res.classroom);
            try {
              await this.agora.joinChannel(res.classroom.join_code, res.classroom.class_type as 'audio' | 'video');
              this.isLive.set(true);
              setTimeout(() => this.renderLocalVideo(), 500);
            } catch (err) {
              console.error('Failed to join Agora:', err);
            }
          }
        },
        error: () => {}
      });
    }, 5000);
  }

  async toggleMic() {
    const isOn = await this.agora.toggleMic();
    this.isMicOn.set(isOn);
  }

  async toggleCamera() {
    const isOn = await this.agora.toggleCamera();
    this.isCameraOn.set(isOn);
  }

  async leaveClassroom() {
    await this.agora.leaveChannel();
    this.isLive.set(false);
    const room = this.activeClassroom();
    if (room) {
      this.http.post(`${environment.apiUrl}/classrooms/${room.id}/leave`, {}).subscribe();
    }
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.activeClassroom.set(null);
    this.participants.set([]);
    this.view.set('lobby');
    this.joinCode.set('');
  }

  getLiveParticipants(): Participant[] {
    return this.participants().filter(p => p.left_at === null);
  }
}
