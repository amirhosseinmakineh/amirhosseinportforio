import { afterEveryRender, Directive, ElementRef, inject } from '@angular/core';
import { LanguageService } from './language.service';
import { ENGLISH_COPY } from './translations';

@Directive({
  selector: '[appTranslate]',
  standalone: true
})
export class TranslateDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly language = inject(LanguageService);
  private readonly originals = new WeakMap<Text, string>();
  private lastLanguage = '';

  constructor() {
    afterEveryRender(() => {
      const current = this.language.current();

      if (current === this.lastLanguage) {
        return;
      }

      this.lastLanguage = current;
      this.translateTree(current);
    });
  }

  private translateTree(language: 'fa' | 'en'): void {
    const root = this.host.nativeElement;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      const original = this.originals.get(textNode) ?? textNode.textContent ?? '';
      this.originals.set(textNode, original);

      const trimmed = original.trim();
      const translation = ENGLISH_COPY[trimmed];

      if (language === 'en' && translation) {
        textNode.textContent = original.replace(trimmed, translation);
      } else {
        textNode.textContent = original;
      }
    }
  }
}
