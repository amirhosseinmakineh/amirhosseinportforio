import { afterNextRender, Component, inject } from '@angular/core';
import { LanguageService } from './i18n/language.service';
import { Meta } from '@angular/platform-browser';
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
  selector: 'app-home',
  imports: [TranslateDirective, NavbarComponent, Hero, AboutComponent, Experience, SkillsComponent, Projects, Services, Contract, Contact, Footer],
  templateUrl: './home.html',
  styleUrl: './app.css'
})
export class Home {
  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'index, follow' });
    const language = inject(LanguageService);
    afterNextRender(() => language.initialize());
  }
}
