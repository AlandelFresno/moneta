import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-period-override-notice',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './period-override-notice.component.html',
  styleUrl: './period-override-notice.component.scss'
})
export class PeriodOverrideNoticeComponent {
  /** Explanation of why the current period doesn't start on the configured day/hour; nothing renders while null. */
  @Input() note: string | null = null;
}
