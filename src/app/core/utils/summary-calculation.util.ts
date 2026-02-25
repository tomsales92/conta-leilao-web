import type {
  PaymentMethodId,
  FinancingData,
  ArrematacaoData,
  PosImissaoData,
  DespesasData,
  VendaData,
} from '../services/journey-state.service';

export interface SummaryInput {
  paymentMethod: PaymentMethodId | null;
  financingData: FinancingData | null;
  arrematacaoData: ArrematacaoData | null;
  posImissaoData: PosImissaoData | null;
  despesasData: DespesasData | null;
  vendaData: VendaData | null;
}

/** Resultado para cenário à vista */
export interface CashResult {
  downPaymentOrAuction: number;
  acquisitionCosts: number;
  carryingCosts: number;
  totalCosts: number;
  realSaleValue: number;
  netProfit: number;
  roiTotal: number;
  roiMonthly: number;
  brokerCommission: number;
  incomeTax: number;
}

/** Resultado para cenário financiado (SAC ou PRICE) */
export interface FinancedResult extends CashResult {
  downPayment: number;
  financedValue: number;
  financingCostPeriod: number;
  outstandingBalance: number;
}

function pct(rate: number | null | undefined): number {
  if (rate == null) return 0;
  return rate > 1 ? rate / 100 : rate;
}

