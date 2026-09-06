import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { IconComponent } from './icon.component';
import { CUSTOM_ICONS } from './custom-icons';

describe('IconComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  it('renders a PrimeIcons <i> tag for a non-custom icon name', () => {
    const fixture = TestBed.createComponent(IconComponent);
    fixture.componentInstance.name = 'home';
    fixture.detectChanges();

    expect(fixture.componentInstance.isCustom).toBeFalse();
    const icon = fixture.nativeElement.querySelector('i');
    expect(icon?.className).toContain('pi-home');
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
  });

  it('renders the raw SVG for a custom icon name', () => {
    const fixture = TestBed.createComponent(IconComponent);
    fixture.componentInstance.name = 'joystick';
    fixture.detectChanges();

    expect(fixture.componentInstance.isCustom).toBeTrue();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.innerHTML).toContain('circle');
    expect(fixture.nativeElement.querySelector('i')).toBeNull();
  });

  it('renders the exact SVG markup registered for that custom icon', () => {
    const fixture = TestBed.createComponent(IconComponent);
    fixture.componentInstance.name = 'joystick';
    fixture.detectChanges();

    // Parsed as SVG, not plain HTML — a bare <div> doesn't know <path/> self-closes and nests siblings inside it.
    const scratch = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    scratch.innerHTML = CUSTOM_ICONS['joystick'];
    const normalize = (markup: string) => markup.replace(/\s+/g, ' ').trim();

    const svg = fixture.nativeElement.querySelector('svg');
    expect(normalize(svg.innerHTML)).toBe(normalize(scratch.innerHTML));
  });
});
