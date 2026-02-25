import { Component, inject, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ProgressTimelineComponent } from '../../../shared/components/progress-timeline/progress-timeline.component';
import { JourneyNavButtonsComponent } from '../../../shared/components/journey-nav-buttons/journey-nav-buttons.component';
import { NgxMaskDirective } from 'ngx-mask';
import { JourneyStateService, type FinancingModality } from '../../../core/services/journey-state.service';
import { parseCurrencyPtBr, toRawCents } from '../../../core/utils/currency.util';

@Component({
  selector: 'app-financiamento',
  standalone: true,
  imports: [
    HeaderComponent,
    ProgressTimelineComponent,
    JourneyNavButtonsComponent,
    FormsModule,
    NgxMaskDirective,
  ],
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

  constructor() {
    effect(() => {
      const data = this.journey.financingData();
      if (data.auctionValue != null) this.auctionValue.set(toRawCents(data.auctionValue));
      this.modality.set(data.modality);
      if (data.downPaymentPercentage != null) this.downPaymentPercentage.set(String(data.downPaymentPercentage));
      if (data.annualInterestRate != null) this.annualInterestRate.set(String(data.annualInterestRate));
      if (data.financingMonths != null) this.financingMonths.set(String(data.financingMonths));
    }, { allowSignalWrites: true });
  }

  /** Valor da arrematação parseado (para validação e envio). */
  auctionValueParsed = computed(() => parseCurrencyPtBr(this.auctionValue()));

  canNext = computed(() => {
    const v = this.auctionValueParsed();
    const d = this.downPaymentPercentage();
    const a = this.annualInterestRate();
    const m = this.financingMonths();
    return v != null && v > 0 && d !== '' && a !== '' && m !== '';
  });

  setModality(m: FinancingModality): void {
    this.modality.set(m);
  }

  toStr(value: string | number | null | undefined): string {
    return value != null && value !== '' ? String(value) : '';
  }

  next(): void {
    const toNum = (s: string) => (s === '' ? null : Number(s.replace(',', '.')));
    const auction = this.auctionValueParsed();
    if (auction == null || auction <= 0) return;
    this.journey.setFinancingData({
      auctionValue: auction,
      modality: this.modality(),
      downPaymentPercentage: toNum(this.downPaymentPercentage()),
      annualInterestRate: toNum(this.annualInterestRate()),
      financingMonths: toNum(this.financingMonths()),
    });
    this.router.navigate(['/arrematacao']);
  }
}
