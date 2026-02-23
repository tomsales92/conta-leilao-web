import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ProgressTimelineComponent } from '../../../shared/components/progress-timeline/progress-timeline.component';
import { JourneyNavButtonsComponent } from '../../../shared/components/journey-nav-buttons/journey-nav-buttons.component';
import { JourneyStateService, type FinancingModality } from '../../../core/services/journey-state.service';

@Component({
  selector: 'app-financiamento',
  standalone: true,
  imports: [HeaderComponent, ProgressTimelineComponent, JourneyNavButtonsComponent, FormsModule],
  templateUrl: './financiamento.component.html',
  styleUrl: './financiamento.component.css',
})
export class FinanciamentoComponent {
  private readonly router = inject(Router);
  private readonly journey = inject(JourneyStateService);

  readonly currentStep = 2;
  readonly totalSteps = 6;

  auctionValue = signal<string>('');
  modality = signal<FinancingModality>('SAC');
  downPaymentPercentage = signal<string>('');
  annualInterestRate = signal<string>('');
  financingMonths = signal<string>('');

  canNext = computed(() => {
    const v = this.auctionValue();
    const d = this.downPaymentPercentage();
    const a = this.annualInterestRate();
    const m = this.financingMonths();
    return v !== '' && d !== '' && a !== '' && m !== '';
  });

  setModality(m: FinancingModality): void {
    this.modality.set(m);
  }

  next(): void {
    const toNum = (s: string) => (s === '' ? null : Number(s.replace(',', '.')));
    this.journey.setFinancingData({
      auctionValue: toNum(this.auctionValue()),
      modality: this.modality(),
      downPaymentPercentage: toNum(this.downPaymentPercentage()),
      annualInterestRate: toNum(this.annualInterestRate()),
      financingMonths: toNum(this.financingMonths()),
    });
    this.router.navigate(['/arrematacao']);
  }
}
