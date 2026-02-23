import { Component, inject, computed } from '@angular/core';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ProgressTimelineComponent } from '../../../shared/components/progress-timeline/progress-timeline.component';
import { JourneyStateService } from '../../../core/services/journey-state.service';

@Component({
  selector: 'app-arrematacao',
  standalone: true,
  imports: [HeaderComponent, ProgressTimelineComponent],
  templateUrl: './arrematacao.component.html',
  styleUrl: './arrematacao.component.css',
})
export class ArrematacaoComponent {
  private readonly journey = inject(JourneyStateService);

  readonly paymentMethod = this.journey.paymentMethod;
  readonly totalSteps = this.journey.totalSteps;
  /** À vista: passo 2; Financiado: passo 3. */
  readonly currentStep = computed(() =>
    this.journey.paymentMethod() === 'financed' ? 3 : 2
  );
}
