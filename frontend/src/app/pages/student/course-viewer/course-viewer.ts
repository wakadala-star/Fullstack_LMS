import { Component, signal, OnInit, AfterViewChecked, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Course, CourseMaterial } from '../../../core/models/user.model';
import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-course-viewer',
  standalone: true,
  imports: [ConfirmDialogComponent],
  template: `
    <div class="space-y-6">
      <div class="flex items-center gap-3">
        <button (click)="goBack()" class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{{ course()?.name || 'Loading...' }}</h1>
          <p class="text-gray-500 text-sm">{{ course()?.code }} &middot; {{ course()?.instructor }}</p>
        </div>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center py-20">
          <svg class="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      } @else if (errorMessage()) {
        <div class="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-6V9a4 4 0 00-8 0v2h8z" />
          </svg>
          <p class="text-gray-900 font-semibold mb-2">Access Denied</p>
          <p class="text-gray-500 text-sm">{{ errorMessage() }}</p>
          <button (click)="goBack()" class="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            Back to Courses
          </button>
        </div>
      } @else if (course()) {
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <p class="text-gray-600">{{ course()?.description }}</p>
          <div class="flex items-center gap-4 mt-4 text-sm text-gray-500">
            <span class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              {{ course()?.schedule }}
            </span>
            <span>{{ course()?.credits }} credits</span>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-gray-200">
          <div class="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Course Materials</h2>
              <p class="text-sm text-gray-500 mt-1">{{ materials().length }} items</p>
            </div>
            @if (isTeacher()) {
              <button (click)="openUploadModal()"
                class="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 transition-colors">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Upload Materials
              </button>
            }
          </div>

          @if (materials().length === 0) {
            <div class="p-12 text-center">
              <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p class="text-gray-500 font-medium">No materials uploaded yet</p>
              <p class="text-sm text-gray-400 mt-1">Your instructor will add content soon</p>
            </div>
          } @else {
            <div class="divide-y divide-gray-100">
              @for (material of materials(); track material.name; let i = $index) {
                <div class="p-5 hover:bg-gray-50 transition-colors">
                  <!-- PDF -->
                  @if (material.type === 'application/pdf') {
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">{{ material.name }}</p>
                        <p class="text-xs text-gray-500">{{ material.size }}</p>
                      </div>
                      <div class="flex items-center gap-2 flex-shrink-0">
                        <button (click)="toggleViewer(i)"
                          class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                          [class]="activeViewer() === i ? 'bg-orange-100 text-orange-700' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'">
                          {{ activeViewer() === i ? 'Close' : 'View PDF' }}
                        </button>
                        <button (click)="downloadFile(material)"
                          class="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                          Download
                        </button>
                        @if (isTeacher()) {
                          <button (click)="deleteMaterial(material)"
                            class="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors">
                            Delete
                          </button>
                        }
                      </div>
                    </div>
                    @if (activeViewer() === i) {
                      <div class="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                        <iframe [src]="getSafeUrl(material.url)" class="w-full h-[600px]" frameborder="0"></iframe>
                      </div>
                    }
                  }

                  <!-- Video -->
                  @if (material.type.startsWith('video/')) {
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">{{ material.name }}</p>
                        <p class="text-xs text-gray-500">{{ material.size }}</p>
                      </div>
                      <div class="flex items-center gap-2 flex-shrink-0">
                        <button (click)="toggleViewer(i)"
                          class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                          [class]="activeViewer() === i ? 'bg-red-100 text-red-700' : 'bg-red-50 text-red-600 hover:bg-red-100'">
                          {{ activeViewer() === i ? 'Close' : 'View' }}
                        </button>
                        <button (click)="downloadFile(material)"
                          class="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                          Download
                        </button>
                        @if (isTeacher()) {
                          <button (click)="deleteMaterial(material)"
                            class="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors">
                            Delete
                          </button>
                        }
                      </div>
                    </div>
                    @if (activeViewer() === i) {
                      <div class="mt-4">
                        <video #videoEl controls class="w-full rounded-lg bg-black max-h-[500px]"
                          (loadeddata)="onMediaLoaded()">
                          <source [attr.src]="getFileUrl(material.url)" [type]="material.type">
                          Your browser does not support video.
                        </video>
                      </div>
                    }
                  }

                  <!-- Audio -->
                  @if (material.type.startsWith('audio/')) {
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">{{ material.name }}</p>
                        <p class="text-xs text-gray-500">{{ material.size }}</p>
                      </div>
                      <div class="flex items-center gap-2 flex-shrink-0">
                        <button (click)="toggleViewer(i)"
                          class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                          [class]="activeViewer() === i ? 'bg-purple-100 text-purple-700' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'">
                          {{ activeViewer() === i ? 'Close' : 'Listen' }}
                        </button>
                        <button (click)="downloadFile(material)"
                          class="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                          Download
                        </button>
                        @if (isTeacher()) {
                          <button (click)="deleteMaterial(material)"
                            class="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors">
                            Delete
                          </button>
                        }
                      </div>
                    </div>
                    @if (activeViewer() === i) {
                      <div class="mt-4 bg-gray-50 rounded-lg p-4">
                        <audio #audioEl controls class="w-full"
                          (loadeddata)="onMediaLoaded()">
                          <source [attr.src]="getFileUrl(material.url)" [type]="material.type">
                          Your browser does not support audio.
                        </audio>
                      </div>
                    }
                  }

                  <!-- Other files -->
                  @if (!material.type.startsWith('video/') && !material.type.startsWith('audio/') && material.type !== 'application/pdf') {
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">{{ material.name }}</p>
                        <p class="text-xs text-gray-500">{{ material.size }}</p>
                      </div>
                      <div class="flex items-center gap-2 flex-shrink-0">
                        <button (click)="downloadFile(material)"
                          class="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                          Download
                        </button>
                        @if (isTeacher()) {
                          <button (click)="deleteMaterial(material)"
                            class="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors">
                            Delete
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      } @else {
        <div class="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p class="text-gray-500">Course not found</p>
        </div>
      }
    </div>

    @if (showUploadModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/50" (click)="closeUploadModal()"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-bold text-gray-900">Upload Materials</h2>
            <button (click)="closeUploadModal()" class="text-gray-400 hover:text-gray-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          @if (uploadSuccess()) {
            <div class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              {{ uploadSuccess() }}
            </div>
          }

          @if (uploadError()) {
            <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {{ uploadError() }}
            </div>
          }

          <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
            <svg class="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p class="text-sm text-gray-600 mb-1">Drag & drop files or <label for="viewer-file-upload" class="text-purple-600 font-medium cursor-pointer hover:text-purple-700">browse</label></p>
            <p class="text-xs text-gray-400">Video, Audio, PDF up to 100MB each</p>
            <input id="viewer-file-upload" type="file" multiple accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              (change)="onFilesSelected($event)" class="hidden" />
          </div>

          @if (selectedFiles().length > 0) {
            <div class="mt-4 space-y-2 max-h-48 overflow-y-auto">
              @for (file of selectedFiles(); track file.name; let i = $index) {
                <div class="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                  <div class="flex items-center gap-3">
                    @switch (getFileIcon(file.type)) {
                      @case ('video') {
                        <div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                          <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      }
                      @case ('audio') {
                        <div class="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      }
                      @default {
                        <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      }
                    }
                    <div>
                      <p class="text-sm font-medium text-gray-700">{{ file.name }}</p>
                      <p class="text-xs text-gray-400">{{ formatFileSize(file.size) }}</p>
                    </div>
                  </div>
                  <button (click)="removeFile(i)" class="text-gray-400 hover:text-red-500 transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              }
            </div>
          }

          <div class="flex gap-3 mt-6">
            <button (click)="closeUploadModal()"
              class="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button (click)="uploadFiles()" [disabled]="selectedFiles().length === 0 || isUploading()"
              class="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              @if (isUploading()) {
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              } @else {
                Upload {{ selectedFiles().length }} file(s)
              }
            </button>
          </div>
        </div>
      </div>
    }

    @if (showDeleteMaterialConfirm()) {
      <app-confirm-dialog
        title="Delete Material"
        [message]="'Are you sure you want to delete ' + deleteMaterialName() + '? This action cannot be undone.'"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        (confirmed)="confirmDeleteMaterial()"
        (cancelled)="showDeleteMaterialConfirm.set(false)">
      </app-confirm-dialog>
    }
  `,
})
export class CourseViewerComponent implements OnInit {
  course = signal<Course | null>(null);
  materials = signal<CourseMaterial[]>([]);
  loading = signal(true);
  errorMessage = signal('');
  activeViewer = signal<number | null>(null);
  showUploadModal = signal(false);
  selectedFiles = signal<File[]>([]);
  isUploading = signal(false);
  uploadSuccess = signal('');
  uploadError = signal('');
  showDeleteMaterialConfirm = signal(false);
  deleteMaterialName = signal('');
  private deleteMaterialData: { courseId: string; filename: string } | null = null;
  private baseUrl = 'http://localhost:5000';
  private pendingSources: { url: string; type: string }[] = [];

