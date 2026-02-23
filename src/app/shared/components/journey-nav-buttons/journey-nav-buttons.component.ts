import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-journey-nav-buttons',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './journey-nav-buttons.component.html',
  styleUrl: './journey-nav-buttons.component.css',
})
export class JourneyNavButtonsComponent {
  /** Link para o botão Voltar (ex: '/onboarding'). Se não informado, Voltar não é exibido. */
  voltarLink = input<string | null>(null);

  /** Rótulo do botão Próximo. */
  proximoLabel = input<string>('Próximo');

  /** Se o botão Próximo está desabilitado. */
  proximoDisabled = input<boolean>(false);

  /** Emitido ao clicar em Próximo (use em vez de submit quando não for form). */
  proximo = output<void>();

  /** Tipo do botão Próximo: 'button' ou 'submit'. */
  proximoType = input<'button' | 'submit'>('button');

  onProximo(): void {
    this.proximo.emit();
  }
}
