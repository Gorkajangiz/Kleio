import { Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  imports: [],
  template: `
    <span
      class="spinner-wrapper"
      [class.spinner--sm]="size() === 'sm'"
      [class.spinner--md]="size() === 'md'"
      [class.spinner--lg]="size() === 'lg'"
      role="status"
      [attr.aria-label]="label() || 'Cargando...'"
    >
      <svg class="spinner-svg" viewBox="0 0 50 50">
        <circle class="spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
      </svg>
      @if (label()) {
        <span class="spinner-label">{{ label() }}</span>
      }
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
    }

    .spinner-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .spinner-svg {
      animation: rotate 1.4s linear infinite;
      transform-origin: center center;
    }

    .spinner-path {
      stroke: currentColor;
      stroke-linecap: round;
      animation: dash 1.4s ease-in-out infinite;
    }

    .spinner--sm .spinner-svg {
      width: 16px;
      height: 16px;
    }

    .spinner--md .spinner-svg {
      width: 24px;
      height: 24px;
    }

    .spinner--lg .spinner-svg {
      width: 42px;
      height: 42px;
    }

    .spinner-label {
      font-size: 14px;
      color: inherit;
      font-weight: 500;
    }

    @keyframes rotate {
      100% {
        transform: rotate(360deg);
      }
    }

    @keyframes dash {
      0% {
        stroke-dasharray: 1, 150;
        stroke-dashoffset: 0;
      }
      50% {
        stroke-dasharray: 90, 150;
        stroke-dashoffset: -35;
      }
      100% {
        stroke-dasharray: 90, 150;
        stroke-dashoffset: -124;
      }
    }
  `]
})
export class SpinnerComponent {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly label = input<string>('');
}

