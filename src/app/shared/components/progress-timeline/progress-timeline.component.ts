import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-progress-timeline',
  standalone: true,
  imports: [],
  templateUrl: './progress-timeline.component.html',
  styleUrl: './progress-timeline.component.css',
})
export class ProgressTimelineComponent {
  currentStep = input.required<number>();
  totalSteps = input.required<number>();
  steps = computed(() => Array.from({ length: this.totalSteps() }, (_, i) => i + 1));
}
