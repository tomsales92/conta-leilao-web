import { Component, inject, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ProgressTimelineComponent } from '../../../shared/components/progress-timeline/progress-timeline.component';
import { JourneyNavButtonsComponent } from '../../../shared/components/journey-nav-buttons/journey-nav-buttons.component';
import { NgxMaskDirective } from 'ngx-mask';
import { JourneyStateService } from '../../../core/services/journey-state.service';
import { parseCurrencyPtBr, toRawCents } from '../../../core/utils/currency.util';

@Component({
  selector: 'app-venda',
  standalone: true,
  imports: [
    HeaderComponent,
    ProgressTimelineComponent,
    JourneyNavButtonsComponent,
    FormsModule,
    NgxMaskDirective,
  ],
  templateUrl: './venda.component.html',
  styleUrl: './venda.component.css',
})
export class VendaComponent {
  private readonly router = inject(Router);
  private readonly journey = inject(JourneyStateService);

  readonly totalSteps = this.journey.totalSteps;
  readonly currentStep = computed(() =>
    this.journey.paymentMethod() === 'financed' ? 6 : 5
  );

  saleValue = signal<string>('');
  brokerCommissionPercentage = signal<string>('');
  incomeTaxPercentage = signal<string>('');

  constructor() {
    effect(() => {
      const data = this.journey.vendaData();
      if (data.saleValue != null) this.saleValue.set(toRawCents(data.saleValue));
      if (data.brokerCommissionPercentage != null) this.brokerCommissionPercentage.set(String(data.brokerCommissionPercentage));
      if (data.incomeTaxPercentage != null) this.incomeTaxPercentage.set(String(data.incomeTaxPercentage));
    }, { allowSignalWrites: true });
  }

  saleValueParsed = computed(() => parseCurrencyPtBr(this.saleValue()));

  canNext = computed(() => {
    const s = this.saleValueParsed();
    const b = this.brokerCommissionPercentage().trim();
    return s != null && s > 0 && b !== '';
  });

  toStr(value: string | number | null | undefined): string {
    return value != null && value !== '' ? String(value) : '';
  }

  next(): void {
    const toNum = (s: string) => (s === '' ? null : Number(s.replace(',', '.')));
    const sale = this.saleValueParsed();
    if (sale == null || sale <= 0) return;
    this.journey.setVendaData({
      saleValue: sale,
      brokerCommissionPercentage: toNum(this.brokerCommissionPercentage()),
      incomeTaxPercentage: toNum(this.incomeTaxPercentage()),
    });
    this.router.navigate(['/resumo']);
  }
}
