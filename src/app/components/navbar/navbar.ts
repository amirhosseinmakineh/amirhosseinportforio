import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, Renderer2 } from '@angular/core';
import { LanguageService } from '../../i18n/language.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent {
  isMenuOpen = false;
  readonly language = inject(LanguageService);

  toggleLanguage(): void {
    this.language.toggle();
  }

  constructor(private renderer: Renderer2) {}

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    this.updateBodyScroll();
  }

  closeMenu(): void {
    if (!this.isMenuOpen) {
      return;
    }

    this.isMenuOpen = false;
    this.updateBodyScroll();
  }

  private updateBodyScroll(): void {
    if (this.isMenuOpen) {
      this.renderer.setStyle(document.body, 'overflow', 'hidden');
      return;
    }

    this.renderer.removeStyle(document.body, 'overflow');
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (window.innerWidth > 768 && this.isMenuOpen) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    this.closeMenu();
  }
}
