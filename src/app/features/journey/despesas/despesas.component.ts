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
  selector: 'app-despesas',
  standalone: true,
  imports: [
    HeaderComponent,
    ProgressTimelineComponent,
    JourneyNavButtonsComponent,
    FormsModule,
    NgxMaskDirective,
  ],
  templateUrl: './despesas.component.html',
  styleUrl: './despesas.component.css',
})
export class DespesasComponent {
  private readonly router = inject(Router);
  private readonly journey = inject(JourneyStateService);

  readonly totalSteps = this.journey.totalSteps;
  readonly currentStep = computed(() =>
    this.journey.paymentMethod() === 'financed' ? 5 : 4
  );

  propertyHoldMonths = signal<string>('');
  monthlyCondominiumFee = signal<string>('');
  monthlyIptuValue = signal<string>('');

  constructor() {
    effect(() => {
      const data = this.journey.despesasData();
      if (data.propertyHoldMonths != null) this.propertyHoldMonths.set(String(data.propertyHoldMonths));
      if (data.monthlyCondominiumFee != null) this.monthlyCondominiumFee.set(toRawCents(data.monthlyCondominiumFee));
      if (data.monthlyIptuValue != null) this.monthlyIptuValue.set(toRawCents(data.monthlyIptuValue));
    }, { allowSignalWrites: true });
  }

  monthlyCondominiumParsed = computed(() => parseCurrencyPtBr(this.monthlyCondominiumFee()));
  monthlyIptuParsed = computed(() => parseCurrencyPtBr(this.monthlyIptuValue()));

  canNext = computed(() => {
    const m = this.propertyHoldMonths().trim();
    const months = m === '' ? null : Number(m);
    const c = this.monthlyCondominiumParsed();
    const i = this.monthlyIptuParsed();
    return months != null && months > 0 && c != null && c >= 0 && i != null && i >= 0;
  });

  toStr(value: string | number | null | undefined): string {
    return value != null && value !== '' ? String(value) : '';
  }

  next(): void {
    const m = this.propertyHoldMonths().trim();
    const months = m === '' ? null : Number(m);
    const c = this.monthlyCondominiumParsed();
    const i = this.monthlyIptuParsed();
    if (months == null || months <= 0 || c == null || i == null) return;
    this.journey.setDespesasData({
      propertyHoldMonths: months,
      monthlyCondominiumFee: c,
      monthlyIptuValue: i,
    });
    this.router.navigate(['/venda']);
  }
}
