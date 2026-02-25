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
  selector: 'app-arrematacao',
  standalone: true,
  imports: [
    HeaderComponent,
    ProgressTimelineComponent,
    JourneyNavButtonsComponent,
    FormsModule,
    NgxMaskDirective,
  ],
  templateUrl: './arrematacao.component.html',
  styleUrl: './arrematacao.component.css',
})
export class ArrematacaoComponent {
  private readonly router = inject(Router);
  private readonly journey = inject(JourneyStateService);

  readonly paymentMethod = this.journey.paymentMethod;
  readonly totalSteps = this.journey.totalSteps;
  readonly currentStep = computed(() =>
    this.journey.paymentMethod() === 'financed' ? 3 : 2
  );

  /** Mostra o campo "Valor da arrematação" só quando vem da forma de pagamento (passo 2). No passo 3 (financiado) o valor já vem do Financiamento. */
  readonly showAuctionValueField = computed(() => this.journey.paymentMethod() !== 'financed');

  auctionValue = signal<string>('');
  commissionPercentage = signal<string>('');
  itbiPercentage = signal<string>('');
  propertyRegistrationValue = signal<string>('');
  vacatingValue = signal<string>('');

  constructor() {
    effect(() => {
      const data = this.journey.arrematacaoData();
      const fromPayment = this.showAuctionValueField();
      if (fromPayment && data.auctionValue != null) this.auctionValue.set(toRawCents(data.auctionValue));
      if (data.commissionPercentage != null) this.commissionPercentage.set(String(data.commissionPercentage));
      if (data.itbiPercentage != null) this.itbiPercentage.set(String(data.itbiPercentage));
      if (data.propertyRegistrationValue != null) this.propertyRegistrationValue.set(toRawCents(data.propertyRegistrationValue));
      if (data.vacatingValue != null) this.vacatingValue.set(toRawCents(data.vacatingValue));
    }, { allowSignalWrites: true });
  }

  auctionValueParsed = computed(() => parseCurrencyPtBr(this.auctionValue()));
  propertyRegistrationParsed = computed(() => parseCurrencyPtBr(this.propertyRegistrationValue()));
  vacatingParsed = computed(() => parseCurrencyPtBr(this.vacatingValue()));

  canNext = computed(() => {
    const fromPayment = this.showAuctionValueField();
    const a = this.auctionValueParsed();
    const c = this.commissionPercentage().trim();
    const i = this.itbiPercentage().trim();
    const p = this.propertyRegistrationParsed();
    const v = this.vacatingParsed();
    const auctionOk = fromPayment ? (a != null && a >= 0) : true;
    return auctionOk && c !== '' && i !== '' && p != null && p >= 0 && v != null && v >= 0;
  });

  voltarLink = computed(() =>
    this.journey.paymentMethod() === 'financed' ? '/financiamento' : '/forma-pagamento'
  );

  toStr(value: string | number | null | undefined): string {
    return value != null && value !== '' ? String(value) : '';
  }

  next(): void {
    const toNum = (s: string) => (s === '' ? null : Number(s.replace(',', '.')));
    const fromPayment = this.showAuctionValueField();
    const auctionValue = fromPayment
      ? this.auctionValueParsed()
      : (this.journey.financingData()?.auctionValue ?? null);
    this.journey.setArrematacaoData({
      auctionValue,
      commissionPercentage: toNum(this.commissionPercentage()),
      itbiPercentage: toNum(this.itbiPercentage()),
      propertyRegistrationValue: this.propertyRegistrationParsed(),
      vacatingValue: this.vacatingParsed(),
    });
    this.router.navigate(['/pos-imissao']);
  }
}
