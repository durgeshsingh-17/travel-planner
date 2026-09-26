import { Directive, ElementRef, HostListener, inject } from '@angular/core';

/** Hides an image whose source fails to load instead of showing a broken icon and alt text. */
@Directive({
  selector: 'img[appHideOnError]',
  standalone: true
})
export class HideOnErrorDirective {
  private readonly element = inject<ElementRef<HTMLImageElement>>(ElementRef);

  @HostListener('error')
  protected hide(): void {
    this.element.nativeElement.style.visibility = 'hidden';
  }
}
