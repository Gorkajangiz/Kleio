import {
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App as CapApp } from '@capacitor/app';
import { PlatformService } from '../../services/platform.service';

@Component({
  selector: 'app-android-shell',
  standalone: true,
  template: `
    @if (isDiaryPage()) {
      <!-- Backdrop oscuro al desplegar la persiana -->
      @if (isOpen()) {
        <div class="persiana-backdrop" (click)="closePersiana()"></div>
      }

      <!-- Cajón tipo persiana nativo de Android -->
      <aside
        class="persiana-container"
        [class.persiana-container--open]="isOpen()"
        (touchstart)="onTouchStart($event)"
        (touchend)="onTouchEnd($event)"
      >
        <!-- Tirador / Botón con flecha estilo persiana -->
        <button
          type="button"
          class="persiana-handle-btn"
          (click)="togglePersiana()"
          [attr.aria-expanded]="isOpen()"
          aria-label="Desplegar o cerrar persiana de entradas"
        >
          <span class="persiana-notch"></span>
          <div class="persiana-handle-row">
            <svg
              class="persiana-chevron"
              [class.persiana-chevron--down]="isOpen()"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
            <span class="persiana-tab-title">
              {{ isOpen() ? 'Cerrar entradas' : 'Entradas registradas' }}
            </span>
          </div>
        </button>

        <!-- Contenedor del panel de entradas que se desliza como persiana -->
        <div class="persiana-body" #sheetContainer>
          <!-- El .drawer-panel de DiaryComponent se traslada aquí automáticamente -->
        </div>
      </aside>
    }
  `,
  styles: [`
    :host {
      display: block;
    }

    /* ── Backdrop difuminado ────────────────────────────── */
    .persiana-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      z-index: 600;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      animation: fadeIn 200ms ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* ── Contenedor persiana ────────────────────────────── */
    .persiana-container {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: 72vh;
      max-height: 75vh;
      z-index: 601;
      display: flex;
      flex-direction: column;
      background: var(--surface-raised, #221e20);
      border-top: 1px solid var(--border, #3a2e31);
      border-radius: 22px 22px 0 0;
      box-shadow: 0 -6px 28px rgba(0, 0, 0, 0.55);
      /* Cerrada: solo asoma la pestaña con la flecha (44px) */
      transform: translateY(calc(100% - 44px));
      transition: transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1);
      will-change: transform;
    }

    .persiana-container--open {
      transform: translateY(0);
      box-shadow: 0 -8px 36px rgba(0, 0, 0, 0.7);
    }

    /* ── Botón tirador con flecha ───────────────────────── */
    .persiana-handle-btn {
      width: 100%;
      height: 44px;
      min-height: 44px;
      background: transparent;
      border: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      padding: 4px 16px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      flex-shrink: 0;
    }

    .persiana-notch {
      width: 38px;
      height: 3.5px;
      border-radius: 2px;
      background: var(--border-focus, #7b2d3e);
      opacity: 0.85;
      transition: background var(--trans, 200ms ease);
    }

    .persiana-handle-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .persiana-chevron {
      width: 16px;
      height: 16px;
      color: var(--garnet-light, #a03b50);
      transition: transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
      transform: rotate(0deg); /* Flecha hacia arriba ▲ */
    }

    .persiana-chevron--down {
      transform: rotate(180deg); /* Flecha hacia abajo ▼ */
    }

    .persiana-tab-title {
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-secondary, #9e8a8e);
    }

    /* ── Cuerpo deslizable ──────────────────────────────── */
    .persiana-body {
      flex: 1;
      min-height: 0;
      width: 100%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: inherit;
      padding-bottom: env(safe-area-inset-bottom);
    }

    /* ── Cushy theme adaptación de colores ─────────────── */
    :host-context(.cushy-theme) .persiana-container {
      background: #ffffff;
      border-top: 1px solid #e2e8df;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
    }

    :host-context(.cushy-theme) .persiana-notch {
      background: var(--garnet, #7fb685);
    }

    :host-context(.cushy-theme) .persiana-chevron {
      color: var(--garnet, #7fb685);
    }

    :host-context(.cushy-theme) .persiana-tab-title {
      color: var(--text-secondary, #636e72);
    }
  `],
})
export class AndroidShellComponent implements OnInit, OnDestroy {
  private readonly platform = inject(PlatformService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  readonly sheetContainer = viewChild<ElementRef<HTMLDivElement>>('sheetContainer');

  readonly isDiaryPage = signal(false);
  readonly isOpen = signal(false);

  private domObserver?: MutationObserver;
  private routerSub?: any;
  private backButtonListener?: any;
  private movedPanel: HTMLElement | null = null;

  private touchStartY = 0;

  async ngOnInit() {
    if (!this.platform.isAndroid) return;

    this.checkCurrentRoute(this.router.url);

    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.checkCurrentRoute(event.urlAfterRedirects || event.url);
      });

    // Observer para mover el .drawer-panel de la página al cajón persiana
    this.domObserver = new MutationObserver(() => {
      this.attachDrawerPanel();
    });
    this.domObserver.observe(document.body, { childList: true, subtree: true });

    this.attachDrawerPanel();

    // Manejo del botón atrás físico de Android
    try {
      this.backButtonListener = await CapApp.addListener('backButton', () => {
        // 1. Si la persiana está abierta, cerrarla
        if (this.isOpen()) {
          this.closePersiana();
          return;
        }

        // 2. Si hay un modal abierto (detalle o ajustes), cerrarlo
        const modalClose = document.querySelector<HTMLButtonElement>(
          '.entry-modal-close, .settings-modal-close'
        );
        if (modalClose) {
          modalClose.click();
          return;
        }

        // 3. En caso contrario, retroceder en el historial
        this.location.back();
      });
    } catch {
      // Entorno no nativo
    }
  }

  ngOnDestroy() {
    if (this.routerSub) this.routerSub.unsubscribe();
    if (this.domObserver) this.domObserver.disconnect();
    if (this.backButtonListener) {
      this.backButtonListener.remove();
    }
  }

  async togglePersiana() {
    const newState = !this.isOpen();
    this.isOpen.set(newState);
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Ignorar
    }
  }

  async closePersiana() {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Ignorar
    }
  }

  async openPersiana() {
    if (this.isOpen()) return;
    this.isOpen.set(true);
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Ignorar
    }
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent) {
    const touchEndY = event.changedTouches[0].clientY;
    const diff = this.touchStartY - touchEndY;

    // Swipe hacia arriba (diff > 40px)
    if (diff > 40 && !this.isOpen()) {
      this.openPersiana();
    }
    // Swipe hacia abajo (diff < -40px)
    else if (diff < -40 && this.isOpen()) {
      this.closePersiana();
    }
  }

  private checkCurrentRoute(url: string) {
    const isDiario = url.includes('diario');
    this.isDiaryPage.set(isDiario);
    if (isDiario) {
      setTimeout(() => this.attachDrawerPanel(), 100);
    } else {
      this.isOpen.set(false);
    }
  }

  private attachDrawerPanel() {
    if (!this.isDiaryPage()) return;
    const container = this.sheetContainer()?.nativeElement;
    if (!container) return;

    const panel = document.querySelector<HTMLElement>('.drawer-shell .drawer-panel');
    if (panel && panel !== this.movedPanel) {
      this.movedPanel = panel;
      container.innerHTML = '';
      container.appendChild(panel);
    }
  }
}
