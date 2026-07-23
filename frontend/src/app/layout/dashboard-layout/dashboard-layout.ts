import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Header } from '../header/header';

@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterOutlet, Sidebar, Header],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css'
})
export class DashboardLayout {
  protected readonly sidebarCollapsed = signal(false);
  protected mobileOpen = false;

  toggleSidebar(): void {
    if (window.innerWidth >= 1024) {
      this.sidebarCollapsed.update(v => !v);
    } else {
      this.mobileOpen = !this.mobileOpen;
    }
  }
}
