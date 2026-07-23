import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-student-attendance',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900">My Attendance</h1>
        <p class="mt-1 text-sm text-gray-500">View your class attendance records</p>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-gray-500">This Week</p>
          <p class="mt-1 text-2xl font-bold text-green-600">5 / 5</p>
          <p class="text-xs text-gray-400 mt-1">Classes attended</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-gray-500">This Month</p>
          <p class="mt-1 text-2xl font-bold text-blue-600">20 / 22</p>
          <p class="text-xs text-gray-400 mt-1">Classes attended</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-gray-500">Attendance Rate</p>
          <p class="mt-1 text-2xl font-bold text-purple-600">91%</p>
          <p class="text-xs text-gray-400 mt-1">Overall</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p class="text-sm font-medium text-gray-500">Absent</p>
          <p class="mt-1 text-2xl font-bold text-red-600">2</p>
          <p class="text-xs text-gray-400 mt-1">This month</p>
        </div>
      </div>

      <!-- Placeholder for future live classroom -->
      <div class="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900">Live Classrooms</h3>
        <p class="mt-2 text-sm text-gray-500 max-w-md mx-auto">
          Join live audio and video classroom sessions here. Your attendance will be automatically 
          recorded when you participate in live classes.
        </p>
        <div class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Coming Soon
        </div>
      </div>

      <!-- Attendance Calendar View -->
      <div class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div class="p-5 border-b border-gray-100">
          <h3 class="text-sm font-semibold text-gray-900">Attendance History</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              @for (record of recentRecords(); track record.date + record.course) {
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ record.date }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{{ record.day }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">{{ record.course }}</td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      [class]="record.present ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
                      {{ record.present ? 'Present' : 'Absent' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ record.time }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class StudentAttendanceComponent {
  protected readonly recentRecords = signal([
    { date: 'Jul 21, 2026', day: 'Monday', course: 'Mathematics', present: true, time: '08:00 - 09:30' },
    { date: 'Jul 21, 2026', day: 'Monday', course: 'Physics', present: true, time: '10:00 - 11:30' },
    { date: 'Jul 18, 2026', day: 'Friday', course: 'Mathematics', present: true, time: '08:00 - 09:30' },
    { date: 'Jul 17, 2026', day: 'Thursday', course: 'Chemistry', present: true, time: '08:00 - 09:30' },
    { date: 'Jul 16, 2026', day: 'Wednesday', course: 'Mathematics', present: true, time: '08:00 - 09:30' },
    { date: 'Jul 15, 2026', day: 'Tuesday', course: 'Physics', present: false, time: '-' },
  ]);
}
