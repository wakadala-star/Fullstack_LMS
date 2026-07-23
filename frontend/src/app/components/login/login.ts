import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

const REMEMBER_KEY = 'lms_remember';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  protected readonly loginMode = signal<'email' | 'token'>('email');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly name = signal('');
  protected readonly token = signal('');
  protected readonly showPassword = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly rememberMe = signal(false);

  constructor(private router: Router, private auth: AuthService) {}

  ngOnInit() {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.email.set(data.email || '');
        this.password.set(data.password || '');
        this.rememberMe.set(true);
      } catch {}
    }
  }

  setLoginMode(mode: 'email' | 'token'): void {
    this.loginMode.set(mode);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  async onSubmit(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.loginMode() === 'email') {
      await this.loginWithEmail();
    } else {
      await this.loginWithToken();
    }
  }

  private async loginWithEmail(): Promise<void> {
    if (!this.email() || !this.password()) {
      this.errorMessage.set('Please fill in all fields.');
      return;
    }

    this.isLoading.set(true);

    const success = await this.auth.login(this.email(), this.password());

    this.isLoading.set(false);

    if (success) {
      if (this.rememberMe()) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({
          email: this.email(),
          password: this.password(),
        }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
      this.successMessage.set('You have logged in successfully!');
      setTimeout(() => {
        this.redirectByRole();
      }, 1500);
    } else {
      this.errorMessage.set('Failed to login. Check your credentials.');
    }
  }

  private async loginWithToken(): Promise<void> {
    if (!this.name() || !this.token()) {
      this.errorMessage.set('Please enter your name and token.');
      return;
    }

    this.isLoading.set(true);

    const result = await this.auth.tokenLogin(this.name(), this.token());

    this.isLoading.set(false);

    if (result.success) {
      this.successMessage.set('You have logged in successfully!');
      setTimeout(() => {
        this.redirectByRole();
      }, 1500);
    } else {
      this.errorMessage.set(result.message);
    }
  }

  private redirectByRole(): void {
    const role = this.auth.userRole();
    if (role === 'admin') this.router.navigate(['/admin']);
    else if (role === 'teacher') this.router.navigate(['/staff']);
    else if (role === 'student') this.router.navigate(['/student']);
    else if (role === 'parent') this.router.navigate(['/parent']);
    else this.router.navigate(['/']);
  }
}
