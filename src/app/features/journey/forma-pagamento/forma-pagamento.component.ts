import { Component, inject, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ProgressTimelineComponent } from '../../../shared/components/progress-timeline/progress-timeline.component';
import { JourneyNavButtonsComponent } from '../../../shared/components/journey-nav-buttons/journey-nav-buttons.component';
import { JourneyStateService, type PaymentMethodId } from '../../../core/services/journey-state.service';

@Component({
  selector: 'app-forma-pagamento',
  standalone: true,
  imports: [HeaderComponent, ProgressTimelineComponent, JourneyNavButtonsComponent],
  templateUrl: './forma-pagamento.component.html',
  styleUrl: './forma-pagamento.component.css',
})
export class FormaPagamentoComponent {
  private readonly router = inject(Router);
  private readonly journey = inject(JourneyStateService);

  /** Nesta tela sempre 5 steps (escolha não altera até confirmar). */
  readonly totalSteps = 5;
  readonly currentStep = 1;

  selected = signal<PaymentMethodId | null>(null);

  constructor() {
    effect(() => {
      const method = this.journey.paymentMethod();
      this.selected.set(method);
    }, { allowSignalWrites: true });
  }

  select(id: PaymentMethodId): void {
    this.selected.set(id);
  }

  next(): void {
    const id = this.selected();
    if (!id) return;
    this.journey.setPaymentMethod(id);
    if (id === 'financed') {
      this.router.navigate(['/financiamento']);
    } else {
      this.router.navigate(['/arrematacao']);
    }
  }
}
