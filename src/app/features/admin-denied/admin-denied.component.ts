import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-admin-denied',
  standalone: true,
  imports: [RouterLink, HeaderComponent],
  templateUrl: './admin-denied.component.html',
  styleUrl: './admin-denied.component.css',
})
export class AdminDeniedComponent {}
