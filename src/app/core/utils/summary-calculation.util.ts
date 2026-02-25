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

/** IR sobre ganho de capital (valor real venda - custo fiscal) */
function incomeTax(
  saleValue: number,
  brokerComm: number,
  auctionValue: number,
  acquisitionCostsVal: number,
  venda: VendaData
): number {
  const realSale = saleValue - brokerComm;
  const fiscalCost = auctionValue + acquisitionCostsVal;
  const gain = realSale - fiscalCost;
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
  const ir = incomeTax(saleValue, broker, auctionValue, acq, venda);
  const realSale = saleValue - broker - ir;
  const netProfit = realSale - totalCosts;
  const roiTotal = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0;
  const roiMonthly = months > 0 ? roiTotal / months : 0;

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
  const i = annualRate / 12;
  const n = totalMonths;
  const amortization = V / n;

  let financingCostPeriod = 0;
  for (let t = 1; t <= months && t <= n; t++) {
    const prevBalance = V - amortization * (t - 1);
    const interest = prevBalance * i;
    financingCostPeriod += amortization + interest;
  }

  const outstandingBalance = Math.max(0, V - amortization * months);
  const acq = acquisitionCosts(auctionValue, arrem, pos);
  const carry = carryingCosts(despesas);
  const totalCosts = downPayment + acq + carry + financingCostPeriod;
  const broker = brokerCommission(saleValue, venda);
  const ir = incomeTax(saleValue, broker, auctionValue, acq, venda);
  const realSale = saleValue - broker - ir;
  const netProfit = realSale - totalCosts - outstandingBalance;
  const roiTotal = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0;
  const roiMonthly = months > 0 ? roiTotal / months : 0;

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
