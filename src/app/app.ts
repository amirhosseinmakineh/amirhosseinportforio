import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar';
import { Hero } from './components/hero/hero';
import { Projects } from "./components/projects/projects";
import { SkillsComponent } from "./components/technologies/technologies";
import { AboutComponent } from "./components/about/about/about.component";

@Component({
  selector: 'app-root',
  imports: [NavbarComponent, Hero, Projects, SkillsComponent, AboutComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('amirhosseinportforio');
}
