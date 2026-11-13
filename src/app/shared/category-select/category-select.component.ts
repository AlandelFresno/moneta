import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { AutoCompleteCompleteEvent, AutoCompleteModule } from 'primeng/autocomplete';
import { Category } from '../../core/types/category.types';

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

@Component({
  selector: 'app-category-select',
  standalone: true,
  imports: [FormsModule, AutoCompleteModule],
  templateUrl: './category-select.component.html',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CategorySelectComponent), multi: true }]
})
export class CategorySelectComponent implements ControlValueAccessor {
  @Input() set options(value: Category[]) {
    this.allOptions = value;
    this.suggestions = value;
    this.selected = this.findById(this.currentId);
  }
  @Input() placeholder = 'Seleccioná una categoría';
  @Input() inputId = '';

  allOptions: Category[] = [];
  suggestions: Category[] = [];
  selected: Category | null = null;

  private currentId = '';
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.currentId = value ?? '';
    this.selected = this.findById(this.currentId);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  search(event: AutoCompleteCompleteEvent): void {
    const query = normalize(event.query.trim());
    this.suggestions = query ? this.allOptions.filter((cat) => normalize(cat.name).includes(query)) : this.allOptions;
  }

  onSelectionChange(value: Category | string | null): void {
    // While typing, the model is the raw text; only a picked option is a Category.
    if (typeof value === 'string') return;
    this.selected = value;
    this.currentId = value?.id ?? '';
    this.onChange(this.currentId);
  }

  onBlur(): void {
    this.onTouched();
  }

  private findById(id: string): Category | null {
    return this.allOptions.find((cat) => cat.id === id) ?? null;
  }
}
