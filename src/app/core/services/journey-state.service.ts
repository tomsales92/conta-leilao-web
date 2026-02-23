import { Injectable, signal, computed } from '@angular/core';

export type PaymentMethodId = 'cash' | 'financed';

export type FinancingModality = 'SAC' | 'PRICE';

export interface FinancingData {
  auctionValue: number | null;
  modality: FinancingModality;
  downPaymentPercentage: number | null;
  annualInterestRate: number | null;
  financingMonths: number | null;
}

export interface JourneyState {
  paymentMethod: PaymentMethodId | null;
  financingData: FinancingData | null;
}

const INITIAL_FINANCING: FinancingData = {
  auctionValue: null,
  modality: 'SAC',
  downPaymentPercentage: null,
  annualInterestRate: null,
  financingMonths: null,
};

@Injectable({ providedIn: 'root' })
export class JourneyStateService {
  private readonly paymentMethodSignal = signal<PaymentMethodId | null>(null);
  private readonly financingDataSignal = signal<FinancingData>({ ...INITIAL_FINANCING });

  readonly paymentMethod = this.paymentMethodSignal.asReadonly();
  readonly financingData = this.financingDataSignal.asReadonly();

  /** Total de steps: 5 para À Vista, 6 para Financiado */
  readonly totalSteps = computed(() => {
    const method = this.paymentMethodSignal();
    return method === 'financed' ? 6 : 5;
  });

  setPaymentMethod(id: PaymentMethodId): void {
    this.paymentMethodSignal.set(id);
    if (id !== 'financed') {
      this.financingDataSignal.set({ ...INITIAL_FINANCING });
    }
  }

  setFinancingData(data: Partial<FinancingData>): void {
    this.financingDataSignal.update((prev) => ({ ...prev, ...data }));
  }

  clearAllData(): void {
    this.paymentMethodSignal.set(null);
    this.financingDataSignal.set({ ...INITIAL_FINANCING });
  }
}
