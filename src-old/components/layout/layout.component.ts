import { Component, ViewChild } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  standalone: false
})
export class LayoutComponent {
  @ViewChild(SidebarComponent) sidebar!: SidebarComponent;
  sidebarCollapsed = false;

  openMobileMenu() {
    this.sidebar.openMobileMenu();
  }
}