  @ViewChildren('videoEl') videoElements!: QueryList<ElementRef<HTMLVideoElement>>;
  @ViewChildren('audioEl') audioElements!: QueryList<ElementRef<HTMLAudioElement>>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private auth: AuthService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }

    const role = this.auth.userRole();

    if (role === 'teacher' || role === 'admin') {
      this.loadCourse(id);
      return;
    }

    this.http.get<{ enrollments: any[] }>(`${environment.apiUrl}/enrollments/my`).subscribe({
      next: (res) => {
        const enrollment = res.enrollments.find(
          (e: any) => e.course_id.toString() === id && e.status === 'approved'
        );
        if (!enrollment) {
          this.errorMessage.set('You are not enrolled in this course. Please enroll and wait for teacher approval.');
          this.loading.set(false);
          return;
        }
        this.loadCourse(id);
      },
      error: () => {
        this.errorMessage.set('Failed to verify enrollment');
        this.loading.set(false);
      }
    });
  }

  ngAfterViewChecked() {
    if (this.pendingSources.length > 0) {
      const sources = [...this.pendingSources];
      this.pendingSources = [];

      for (const source of sources) {
        if (source.type.startsWith('video/')) {
          const videos = this.videoElements?.toArray();
          if (videos && videos.length > 0) {
            const videoEl = videos[videos.length - 1].nativeElement;
            videoEl.src = source.url;
            videoEl.load();
          }
        } else if (source.type.startsWith('audio/')) {
          const audios = this.audioElements?.toArray();
          if (audios && audios.length > 0) {
            const audioEl = audios[audios.length - 1].nativeElement;
            audioEl.src = source.url;
            audioEl.load();
          }
        }
      }
    }
  }

  onMediaLoaded() {}

  getFileUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http')) {
      return url;
    }
    return this.baseUrl + url;
  }

  getSafeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.getFileUrl(url));
  }

  toggleViewer(index: number) {
    if (this.activeViewer() === index) {
      this.activeViewer.set(null);
    } else {
      this.activeViewer.set(index);
      const material = this.materials()[index];
      if (material && (material.type.startsWith('video/') || material.type.startsWith('audio/'))) {
        this.pendingSources.push({ url: this.getFileUrl(material.url), type: material.type });
      }
    }
  }

  async downloadFile(material: CourseMaterial) {
    const fileUrl = this.getFileUrl(material.url);
    const fileName = material.name;

    try {
      if ('showSaveFilePicker' in window) {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: fileName.split('.').pop()?.toUpperCase() || 'File',
            accept: { [material.type]: [ '.' + fileName.split('.').pop() ] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = fileName;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Download failed:', err);
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = fileName;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  }

  loadCourse(id: string) {
    this.http.get<{ course: any }>(`${environment.apiUrl}/courses/${id}`).subscribe({
      next: (res) => {
        const c = res.course;
        const course: Course = {
          id: c.id.toString(),
          name: c.name,
          code: c.code,
          description: c.description,
          instructor: c.instructor,
          instructor_id: c.instructor_id,
          category: c.category,
          credits: c.credits,
          enrolled: c.enrolled,
          maxEnrolled: c.max_enrolled,
          status: c.status,
          schedule: c.schedule,
          materials: c.materials || [],
        };
        this.course.set(course);
        this.materials.set(course.materials);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  goBack() {
    const role = this.auth.userRole();
    if (role === 'student') this.router.navigate(['/student/courses']);
    else if (role === 'teacher') this.router.navigate(['/staff/courses']);
    else if (role === 'admin') this.router.navigate(['/admin/courses']);
    else this.router.navigate(['/']);
  }

  isTeacher(): boolean {
    const role = this.auth.userRole();
    return role === 'teacher' || role === 'admin';
  }

  openUploadModal() {
    this.showUploadModal.set(true);
    this.uploadSuccess.set('');
    this.uploadError.set('');
    this.selectedFiles.set([]);
  }

  closeUploadModal() {
    this.showUploadModal.set(false);
    this.selectedFiles.set([]);
    this.uploadSuccess.set('');
    this.uploadError.set('');
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.selectedFiles.update(files => [...files, ...Array.from(input.files!)]);
  }

  removeFile(index: number) {
    this.selectedFiles.update(files => files.filter((_, i) => i !== index));
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  getFileIcon(type: string): string {
    if (type.includes('video')) return 'video';
    if (type.includes('audio')) return 'audio';
    if (type.includes('pdf')) return 'pdf';
    if (type.includes('word') || type.includes('document')) return 'doc';
    return 'file';
  }

  uploadFiles() {
    const courseId = this.course()?.id;
    if (!courseId || this.selectedFiles().length === 0) return;

    this.isUploading.set(true);
    this.uploadError.set('');
    this.uploadSuccess.set('');

    const formData = new FormData();
    this.selectedFiles().forEach(file => formData.append('files', file));

    this.http.post<{ materials: any[] }>(`${environment.apiUrl}/courses/${courseId}/materials`, formData).subscribe({
      next: (res) => {
        this.isUploading.set(false);
        this.uploadSuccess.set(`${this.selectedFiles().length} file(s) uploaded successfully!`);
        this.selectedFiles.set([]);
        this.loadCourse(courseId);
        setTimeout(() => {
          this.uploadSuccess.set('');
          this.showUploadModal.set(false);
        }, 2000);
      },
      error: (err) => {
        this.isUploading.set(false);
        this.uploadError.set(err.error?.error || 'Failed to upload materials');
      }
    });
  }

  deleteMaterial(material: CourseMaterial) {
    const courseId = this.course()?.id;
    if (!courseId || !material.filename) return;

    this.deleteMaterialData = { courseId, filename: material.filename };
    this.deleteMaterialName.set(material.name);
    this.showDeleteMaterialConfirm.set(true);
  }

  confirmDeleteMaterial() {
    this.showDeleteMaterialConfirm.set(false);
    if (!this.deleteMaterialData) return;

    const { courseId, filename } = this.deleteMaterialData;
    this.deleteMaterialData = null;

    this.http.delete(`${environment.apiUrl}/courses/${courseId}/materials/${filename}`).subscribe({
      next: () => {
        this.loadCourse(courseId);
      },
      error: (err) => {
        console.error('Delete failed:', err);
      }
    });
  }
}
