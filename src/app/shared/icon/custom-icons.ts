// Icons PrimeIcons doesn't have, drawn as raw SVG paths (24x24 viewBox, stroke = currentColor).
// Keys here take priority over PrimeIcons in AppIconComponent — never collide with a real pi- name.
export const CUSTOM_ICONS: Record<string, string> = {
  joystick: `<path d="M7 15h10a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-1a2 2 0 0 1 2-2Z"/>
    <path d="M12 15V8"/>
    <circle cx="12" cy="5" r="3"/>
    <path d="M9 19v1"/>
    <path d="M15 19v1"/>`
};

export function isCustomIcon(name: string): boolean {
  return name in CUSTOM_ICONS;
}
