import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Agora SDK types (loaded via script tag or npm package)
declare const AgoraRTC: any;

export interface AgoraUser {
  uid: number;
  audioTrack: any;
  videoTrack: any;
  hasAudio: boolean;
  hasVideo: boolean;
}

@Injectable({ providedIn: 'root' })
export class AgoraService implements OnDestroy {
  private client: any = null;
  private localAudioTrack: any = null;
  private localVideoTrack: any = null;
  private remoteUsers: Map<number, AgoraUser> = new Map();
  private joined = false;

  onUserPublished: ((user: AgoraUser) => void) | null = null;
  onUserUnpublished: ((uid: number) => void) | null = null;
  onUserJoined: ((uid: number) => void) | null = null;
  onUserLeft: ((uid: number) => void) | null = null;

  constructor(private http: HttpClient) {}

  private getAgoraSDK(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (typeof AgoraRTC !== 'undefined') {
        resolve(AgoraRTC);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://download.agora.io/sdk/release/AgoraRTC_N.js';
      script.onload = () => resolve((window as any).AgoraRTC);
      script.onerror = () => reject(new Error('Failed to load Agora SDK'));
      document.head.appendChild(script);
    });
  }

  async joinChannel(channelName: string, classType: 'audio' | 'video'): Promise<void> {
    const AgoraSDK = await this.getAgoraSDK();

    // Get token from backend
    const tokenRes: any = await this.http.post(`${environment.apiUrl}/agora/token`, {
      channelName,
      uid: 0,
    }).toPromise();

    if (!tokenRes.token) {
      throw new Error('Failed to get Agora token. Check server configuration.');
    }

    // Create client
    this.client = AgoraSDK.createClient({ mode: 'rtc', codec: 'vp8' });

    // Set up event handlers
    this.client.on('user-published', async (user: any, mediaType: string) => {
      try {
        await this.client.subscribe(user, mediaType);
      } catch (e) {
        console.warn('Subscribe failed for', user.uid, mediaType, e);
        return;
      }

      if (mediaType === 'audio' && user.audioTrack) {
        user.audioTrack.play();
      }

      const existingUser = this.remoteUsers.get(user.uid) || {
        uid: user.uid,
        audioTrack: null,
        videoTrack: null,
        hasAudio: false,
        hasVideo: false,
      };

      if (mediaType === 'audio') {
        existingUser.audioTrack = user.audioTrack;
        existingUser.hasAudio = true;
      }
      if (mediaType === 'video') {
        existingUser.videoTrack = user.videoTrack;
        existingUser.hasVideo = true;
      }

      this.remoteUsers.set(user.uid, existingUser);
      this.onUserPublished?.(existingUser);
    });

    this.client.on('user-unpublished', (user: any, mediaType: string) => {
      const existingUser = this.remoteUsers.get(user.uid);
      if (existingUser) {
        if (mediaType === 'audio') {
          existingUser.hasAudio = false;
          existingUser.audioTrack = null;
        }
        if (mediaType === 'video') {
          existingUser.hasVideo = false;
          existingUser.videoTrack = null;
        }
        if (!existingUser.hasAudio && !existingUser.hasVideo) {
          this.remoteUsers.delete(user.uid);
        }
      }
      this.onUserUnpublished?.(user.uid);
    });

    this.client.on('user-joined', (user: any) => {
      this.onUserJoined?.(user.uid);
    });

    this.client.on('user-left', (user: any) => {
      this.remoteUsers.delete(user.uid);
      this.onUserLeft?.(user.uid);
    });

    // Join channel
    await this.client.join(tokenRes.appId, channelName, tokenRes.token, null);

    // Subscribe to existing remote users already in the channel
    const existingUsers = this.client.remoteUsers;
    for (const user of existingUsers) {
      try {
        if (user.audioTrack) {
          await this.client.subscribe(user, 'audio');
          user.audioTrack.play();
        }
        if (user.videoTrack) {
          await this.client.subscribe(user, 'video');
        }
        this.remoteUsers.set(user.uid, {
          uid: user.uid,
          audioTrack: user.audioTrack || null,
          videoTrack: user.videoTrack || null,
          hasAudio: !!user.audioTrack,
          hasVideo: !!user.videoTrack,
        });
        this.onUserPublished?.(this.remoteUsers.get(user.uid)!);
      } catch (e) {
        console.warn('Failed to subscribe to existing user:', user.uid, e);
      }
    }

    // Create local tracks
    this.localAudioTrack = await AgoraSDK.createMicrophoneAudioTrack();

    if (classType === 'video') {
      this.localVideoTrack = await AgoraSDK.createCameraVideoTrack();
      await this.client.publish([this.localAudioTrack, this.localVideoTrack]);
    } else {
      await this.client.publish([this.localAudioTrack]);
    }

    this.joined = true;
  }

  async leaveChannel(): Promise<void> {
    if (this.localAudioTrack) {
      this.localAudioTrack.close();
      this.localAudioTrack = null;
    }
    if (this.localVideoTrack) {
      this.localVideoTrack.close();
      this.localVideoTrack = null;
    }
    if (this.client) {
      await this.client.leave();
      this.client = null;
    }
    this.remoteUsers.clear();
    this.joined = false;
  }

  async toggleMic(): Promise<boolean> {
    if (!this.localAudioTrack) return false;
    const muted = this.localAudioTrack.getMuted();
    await this.localAudioTrack.setMuted(!muted);
    return !muted;
  }

  async toggleCamera(): Promise<boolean> {
    if (!this.localVideoTrack) return false;
    const muted = this.localVideoTrack.getMuted();
    await this.localVideoTrack.setMuted(!muted);
    return !muted;
  }

  async startScreenShare(): Promise<any> {
    const AgoraSDK = await this.getAgoraSDK();
    const screenTrack = await AgoraSDK.createScreenVideoTrack();
    if (this.localVideoTrack) {
      await this.client.unpublish(this.localVideoTrack);
      this.localVideoTrack.close();
    }
    this.localVideoTrack = screenTrack;
    await this.client.publish(screenTrack);
    screenTrack.on('track-ended', () => this.stopScreenShare());
    return screenTrack;
  }

  async stopScreenShare(): Promise<void> {
    if (this.localVideoTrack) {
      this.localVideoTrack.close();
    }
    const AgoraSDK = await this.getAgoraSDK();
    this.localVideoTrack = await AgoraSDK.createCameraVideoTrack();
    await this.client.publish(this.localVideoTrack);
    return this.localVideoTrack;
  }

  getLocalVideoTrack(): any {
    return this.localVideoTrack;
  }

  getRemoteUsers(): AgoraUser[] {
    return Array.from(this.remoteUsers.values());
  }

  isJoined(): boolean {
    return this.joined;
  }

  ngOnDestroy() {
    this.leaveChannel();
  }
}
