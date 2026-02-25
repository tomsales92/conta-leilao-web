import { Component, inject } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { DIALOG_DATA } from '@angular/cdk/dialog';

export interface ConfirmExitDialogData {
  title: string;
  message: string;
}

@Component({
  selector: 'app-confirm-exit-dialog',
  standalone: true,
  imports: [],
  templateUrl: './confirm-exit-dialog.component.html',
  styleUrl: './confirm-exit-dialog.component.css',
})
export class ConfirmExitDialogComponent {
  readonly dialogRef = inject(DialogRef<boolean>);
  readonly data = inject<ConfirmExitDialogData>(DIALOG_DATA);

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
