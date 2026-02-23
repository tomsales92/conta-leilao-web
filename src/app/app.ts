import { ChangeDetectorRef, Component, inject, OnInit, OnDestroy } from '@angular/core';
import { NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

const MIN_LOADING_MS = 400;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private sub: ReturnType<typeof this.router.events.subscribe> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private loadingStartAt = 0;

  protected loading = false;

  ngOnInit(): void {
    this.sub = this.router.events
      .pipe(
        filter(
          (e) =>
            e instanceof NavigationStart ||
            e instanceof NavigationEnd ||
            e instanceof NavigationError
        )
      )
      .subscribe((e) => {
        if (e instanceof NavigationStart) {
          if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
          }
          this.loading = true;
          this.loadingStartAt = Date.now();
          this.cdr.detectChanges();
        } else {
          if (this.hideTimer) clearTimeout(this.hideTimer);
          const elapsed = Date.now() - this.loadingStartAt;
          const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
          this.hideTimer = setTimeout(() => {
            this.loading = false;
            this.hideTimer = null;
            this.cdr.detectChanges();
          }, remaining);
        }
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.hideTimer) clearTimeout(this.hideTimer);
  }
}
