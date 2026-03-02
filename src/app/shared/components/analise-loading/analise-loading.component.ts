import { Component, Input, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';

const PHRASE_WAIT = 'Isso pode demorar alguns minutos.';

@Component({
  selector: 'app-analise-loading',
  standalone: true,
  imports: [],
  templateUrl: './analise-loading.component.html',
  styleUrl: './analise-loading.component.css',
})
export class AnaliseLoadingComponent implements OnInit, OnDestroy {
  @Input() message = 'Analisando matrícula';

  protected displayText = '';

  private readonly cdr = inject(ChangeDetectorRef);
  private showWaitPhrase = false;
  private dotCount = 0;
  private dotsInterval: ReturnType<typeof setInterval> | null = null;
  private phraseInterval: ReturnType<typeof setInterval> | null = null;

  private refreshDisplay(): void {
    this.displayText = this.showWaitPhrase
      ? PHRASE_WAIT
      : this.message + '.'.repeat(this.dotCount);
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.refreshDisplay();
    this.dotsInterval = setInterval(() => {
      this.dotCount = (this.dotCount + 1) % 4;
      if (!this.showWaitPhrase) this.displayText = this.message + '.'.repeat(this.dotCount);
      this.cdr.markForCheck();
    }, 400);
    this.phraseInterval = setInterval(() => {
      this.showWaitPhrase = !this.showWaitPhrase;
      this.refreshDisplay();
    }, 3000);
  }

  ngOnDestroy(): void {
    if (this.dotsInterval) clearInterval(this.dotsInterval);
    if (this.phraseInterval) clearInterval(this.phraseInterval);
  }
}
