import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  templateUrl: './about.component.html',
  styleUrl: './about.component.css'
})
export class AboutComponent {

  scrollToExperience(): void {
    document
      .getElementById('experience')
      ?.scrollIntoView({
        behavior: 'smooth'
      });
  }

}
