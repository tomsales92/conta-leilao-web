import { Component, inject } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';

@Component({
  selector: 'app-construcao-dialog',
  standalone: true,
  imports: [],
  templateUrl: './construcao-dialog.component.html',
  styleUrl: './construcao-dialog.component.css',
})
export class ConstrucaoDialogComponent {
  readonly dialogRef = inject(DialogRef<void>);

  close(): void {
    this.dialogRef.close();
  }
}
