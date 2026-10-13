import { Component } from '@angular/core';

interface SkillGroup {
  title: string;
  subtitle: string;
  skills: string[];
}

@Component({
  selector: 'app-skills',
  standalone: true,
  templateUrl: './technologies.html',
  styleUrl: './technologies.css'
})
export class SkillsComponent {
  readonly skillGroups: SkillGroup[] = [
    {
      title: 'Backend و API',
      subtitle: 'Backend Engineering',
      skills: ['C#', 'ASP.NET Core', 'REST API', 'EF Core', 'SQL Server']
    },
    {
      title: 'Frontend محصول',
      subtitle: 'Product Interfaces',
      skills: ['Angular 20', 'Angular Material', 'SSR', 'Responsive UI', 'SignalR']
    },
    {
      title: 'معماری و کدنویسی',
      subtitle: 'Architecture & Patterns',
      skills: [
        'Layered Architecture',
        'CQRS',
        'Repository',
        'Strategy',
        'Specification',
        'SOLID',
        'Clean Code'
      ]
    },
    {
      title: 'ابزارها و سرویس‌ها',
      subtitle: 'Tools & Services',
      skills: ['Git', 'Hangfire', 'Toastr', 'Web Crawler', 'Image Storage']
    },
    {
      title: 'تجربه محصول',
      subtitle: 'Product Thinking',
      skills: ['Admin Panel', 'Role Management', 'Authentication', 'Orders', 'Installments']
    }
  ];
}
