import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './welcome.page.html',
  styleUrl: './welcome.page.scss'
})
export class WelcomePage {}
