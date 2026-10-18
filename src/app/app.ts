import { afterNextRender, Component, inject, signal } from '@angular/core';
import { LanguageService } from './i18n/language.service';
import { TranslateDirective } from './i18n/translate.directive';
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
  imports: [TranslateDirective, NavbarComponent, Hero, AboutComponent, Experience, SkillsComponent, Projects, Services, Contract, Contact, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('amirhosseinportforio');
  private readonly language = inject(LanguageService);

  constructor() {
    afterNextRender(() => this.language.initialize());
  }
}
