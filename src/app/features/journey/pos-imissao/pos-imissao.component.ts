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
  selector: 'app-pos-imissao',
  standalone: true,
  imports: [
    HeaderComponent,
    ProgressTimelineComponent,
    JourneyNavButtonsComponent,
    FormsModule,
    NgxMaskDirective,
  ],
  templateUrl: './pos-imissao.component.html',
  styleUrl: './pos-imissao.component.css',
})
export class PosImissaoComponent {
  private readonly router = inject(Router);
  private readonly journey = inject(JourneyStateService);

  readonly totalSteps = this.journey.totalSteps;
  readonly currentStep = computed(() =>
    this.journey.paymentMethod() === 'financed' ? 4 : 3
  );

  condominiumDebt = signal<string>('');
  iptuDebt = signal<string>('');
  renovationValue = signal<string>('');

  constructor() {
    effect(() => {
      const data = this.journey.posImissaoData();
      if (data.condominiumDebt != null) this.condominiumDebt.set(toRawCents(data.condominiumDebt));
      if (data.iptuDebt != null) this.iptuDebt.set(toRawCents(data.iptuDebt));
      if (data.renovationValue != null) this.renovationValue.set(toRawCents(data.renovationValue));
    }, { allowSignalWrites: true });
  }

  condominiumDebtParsed = computed(() => parseCurrencyPtBr(this.condominiumDebt()));
  iptuDebtParsed = computed(() => parseCurrencyPtBr(this.iptuDebt()));
  renovationValueParsed = computed(() => parseCurrencyPtBr(this.renovationValue()));

  canNext = computed(() => {
    const c = this.condominiumDebtParsed();
    const i = this.iptuDebtParsed();
    const r = this.renovationValueParsed();
    return c != null && c >= 0 && i != null && i >= 0 && r != null && r >= 0;
  });

  next(): void {
    const c = this.condominiumDebtParsed();
    const i = this.iptuDebtParsed();
    const r = this.renovationValueParsed();
    if (c == null || i == null || r == null) return;
    this.journey.setPosImissaoData({
      condominiumDebt: c,
      iptuDebt: i,
      renovationValue: r,
    });
    this.router.navigate(['/despesas']);
  }
}
