import { Injectable, signal } from '@angular/core';

export type Language = 'fa' | 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly current = signal<Language>('fa');

  initialize(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const saved = window.localStorage.getItem('portfolio-language');
    this.setLanguage(saved === 'en' ? 'en' : 'fa');
  }

  toggle(): void {
    this.setLanguage(this.current() === 'fa' ? 'en' : 'fa');
  }

  setLanguage(language: Language): void {
    this.current.set(language);

    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
      document.title = language === 'fa'
        ? 'امیرحسین مکینه | توسعه‌دهنده نرم‌افزار و طراح محصول'
        : 'Amirhossein Makineh | Software Developer & Digital Product Designer';

      const description = document.querySelector('meta[name="description"]');
      description?.setAttribute('content', language === 'fa'
        ? 'پورتفولیوی امیرحسین مکینه؛ طراحی رابط و تجربه کاربری، توسعه ASP.NET Core و Angular و سامانه‌های اختصاصی.'
        : 'Amirhossein Makineh portfolio: UI/UX design, ASP.NET Core and Angular development, and custom business software.');
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('portfolio-language', language);
    }
  }
}
