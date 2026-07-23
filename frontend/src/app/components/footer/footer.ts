import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.css'
})
export class Footer {
  protected readonly currentYear = new Date().getFullYear();

  protected readonly footerSections = [
    {
      title: 'Systems',
      links: [
        { label: 'Fees Payment', route: '/login' },
        { label: 'Results Portal', route: '/login' },
        { label: 'Quizzes & Exams', route: '/login' },
        { label: 'Course Catalog', route: '/login' },
      ],
    },
    {
      title: 'Quick Links',
      links: [
        { label: 'Student Portal', route: '/login' },
        { label: 'Staff Dashboard', route: '/login' },
        { label: 'Parent Portal', route: '/login' },
        { label: 'Admin Panel', route: '/login' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Help Center', route: '/' },
        { label: 'User Guide', route: '/' },
        { label: 'API Documentation', route: '/' },
        { label: 'Support', route: '/' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', route: '/' },
        { label: 'Contact', route: '/' },
        { label: 'Privacy Policy', route: '/' },
        { label: 'Terms of Service', route: '/' },
      ],
    },
  ];
}
