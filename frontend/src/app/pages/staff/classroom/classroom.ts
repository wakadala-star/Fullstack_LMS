import { Component, signal, OnInit, inject, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog';
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
  ended_at: string | null;
  attendance_confirmed: boolean;
  participant_count?: number;
}

interface Participant {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: string;
  joined_at: string;
  left_at: string | null;
  is_muted: boolean;
  is_suspended: boolean;
  can_share_screen: boolean;
}

@Component({
  selector: 'app-staff-classroom',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  templateUrl: './classroom.html',
  styleUrls: ['./classroom.css'],
})
export class StaffClassroomComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLDivElement>;

  private http = inject(HttpClient);
  private agora = inject(AgoraService);
  private refreshInterval: any;

  protected readonly view = signal<'lobby' | 'create' | 'classroom' | 'history'>('lobby');
  protected readonly classType = signal<'audio' | 'video'>('audio');
  protected readonly classrooms = signal<Classroom[]>([]);
  protected readonly activeClassroom = signal<Classroom | null>(null);
  protected readonly participants = signal<Participant[]>([]);
  protected readonly newTitle = signal('');
  protected readonly isMicOn = signal(true);
  protected readonly isCameraOn = signal(true);
  protected readonly isScreenSharing = signal(false);
  protected readonly showEndConfirm = signal(false);
  protected readonly showAttendanceConfirm = signal(false);
  protected readonly copiedCode = signal(false);
  protected readonly isLive = signal(false);

  ngOnInit() {
    this.loadClassrooms();
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
          role: 'student',
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

  loadClassrooms() {
    this.http.get<{ classrooms: Classroom[] }>(`${environment.apiUrl}/classrooms/my-classrooms`).subscribe({
      next: (res) => this.classrooms.set(res.classrooms),
    });
  }

  selectType(type: 'audio' | 'video') {
    this.classType.set(type);
    this.view.set('create');
  }

  createClassroom() {
    if (!this.newTitle()) return;
    this.http.post<{ classroom: Classroom }>(`${environment.apiUrl}/classrooms`, {
      title: this.newTitle(),
      classType: this.classType(),
    }).subscribe({
      next: (res) => {
        this.activeClassroom.set(res.classroom);
        this.view.set('classroom');
        this.loadParticipants(res.classroom.id);
        this.startAutoRefresh(res.classroom.id);
        this.loadClassrooms();
      },
    });
  }

  async startClassroom() {
    const room = this.activeClassroom();
    if (!room) return;

    this.http.patch<{ classroom: Classroom }>(`${environment.apiUrl}/classrooms/${room.id}/start`, {}).subscribe({
      next: async (res) => {
        this.activeClassroom.set(res.classroom);
        // Join Agora channel
        try {
          await this.agora.joinChannel(room.join_code, room.class_type as 'audio' | 'video');
          this.isLive.set(true);
          // Render local video
          setTimeout(() => this.renderLocalVideo(), 500);
        } catch (err) {
          console.error('Failed to join Agora channel:', err);
        }
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
      this.http.get<{ classroom: Classroom }>(`${environment.apiUrl}/classrooms/verify`, {
        params: { joinCode: this.activeClassroom()?.join_code || '' }
      }).subscribe({
        next: (res) => {
          if (res.classroom) this.activeClassroom.set(res.classroom);
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

  async toggleScreenShare() {
    if (this.isScreenSharing()) {
      await this.agora.stopScreenShare();
      this.isScreenSharing.set(false);
    } else {
      await this.agora.startScreenShare();
      this.isScreenSharing.set(true);
    }
  }

  toggleMute(participant: Participant) {
    this.http.patch(`${environment.apiUrl}/classrooms/${this.activeClassroom()?.id}/participants/${participant.id}/mute`, {
      isMuted: !participant.is_muted,
    }).subscribe({
      next: () => this.loadParticipants(this.activeClassroom()!.id),
    });
  }

  toggleSuspend(participant: Participant) {
    this.http.patch(`${environment.apiUrl}/classrooms/${this.activeClassroom()?.id}/participants/${participant.id}/suspend`, {
      isSuspended: !participant.is_suspended,
    }).subscribe({
      next: () => this.loadParticipants(this.activeClassroom()!.id),
    });
  }

  toggleScreenSharePermission(participant: Participant) {
    this.http.patch(`${environment.apiUrl}/classrooms/${this.activeClassroom()?.id}/participants/${participant.id}/screen-share`, {
      canShareScreen: !participant.can_share_screen,
    }).subscribe({
      next: () => this.loadParticipants(this.activeClassroom()!.id),
    });
  }

  confirmAttendance() {
    this.showAttendanceConfirm.set(true);
  }

  doConfirmAttendance() {
    const room = this.activeClassroom();
    if (!room) return;
    this.http.patch(`${environment.apiUrl}/classrooms/${room.id}/confirm-attendance`, {}).subscribe({
      next: (res: any) => {
        this.activeClassroom.set(res.classroom);
        this.showAttendanceConfirm.set(false);
      },
    });
  }

  endClassroom() {
    this.showEndConfirm.set(true);
  }

  async doEndClassroom() {
    const room = this.activeClassroom();
    if (!room) return;
    await this.agora.leaveChannel();
    this.isLive.set(false);
    this.http.patch<{ classroom: Classroom }>(`${environment.apiUrl}/classrooms/${room.id}/end`, {}).subscribe({
      next: () => {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.activeClassroom.set(null);
        this.participants.set([]);
        this.view.set('lobby');
        this.showEndConfirm.set(false);
        this.loadClassrooms();
      },
    });
  }

  copyJoinCode() {
    const code = this.activeClassroom()?.join_code;
    if (code) {
      navigator.clipboard.writeText(code);
      this.copiedCode.set(true);
      setTimeout(() => this.copiedCode.set(false), 2000);
    }
  }

  rejoinClassroom(classroom: Classroom) {
    this.activeClassroom.set(classroom);
    this.classType.set(classroom.class_type as 'audio' | 'video');
    this.view.set('classroom');
    this.loadParticipants(classroom.id);
    this.startAutoRefresh(classroom.id);
    if (classroom.status === 'live') {
      this.agora.joinChannel(classroom.join_code, classroom.class_type as 'audio' | 'video').then(() => {
        this.isLive.set(true);
        setTimeout(() => this.renderLocalVideo(), 500);
      });
    }
  }

  goBack() {
    this.agora.leaveChannel();
    this.isLive.set(false);
    this.view.set('lobby');
    this.activeClassroom.set(null);
    this.participants.set([]);
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  getLiveParticipants(): Participant[] {
    return this.participants().filter(p => p.role === 'student' && p.left_at === null);
  }
}
