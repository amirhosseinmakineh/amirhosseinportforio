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
  skillGroups: SkillGroup[] = [
    {
      title: 'زبان برنامه‌نویسی',
      subtitle: 'Programming Language',
      skills: [
        'C#'
      ]
    },
    {
      title: 'تکنولوژی‌ها',
      subtitle: 'Backend Technologies',
      skills: [
        'ASP.NET Core',
        'SQL Server',
        'Hangfire',
        'SignalR'
      ]
    },
    {
      title: 'معماری و الگوها',
      subtitle: 'Architecture & Patterns',
      skills: [
        'CQRS',
        'Repository Pattern',
        'Unit of Work',
        'Strategy Pattern',
        'SOLID'
      ]
    },
    {
      title: 'برنامه‌نویسی ناهمگام',
      subtitle: 'Asynchronous Programming',
      skills: [
        'Async / Await',
        'Task',
        'Asynchronous Programming'
      ]
    },
    {
      title: 'مدیریت سورس',
      subtitle: 'Version Control',
      skills: [
        'Git'
      ]
    }
  ];
}
