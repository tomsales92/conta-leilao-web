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

export interface ArrematacaoData {
  auctionValue: number | null;
  commissionPercentage: number | null;
  itbiPercentage: number | null;
  propertyRegistrationValue: number | null;
  vacatingValue: number | null;
}

export interface PosImissaoData {
  condominiumDebt: number | null;
  iptuDebt: number | null;
  renovationValue: number | null;
}

export interface DespesasData {
  propertyHoldMonths: number | null;
  monthlyCondominiumFee: number | null;
  monthlyIptuValue: number | null;
}

export interface VendaData {
  saleValue: number | null;
  brokerCommissionPercentage: number | null;
  incomeTaxPercentage: number | null;
}

export interface JourneyState {
  paymentMethod: PaymentMethodId | null;
  financingData: FinancingData | null;
  arrematacaoData: ArrematacaoData | null;
  posImissaoData: PosImissaoData | null;
  despesasData: DespesasData | null;
  vendaData: VendaData | null;
}

const INITIAL_FINANCING: FinancingData = {
  auctionValue: null,
  modality: 'SAC',
  downPaymentPercentage: null,
  annualInterestRate: null,
  financingMonths: null,
};

const INITIAL_ARREMATACAO: ArrematacaoData = {
  auctionValue: null,
  commissionPercentage: null,
  itbiPercentage: null,
  propertyRegistrationValue: null,
  vacatingValue: null,
};

const INITIAL_POS_IMISSAO: PosImissaoData = {
  condominiumDebt: null,
  iptuDebt: null,
  renovationValue: null,
};

const INITIAL_DESPESAS: DespesasData = {
  propertyHoldMonths: null,
  monthlyCondominiumFee: null,
  monthlyIptuValue: null,
};

const INITIAL_VENDA: VendaData = {
  saleValue: null,
  brokerCommissionPercentage: null,
  incomeTaxPercentage: null,
};

@Injectable({ providedIn: 'root' })
export class JourneyStateService {
  private readonly journeyStartedSignal = signal<boolean>(false);
  private readonly paymentMethodSignal = signal<PaymentMethodId | null>(null);
  private readonly financingDataSignal = signal<FinancingData>({ ...INITIAL_FINANCING });
  private readonly arrematacaoDataSignal = signal<ArrematacaoData>({ ...INITIAL_ARREMATACAO });
  private readonly posImissaoDataSignal = signal<PosImissaoData>({ ...INITIAL_POS_IMISSAO });
  private readonly despesasDataSignal = signal<DespesasData>({ ...INITIAL_DESPESAS });
  private readonly vendaDataSignal = signal<VendaData>({ ...INITIAL_VENDA });

  readonly journeyStarted = this.journeyStartedSignal.asReadonly();

  readonly paymentMethod = this.paymentMethodSignal.asReadonly();
  readonly financingData = this.financingDataSignal.asReadonly();
  readonly arrematacaoData = this.arrematacaoDataSignal.asReadonly();
  readonly posImissaoData = this.posImissaoDataSignal.asReadonly();
  readonly despesasData = this.despesasDataSignal.asReadonly();
  readonly vendaData = this.vendaDataSignal.asReadonly();

  /** Total de steps: 5 para À Vista, 6 para Financiado */
  readonly totalSteps = computed(() => {
    const method = this.paymentMethodSignal();
    return method === 'financed' ? 6 : 5;
  });

  setJourneyStarted(value: boolean): void {
    this.journeyStartedSignal.set(value);
  }

  setPaymentMethod(id: PaymentMethodId): void {
    this.paymentMethodSignal.set(id);
    if (id !== 'financed') {
      this.financingDataSignal.set({ ...INITIAL_FINANCING });
    }
  }

  setFinancingData(data: Partial<FinancingData>): void {
    this.financingDataSignal.update((prev) => ({ ...prev, ...data }));
  }

  setArrematacaoData(data: Partial<ArrematacaoData>): void {
    this.arrematacaoDataSignal.update((prev) => ({ ...prev, ...data }));
  }

  setPosImissaoData(data: Partial<PosImissaoData>): void {
    this.posImissaoDataSignal.update((prev) => ({ ...prev, ...data }));
  }

  setDespesasData(data: Partial<DespesasData>): void {
    this.despesasDataSignal.update((prev) => ({ ...prev, ...data }));
  }

  setVendaData(data: Partial<VendaData>): void {
    this.vendaDataSignal.update((prev) => ({ ...prev, ...data }));
  }

  /**
   * Zera todo o estado da jornada (incluindo journeyStarted).
   * Use ao sair da jornada (onboarding, confirmação no resumo) ou ao iniciar do zero.
   */
  clearAllData(): void {
    this.journeyStartedSignal.set(false);
    this.clearJourneyFormData();
  }

  /**
   * Zera apenas os dados do formulário da jornada, mantendo journeyStarted.
   * Use ao trocar opções dentro da jornada (ex.: forma de pagamento).
   */
  clearJourneyFormData(): void {
    this.paymentMethodSignal.set(null);
    this.financingDataSignal.set({ ...INITIAL_FINANCING });
    this.arrematacaoDataSignal.set({ ...INITIAL_ARREMATACAO });
    this.posImissaoDataSignal.set({ ...INITIAL_POS_IMISSAO });
    this.despesasDataSignal.set({ ...INITIAL_DESPESAS });
    this.vendaDataSignal.set({ ...INITIAL_VENDA });
  }
}
