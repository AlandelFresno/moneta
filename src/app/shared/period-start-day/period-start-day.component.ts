import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { PeriodSettingsService } from '../../services/period-settings.service';

@Component({
  selector: 'app-period-start-day',
  standalone: true,
  imports: [CommonModule, FormsModule, InputNumberModule],
  templateUrl: './period-start-day.component.html',
  styleUrl: './period-start-day.component.scss'
})
export class PeriodStartDayComponent {
  /** When the current period's real start was pushed off the configured day/hour by a marked
   * transaction, the parent passes an explanatory note here instead of the generic default text. */
  @Input() overrideNote: string | null = null;

  @Output() settingsChange = new EventEmitter<void>();

  day: number;
  hour: number;

  constructor(private readonly periodSettingsService: PeriodSettingsService) {
    this.day = this.periodSettingsService.getStartDay();
    this.hour = this.periodSettingsService.getStartHour();
  }

  onBlur(): void {
    this.periodSettingsService.setStartDay(this.day);
    this.periodSettingsService.setStartHour(this.hour);
    this.day = this.periodSettingsService.getStartDay();
    this.hour = this.periodSettingsService.getStartHour();
    this.settingsChange.emit();
  }
}
