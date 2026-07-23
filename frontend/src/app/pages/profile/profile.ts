import { Component, signal, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ImageCropModalComponent } from '../../shared/components/image-crop-modal/image-crop-modal';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, ImageCropModalComponent],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class ProfileComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  protected readonly isLoading = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly passwordSuccess = signal('');
  protected readonly passwordError = signal('');

  protected readonly name = signal('');
  protected readonly phone = signal('');
  protected readonly email = signal('');
  protected readonly role = signal('');
  protected readonly avatar = signal('');

  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly showCurrentPassword = signal(false);
  protected readonly showNewPassword = signal(false);
  protected readonly isUploadingAvatar = signal(false);

  protected readonly showCropModal = signal(false);
  protected readonly selectedImageFile = signal<File | null>(null);

  constructor(public auth: AuthService, private router: Router) {}

  goBack() {
    const role = this.auth.userRole();
    if (role === 'admin') this.router.navigate(['/admin']);
    else if (role === 'teacher') this.router.navigate(['/staff']);
    else if (role === 'student') this.router.navigate(['/student']);
    else if (role === 'parent') this.router.navigate(['/parent']);
    else this.router.navigate(['/']);
  }

  ngOnInit() {
    const user = this.auth.user();
    if (user) {
      this.name.set(user.name);
      this.phone.set(user.phone || '');
      this.email.set(user.email);
      this.role.set(user.role);
      this.avatar.set((user as any).avatar || '');
    }
  }

  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    input.value = '';

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      this.errorMessage.set('Please select a valid image file (JPEG, PNG, GIF, or WebP).');
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      this.errorMessage.set('Image size must be less than 10MB.');
      return;
    }

    this.errorMessage.set('');
    this.selectedImageFile.set(file);
    this.showCropModal.set(true);
  }

  onCropCancel() {
    this.showCropModal.set(false);
    this.selectedImageFile.set(null);
  }

  async onCropComplete(croppedImage: string) {
    this.showCropModal.set(false);
    this.selectedImageFile.set(null);

    this.isUploadingAvatar.set(true);
    this.errorMessage.set('');

    this.avatar.set(croppedImage);

    const result = await this.auth.updateProfile({ avatar: croppedImage });
    this.isUploadingAvatar.set(false);

    if (result.success) {
      this.successMessage.set('Profile picture updated!');
      setTimeout(() => this.successMessage.set(''), 3000);
    } else {
      this.errorMessage.set(result.message);
    }
  }

  async onUpdateProfile() {
    this.successMessage.set('');
    this.errorMessage.set('');

    if (!this.name() || this.name().trim().length < 2) {
      this.errorMessage.set('Name must be at least 2 characters.');
      return;
    }

    this.isLoading.set(true);

    const result = await this.auth.updateProfile({
      name: this.name(),
      phone: this.phone(),
    });

    this.isLoading.set(false);

    if (result.success) {
      this.successMessage.set(result.message);
      setTimeout(() => this.successMessage.set(''), 3000);
    } else {
      this.errorMessage.set(result.message);
    }
  }

  async onChangePassword() {
    this.passwordSuccess.set('');
    this.passwordError.set('');

    if (!this.currentPassword() || !this.newPassword() || !this.confirmPassword()) {
      this.passwordError.set('All fields are required.');
      return;
    }

    if (this.newPassword() !== this.confirmPassword()) {
      this.passwordError.set('New passwords do not match.');
      return;
    }

    if (this.newPassword().length < 6) {
      this.passwordError.set('New password must be at least 6 characters.');
      return;
    }

    this.isLoading.set(true);

    const result = await this.auth.changePassword(this.currentPassword(), this.newPassword());

    this.isLoading.set(false);

    if (result.success) {
      this.passwordSuccess.set(result.message);
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
      setTimeout(() => this.passwordSuccess.set(''), 3000);
    } else {
      this.passwordError.set(result.message);
    }
  }

  toggleCurrentPassword() {
    this.showCurrentPassword.update(v => !v);
  }

  toggleNewPassword() {
    this.showNewPassword.update(v => !v);
  }

  getRoleBadgeClass(): string {
    const classes: Record<string, string> = {
      admin: 'bg-red-100 text-red-700',
      teacher: 'bg-green-100 text-green-700',
      student: 'bg-blue-100 text-blue-700',
      parent: 'bg-purple-100 text-purple-700',
    };
    return classes[this.role()] || 'bg-gray-100 text-gray-700';
  }

  getInitial(): string {
    return this.name() ? this.name().charAt(0).toUpperCase() : '?';
  }
}