function num(v: number | null | undefined): number {
  return v ?? 0;
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function monthlyCompoundRoi(roiDecimal: number, months: number): number {
  if (months <= 0) return 0;
  const base = 1 + roiDecimal;
  if (base <= 0) return 0;
  return Math.pow(base, 1 / months) - 1;
}

function monthlyInterestFromAnnual(annualRate: number): number {
  if (annualRate <= 0) return 0;
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/** Custos de aquisição (comissão, ITBI, registro, desocupação, reforma, dívidas) */
function acquisitionCosts(
  auctionValue: number,
  arrematacao: ArrematacaoData,
  posImissao: PosImissaoData
): number {
  let c = 0;
  c += auctionValue * pct(arrematacao.commissionPercentage);
  c += auctionValue * pct(arrematacao.itbiPercentage);
  c += num(arrematacao.propertyRegistrationValue);
  c += num(arrematacao.vacatingValue);
  c += num(posImissao.renovationValue);
  c += num(posImissao.condominiumDebt);
  c += num(posImissao.iptuDebt);
  return c;
}

/** Custos de carrego (condomínio + IPTU mensais × meses) */
function carryingCosts(despesas: DespesasData): number {
  const months = num(despesas.propertyHoldMonths) || 0;
  const cond = num(despesas.monthlyCondominiumFee);
  const iptu = num(despesas.monthlyIptuValue);
  return (cond + iptu) * months;
}

/** Comissão do corretor sobre valor da venda */
function brokerCommission(saleValue: number, venda: VendaData): number {
  const rate = pct(venda.brokerCommissionPercentage);
  return rate ? saleValue * rate : saleValue * 0.06;
}

/** IR do cenário à vista baseado na estrutura da planilha */
function incomeTaxCash(
  saleValue: number,
  brokerComm: number,
  auctionValue: number,
  arrem: ArrematacaoData,
  pos: PosImissaoData,
  venda: VendaData
): number {
  const commissionLeiloeiro = auctionValue * pct(arrem.commissionPercentage);
  const itbi = auctionValue * pct(arrem.itbiPercentage);
  const registro = num(arrem.propertyRegistrationValue);
  const reforma = num(pos.renovationValue);
  const gain = saleValue - brokerComm - (auctionValue + commissionLeiloeiro + itbi + registro + reforma);
  if (gain <= 0) return 0;
  const rate = pct(venda.incomeTaxPercentage) || 0.15;
  return gain * rate;
}

interface FinancingPeriodResult {
  installmentsPaidInPeriod: number;
  outstandingBalance: number;
}

function financingPeriodCost(
  principal: number,
  monthlyRate: number,
  totalMonths: number,
  monthsHeld: number,
  modality: FinancingData['modality']
): FinancingPeriodResult {
  const n = Math.max(1, totalMonths);
  const monthsInPeriod = Math.max(0, Math.min(monthsHeld, n));
  if (principal <= 0 || monthsInPeriod === 0) {
    return { installmentsPaidInPeriod: 0, outstandingBalance: Math.max(0, principal) };
  }

  let outstanding = principal;
  let installmentsPaidInPeriod = 0;

  if (modality === 'PRICE') {
    const payment =
      monthlyRate === 0
        ? principal / n
        : principal * (Math.pow(1 + monthlyRate, n) * monthlyRate) / (Math.pow(1 + monthlyRate, n) - 1);

    for (let t = 1; t <= monthsInPeriod; t++) {
      const interest = outstanding * monthlyRate;
      const amortization = payment - interest;
      installmentsPaidInPeriod += payment;
      outstanding = Math.max(0, outstanding - amortization);
    }
  } else {
    const amortization = principal / n;
    for (let t = 1; t <= monthsInPeriod; t++) {
      const interest = outstanding * monthlyRate;
      const installment = amortization + interest;
      installmentsPaidInPeriod += installment;
      outstanding = Math.max(0, outstanding - amortization);
    }
  }

  return {
    installmentsPaidInPeriod,
    outstandingBalance: outstanding,
  };
}

/** IR do cenário financiado baseado na estrutura da planilha */
function incomeTaxFinanced(
  saleValue: number,
  brokerComm: number,
  installmentsPaidInPeriod: number,
  outstandingBalance: number,
  auctionValue: number,
  arrem: ArrematacaoData,
  pos: PosImissaoData,
  venda: VendaData
): number {
  const commissionLeiloeiro = auctionValue * pct(arrem.commissionPercentage);
  const itbi = auctionValue * pct(arrem.itbiPercentage);
  const registro = num(arrem.propertyRegistrationValue);
  const reforma = num(pos.renovationValue);

  const gain = saleValue - brokerComm - (
    installmentsPaidInPeriod
    + outstandingBalance
    + commissionLeiloeiro
    + itbi
    + registro
    + reforma
  );
  if (gain <= 0) return 0;
  const rate = pct(venda.incomeTaxPercentage) || 0.15;
  return gain * rate;
}

/** Cálculo à vista */
function calculateCash(input: SummaryInput): CashResult | null {
  const auctionValue = input.paymentMethod === 'financed'
    ? num(input.financingData?.auctionValue)
    : num(input.arrematacaoData?.auctionValue);
  const saleValue = num(input.vendaData?.saleValue);
  const months = num(input.despesasData?.propertyHoldMonths) || 0;

  if (
    auctionValue <= 0 ||
    saleValue <= 0 ||
    !input.arrematacaoData ||
    !input.posImissaoData ||
    !input.despesasData ||
    !input.vendaData
  )
    return null;

  const arrem = input.arrematacaoData;
  const pos = input.posImissaoData;
  const despesas = input.despesasData;
  const venda = input.vendaData;

  const acq = acquisitionCosts(auctionValue, arrem, pos);
  const carry = carryingCosts(despesas);
  const totalCosts = auctionValue + acq + carry;
  const broker = brokerCommission(saleValue, venda);
  const ir = incomeTaxCash(saleValue, broker, auctionValue, arrem, pos, venda);
  const realSale = saleValue - broker - ir;
  const netProfit = realSale - totalCosts;
  const roiTotalDecimal = safeRatio(netProfit, totalCosts);
  const roiTotal = roiTotalDecimal * 100;
  const roiMonthly = monthlyCompoundRoi(roiTotalDecimal, months) * 100;

  return {
    downPaymentOrAuction: auctionValue,
    acquisitionCosts: acq,
    carryingCosts: carry,
    totalCosts,
    realSaleValue: realSale,
    netProfit,
    roiTotal,
    roiMonthly,
    brokerCommission: broker,
    incomeTax: ir,
  };
}

/** Cálculo financiado (SAC): entrada, parcelas no período, saldo devedor */
function calculateFinanced(input: SummaryInput): FinancedResult | null {
  const fin = input.financingData;
  if (
    !fin ||
    fin.auctionValue == null ||
    !input.arrematacaoData ||
    !input.posImissaoData ||
    !input.despesasData ||
    !input.vendaData
  )
    return null;

  const auctionValue = fin.auctionValue;
  const saleValue = num(input.vendaData?.saleValue);
  const months = Math.max(0, num(input.despesasData?.propertyHoldMonths));
  const downPct = pct(fin.downPaymentPercentage);
  const annualRate = pct(fin.annualInterestRate);
  const totalMonths = Math.max(1, num(fin.financingMonths));

  const arrem = input.arrematacaoData;
  const pos = input.posImissaoData;
  const despesas = input.despesasData;
  const venda = input.vendaData;

  const downPayment = auctionValue * downPct;
  const V = auctionValue - downPayment;
  const i = monthlyInterestFromAnnual(annualRate);
  const financingPeriod = financingPeriodCost(V, i, totalMonths, months, fin.modality);
  const financingCostPeriod = financingPeriod.installmentsPaidInPeriod;
  const outstandingBalance = financingPeriod.outstandingBalance;
  const acq = acquisitionCosts(auctionValue, arrem, pos);
  const carry = carryingCosts(despesas);
  const totalCosts = acq + carry + financingCostPeriod;
  const broker = brokerCommission(saleValue, venda);
  const ir = incomeTaxFinanced(
    saleValue,
    broker,
    financingCostPeriod,
    outstandingBalance,
    auctionValue,
    arrem,
    pos,
    venda
  );
  const realSale = saleValue - broker - ir - outstandingBalance;
  const netProfit = realSale - totalCosts;
  const roiTotalDecimal = safeRatio(netProfit, totalCosts);
  const roiTotal = roiTotalDecimal * 100;
  const roiMonthly = monthlyCompoundRoi(roiTotalDecimal, months) * 100;

  return {
    downPaymentOrAuction: downPayment,
    downPayment,
    financedValue: V,
    financingCostPeriod,
    outstandingBalance,
    acquisitionCosts: acq,
    carryingCosts: carry,
    totalCosts,
    realSaleValue: realSale,
    netProfit,
    roiTotal,
    roiMonthly,
    brokerCommission: broker,
    incomeTax: ir,
  };
}

export function calculateSummary(input: SummaryInput): CashResult | FinancedResult | null {
  if (input.paymentMethod === 'financed') return calculateFinanced(input);
  return calculateCash(input);
}

/** Formata valor em R$ PT-BR */
export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const [intPart, decPart] = abs.toFixed(2).split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 ? '-' : '';
  return `R$ ${sign}${formatted},${decPart}`;
}

/** Formata percentual */
export function formatPct(value: number): string {
  const str = value.toFixed(2).replace('.', ',');
  const trimmed = str.replace(/,?0+$/, '') || '0';
  return `${trimmed}%`;
}
