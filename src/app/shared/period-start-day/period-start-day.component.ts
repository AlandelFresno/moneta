import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { PeriodSettingsService } from '../../services/period-settings.service';

@Component({
  selector: 'app-period-start-day',
  standalone: true,
  imports: [FormsModule, InputNumberModule],
  templateUrl: './period-start-day.component.html',
  styleUrl: './period-start-day.component.scss'
})
export class PeriodStartDayComponent {
  @Output() dayChange = new EventEmitter<number>();

  day: number;

  constructor(private readonly periodSettingsService: PeriodSettingsService) {
    this.day = this.periodSettingsService.getStartDay();
  }

  onBlur(): void {
    this.periodSettingsService.setStartDay(this.day);
    this.day = this.periodSettingsService.getStartDay();
    this.dayChange.emit(this.day);
  }
}
