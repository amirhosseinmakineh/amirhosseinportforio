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
      skills: ['C#', 'OOP', 'AOP']
    },
    {
      title: 'تکنولوژی‌ها',
      subtitle: 'Backend Technologies',
      skills: [
        'ASP.NET Core', 'REST API', 'SQL Server'
      ]
    },
    {
      title: 'معماری و الگوها',
      subtitle: 'Architecture & Patterns',
      skills: [
        'Layered Architecture', 'CQRS', 'Repository Pattern',
        'Strategy Pattern', 'State Pattern', 'Builder Pattern',
        'Specification Pattern', 'SOLID'
      ]
    },
    {
      title: 'طراحی API',
      subtitle: 'Backend Engineering',
      skills: ['RESTful Services', 'Clean Code', 'Maintainability']
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
