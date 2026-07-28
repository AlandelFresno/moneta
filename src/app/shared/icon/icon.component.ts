import { Component, Input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CUSTOM_ICONS, isCustomIcon } from './custom-icons';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    @if (isCustom) {
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="inline-block w-[1em] h-[1em] align-[-0.125em]"
        [innerHTML]="svgContent"
      ></svg>
    } @else {
      <i class="pi pi-{{ name }}"></i>
    }
  `
})
export class IconComponent {
  @Input({ required: true }) name = '';

  constructor(private readonly sanitizer: DomSanitizer) {}

  get isCustom(): boolean {
    return isCustomIcon(this.name);
  }

  get svgContent(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(CUSTOM_ICONS[this.name] ?? '');
  }
}
