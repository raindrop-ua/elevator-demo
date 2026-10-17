import { Component, ElementRef, viewChild } from '@angular/core';
import { IconComponent } from '@shared/ui/icon.component';

@Component({
  selector: 'app-help-dialog',
  imports: [IconComponent],
  templateUrl: './help-dialog.component.html',
  styleUrl: './help-dialog.component.css',
})
export class HelpDialogComponent {
  private readonly help = viewChild.required<ElementRef<HTMLDialogElement>>('help');

  open(): void {
    this.help().nativeElement.showModal();
  }

  protected closeHelp(event: MouseEvent): void {
    if (event.target === this.help().nativeElement) this.help().nativeElement.close();
  }
}
