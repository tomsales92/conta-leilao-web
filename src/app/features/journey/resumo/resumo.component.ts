import { Component, inject, computed, signal, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ConfirmExitDialogComponent, type ConfirmExitDialogData } from '../../../shared/components/confirm-exit-dialog/confirm-exit-dialog.component';
import { JourneyStateService } from '../../../core/services/journey-state.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  calculateSummary,
  formatCurrency,
  formatPct,
  type CashResult,
  type FinancedResult,
} from '../../../core/utils/summary-calculation.util';

@Component({
  selector: 'app-resumo',
  standalone: true,
  imports: [HeaderComponent],
  templateUrl: './resumo.component.html',
  styleUrl: './resumo.component.css',
})
export class ResumoComponent implements OnInit {
  private readonly journey = inject(JourneyStateService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);

  readonly showDetails = signal(false);

  readonly summary = computed(() => {
    const input = {
      paymentMethod: this.journey.paymentMethod(),
      financingData: this.journey.financingData(),
      arrematacaoData: this.journey.arrematacaoData(),
      posImissaoData: this.journey.posImissaoData(),
      despesasData: this.journey.despesasData(),
      vendaData: this.journey.vendaData(),
    };
    return calculateSummary(input);
  });

  readonly paymentMethodLabel = computed(() => {
    const method = this.journey.paymentMethod();
    const fin = this.journey.financingData();
    if (method === 'financed' && fin?.modality) {
      return `Financiado • ${fin.modality}`;
    }
    return 'À vista';
  });

  readonly isFinanced = computed(() => this.journey.paymentMethod() === 'financed');

  readonly monthsPossession = computed(() => {
    const m = this.journey.despesasData()?.propertyHoldMonths;
    return m ?? 0;
  });

  formatCurrency = formatCurrency;
  formatPct = formatPct;

  private openConfirmExitDialog(): void {
    const data: ConfirmExitDialogData = {
      title: 'Deseja realmente sair?',
      message: 'Se você sair, perderá as informações preenchidas até aqui.',
    };
    const ref = this.dialog.open(ConfirmExitDialogComponent, {
      data,
      panelClass: 'app-confirm-exit-dialog-panel',
      disableClose: false,
    });
    ref.closed.subscribe((result) => {
      if (result === true) {
        this.journey.clearAllData();
        this.router.navigate(['/onboarding'], { replaceUrl: true });
      }
    });
  }

  @HostListener('window:popstate')
  onPopState(): void {
    history.pushState(null, '', window.location.href);
    this.openConfirmExitDialog();
  }

  ngOnInit(): void {
    history.pushState(null, '', window.location.href);
  }

  share(): void {
    const email = this.auth.currentUser()?.email;
    if (!email) {
      alert('Não foi possível obter seu e-mail. Faça login novamente.');
      return;
    }
    const result = this.summary();
    if (!result) {
      alert('Não há dados de resumo para compartilhar.');
      return;
    }
    const body = this.buildShareBody(result);
    const subject = encodeURIComponent('Resumo do investimento - Conta Leilão');
    const bodyEnc = encodeURIComponent(body);
    window.location.href = `mailto:${email}?subject=${subject}&body=${bodyEnc}`;
  }

  private buildShareBody(result: CashResult | FinancedResult): string {
    const lines: string[] = [
      'Resumo do investimento',
      '---',
      `Forma de pagamento: ${this.paymentMethodLabel()}`,
      `Capital investido até a venda: ${formatCurrency(result.totalCosts)}`,
      `Valor real de venda: ${formatCurrency(result.realSaleValue)}`,
      `ROI total: ${formatPct(result.roiTotal)}`,
      `ROI mensal: ${formatPct(result.roiMonthly)}`,
      `Lucro líquido total: ${formatCurrency(result.netProfit)}`,
    ];
    if ('downPayment' in result) {
      lines.push('', 'Entrada:', `Valor da entrada: ${formatCurrency(result.downPayment)}`);
      lines.push('', 'Financiamento:', `Custo do financiamento no período: ${formatCurrency(result.financingCostPeriod)}`);
      lines.push('', 'Saldo devedor:', `Saldo devedor após ${this.monthsPossession()} meses: ${formatCurrency(result.outstandingBalance)}`);
    }
    lines.push('', 'Custos:', `Custos de aquisição: ${formatCurrency(result.acquisitionCosts)}`);
    lines.push('', 'IR:', `IR sobre ganho: ${formatCurrency(result.incomeTax)}`);
    lines.push('', 'Este cálculo é uma estimativa. O cálculo oficial é feito via GCAP (Receita Federal).');
    return lines.join('\n');
  }
}
