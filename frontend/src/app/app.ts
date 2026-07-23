import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MaintenanceModalComponent } from './shared/maintenance-modal/maintenance-modal.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MaintenanceModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
