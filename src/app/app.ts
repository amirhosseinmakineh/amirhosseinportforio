import { Component, signal } from '@angular/core';
import { NavbarComponent } from './components/navbar/navbar';
import { Hero } from './components/hero/hero';
import { Projects } from "./components/projects/projects";
import { SkillsComponent } from "./components/technologies/technologies";
import { AboutComponent } from "./components/about/about/about.component";
import { Experience } from './components/experience/experience';
import { Contact } from './components/contact/contact';
import { Services } from './components/services/services';
import { Contract } from './components/contract/contract';
import { Footer } from './components/footer/footer';

@Component({
  selector: 'app-root',
  imports: [NavbarComponent, Hero, AboutComponent, Experience, SkillsComponent, Projects, Services, Contract, Contact, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('amirhosseinportforio');
}
