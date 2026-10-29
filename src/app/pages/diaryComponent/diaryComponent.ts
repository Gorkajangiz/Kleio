import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { getFirestore } from 'firebase/firestore';
import { app } from '../../firebase.config';
import { DiaryService } from '../../services/diary.service';
import { Entry } from '../../interfaces/entry.interface';
import { frases } from './frases';
import { AuthService } from '../../services/auth.service';
import { PreferencesService } from '../../services/preference.service';
import { CryptoService } from '../../services/crypto.service';
import { ToastService } from '../../services/toast.service';
import { SpinnerComponent } from '../../components/spinner/spinner.component';
import { onAuthStateChanged } from 'firebase/auth';
import { Router } from '@angular/router';

type CalendarCell =
  | { kind: 'day'; dayNumber: number; hasEntry: boolean; entry: Entry | null }
  | { kind: 'lead' }
  | { kind: 'trail' };

interface CalendarMonth {
  year: number;
  month: number;
  label: string;
  cells: CalendarCell[];
}

interface DatePickerCell {
  year: number;
  month: number;
  day: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  hasEntry: boolean;
}

interface SearchResult {
  entry: Entry;
  before: string;
  match: string;
  after: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const SEARCH_CONTEXT_WORDS = 5;
const CALENDAR_MONTHS_OF_HISTORY = 12;
const CALENDAR_LAZY_BATCH = 3;
const CALENDAR_SCROLL_THRESHOLD = 300;

@Component({
  selector: 'app-diary-component',
  imports: [DatePipe, SpinnerComponent],
  templateUrl: './diaryComponent.html',
  styleUrls: ['./diaryComponent.css', './diaryComponentCushy.css'],
  host: { '[class.cushy-theme]': 'cushyTheme()' },
})
export class DiaryComponent implements OnInit {

  readonly settingsOpen = signal(false);
  private readonly router = inject(Router);

  private readonly prefs = inject(PreferencesService);
  private readonly crypto = inject(CryptoService);
  private readonly diaryService = inject(DiaryService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly db = getFirestore(app);

  readonly cushyTheme = computed(() => this.prefs.theme() === 'cushy');
  readonly darkMode = computed(() => this.prefs.theme() === 'dark');
  readonly userEmail = signal('');
  readonly userPhotoURL = signal<string | null>(null);
  readonly profileMenuOpen = signal(false);

  readonly isLoadingEntries = signal(true);
  readonly isSaving = signal(false);
  readonly isDeleting = signal(false);
  readonly showDeleteConfirm = signal(false);

  get drawerView() { return this.prefs.drawerView(); }

  readonly username = signal('');
  readonly motivPhrase = signal('');

  readonly entries = signal<Entry[]>([]);

  readonly entryText = signal('');
  readonly entryDateISO = signal(this.getTodayISO());
  selectedMood = 0;


  readonly moodDescriptions = ['', 'Muy difícil', 'Difícil', 'Normal', 'Bueno', 'Excelente'];


  readonly datePickerOpen = signal(false);
  readonly pickerYear = signal(new Date().getFullYear());
  readonly pickerMonth = signal(new Date().getMonth());

  readonly modalEntry = signal<Entry | null>(null);
  readonly editingEntry = signal<Entry | null>(null);
  readonly modalIsNew = signal(false);

  drawerOpen = false;
  readonly visibleMonthCount = signal(CALENDAR_LAZY_BATCH);

  readonly searchQuery = signal('');

  readonly charCount = computed(() => this.entryText().length);
  readonly wordCount = computed(() => {
    const text = this.entryText().trim();
    return text ? text.split(/\s+/).length : 0;
  });

  readonly isTodaySelected = computed(() => this.entryDateISO() === this.getTodayISO());

  readonly formattedSelectedDate = computed(() => {
    const iso = this.entryDateISO();
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return `${d} de ${MONTH_NAMES[m - 1]} de ${y}`;
  });

  readonly pickerMonthLabel = computed(() => {
    return `${MONTH_NAMES[this.pickerMonth()]} ${this.pickerYear()}`;
  });

  readonly pickerCells = computed<DatePickerCell[]>(() => {
    const year = this.pickerYear();
    const month = this.pickerMonth();
    const today = new Date();
    const selectedIso = this.entryDateISO();
    const [selY, selM, selD] = selectedIso.split('-').map(Number);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

    const prevMonthDays = new Date(year, month, 0).getDate();

    const entriesSet = new Set(
      this.entries()
        .filter(e => (e.entry ?? '').trim().length > 0)
        .map(e => `${e.date.getFullYear()}-${e.date.getMonth()}-${e.date.getDate()}`)
    );

    const cells: DatePickerCell[] = [];


    for (let i = firstWeekday - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      cells.push({
        year: prevY,
        month: prevM,
        day,
        isCurrentMonth: false,
        isSelected: false,
        isToday: false,
        hasEntry: entriesSet.has(`${prevY}-${prevM}-${day}`),
      });
    }


    for (let day = 1; day <= daysInMonth; day++) {
      const isSel = selY === year && selM === month + 1 && selD === day;
      const isTod =
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === day;

      cells.push({
        year,
        month,
        day,
        isCurrentMonth: true,
        isSelected: isSel,
        isToday: isTod,
        hasEntry: entriesSet.has(`${year}-${month}-${day}`),
      });
    }


    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let day = 1; day <= remaining; day++) {
        const nextM = month === 11 ? 0 : month + 1;
        const nextY = month === 11 ? year + 1 : year;
        cells.push({
          year: nextY,
          month: nextM,
          day,
          isCurrentMonth: false,
          isSelected: false,
          isToday: false,
          hasEntry: entriesSet.has(`${nextY}-${nextM}-${day}`),
        });
      }
    }

    return cells;
  });

  readonly calendarMonths = computed<CalendarMonth[]>(() => this.buildCalendar());
  readonly visibleMonths = computed(() =>
    this.calendarMonths().slice(0, this.visibleMonthCount())
  );
  readonly searchResults = computed<SearchResult[]>(() => this.runSearch(this.searchQuery()));
  readonly dateAlreadyHasEntry = computed(() => {
    const iso = this.entryDateISO();
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return false;

    return this.entries().some(e => {
      const ed = e.date;
      return (
        ed.getFullYear() === y &&
        ed.getMonth() === m - 1 &&
        ed.getDate() === d &&
        (e.entry ?? '').trim().length > 0
      );
    });
  });

  private readonly loggedUser = this.auth.getCurrentUser();

  async ngOnInit() {
    this.isLoadingEntries.set(true);

    try {
      const user = await this.auth.waitForAuthReady();
      this.userEmail.set(user?.email ?? '');
      await this.getEntries();
    } catch (err) {
      console.error('Error inicializando el diario:', err);
      this.toast.error('No se pudieron recuperar tus entradas cifradas.', 'Error de inicialización');
    } finally {
      this.isLoadingEntries.set(false);
    }

    this.motivPhrase.set(frases[Math.floor(Math.random() * frases.length)]);

    onAuthStateChanged(this.auth.getAuthInstance(), user => {
      if (user) {
        this.username.set(user.displayName ?? 'corazón');
        this.userPhotoURL.set(user.photoURL ?? null);
      } else {
        this.username.set('');
        this.userPhotoURL.set(null);
      }
    });
  }

  async getEntries() {
    try {
      const entries = await this.diaryService.getEntries();
      await this.fillMissingDays(entries);

      const updatedEntries = await this.diaryService.getEntries();
      updatedEntries.sort((a, b) => b.date.getTime() - a.date.getTime());

      this.entries.set(updatedEntries);
    } catch (error) {
      console.error('Error obteniendo las entradas:', error);
    }
  }


  toggleDatePicker(event?: Event): void {
    if (this.editingEntry() !== null || this.isSaving()) return;
    if (event) event.stopPropagation();

    if (!this.datePickerOpen()) {
      const [y, m] = this.entryDateISO().split('-').map(Number);
      if (y && m) {
        this.pickerYear.set(y);
        this.pickerMonth.set(m - 1);
      }
      this.datePickerOpen.set(true);
    } else {
      this.datePickerOpen.set(false);
    }
  }

  closeDatePicker(): void {
    this.datePickerOpen.set(false);
  }

  prevPickerMonth(event: Event): void {
    event.stopPropagation();
    if (this.pickerMonth() === 0) {
      this.pickerMonth.set(11);
      this.pickerYear.update(y => y - 1);
    } else {
      this.pickerMonth.update(m => m - 1);
    }
  }

  nextPickerMonth(event: Event): void {
    event.stopPropagation();
    if (this.pickerMonth() === 11) {
      this.pickerMonth.set(0);
      this.pickerYear.update(y => y + 1);
    } else {
      this.pickerMonth.update(m => m + 1);
    }
  }

  selectPickerDate(year: number, month: number, day: number, event?: Event): void {
    if (event) event.stopPropagation();
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    this.entryDateISO.set(iso);
    this.closeDatePicker();
  }

  async onSave(): Promise<void> {
    const mood = this.selectedMood;
    const text = this.entryText().trim();
    const dateISO = this.entryDateISO();
    const editing = this.editingEntry();

    if (mood === 0) {
      this.toast.warning('Por favor selecciona cómo te sientes hoy (de 1 a 5 estrellas).', 'Ánimo requerido');
      return;
    }

    if (!text) {
      this.toast.warning('Escribe unas palabras sobre tu día antes de guardar.', 'Entrada vacía');
      return;
    }

    if (!editing && this.dateAlreadyHasEntry()) {
      this.toast.warning('Ya existe una entrada registrada para esta fecha.', 'Fecha ocupada');
      return;
    }

    if (!this.crypto.isUnlocked()) {
      this.toast.error('La clave de cifrado no está disponible. Inicia sesión nuevamente.', 'Error de cifrado');
      return;
    }

    this.isSaving.set(true);

    const [y, m, d] = dateISO.split('-').map(Number);
    const existingOnDate = this.entries().find(e => {
      const ed = e.date;
      return (
        ed.getFullYear() === y &&
        ed.getMonth() === m - 1 &&
        ed.getDate() === d
      );
    });

    try {
      if (editing) {
        await this.diaryService.editEntry({ ...editing, entry: text, mood });
        this.editingEntry.set(null);
        this.toast.success('Entrada actualizada correctamente.', 'Guardado');
      } else if (existingOnDate) {
        await this.diaryService.editEntry({
          ...existingOnDate,
          entry: text,
          mood,
        });
        this.toast.success('Entrada actualizada correctamente.', 'Guardado');
      } else {
        await this.diaryService.addEntry(text, mood, new Date(dateISO));
        this.toast.success('¡Tu entrada del día se ha guardado con éxito!', 'Día registrado');
      }

      this.entryText.set('');
      this.entryDateISO.set(this.getTodayISO());
      this.selectedMood = 0;

      await this.getEntries();
    } catch (error) {
      console.error('Error al guardar:', error);
      this.toast.error('Ocurrió un error al guardar tu entrada.', 'Error al guardar');
    } finally {
      this.isSaving.set(false);
    }
  }

  private async fillMissingDays(entries: Entry[]) {
    if (entries.length === 0) return;

    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    const firstEntry = entries[0];
    const currentDate = new Date(
      firstEntry.date.getFullYear(),
      firstEntry.date.getMonth(),
      firstEntry.date.getDate()
    );
    const today = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    );

    const existingDates = new Set(
      entries.map(e =>
        `${e.date.getFullYear()}-${e.date.getMonth()}-${e.date.getDate()}`
      )
    );

    const promises: Promise<unknown>[] = [];
    currentDate.setDate(currentDate.getDate() + 1);

    while (currentDate < today) {
      const key = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`;
      if (!existingDates.has(key)) {
        promises.push(this.diaryService.addEmptyEntry(new Date(currentDate)));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    await Promise.all(promises);
  }

  makeshift(entry: Entry) {
    this.drawerOpen = false;
    this.modalIsNew.set(false);
    this.showDeleteConfirm.set(false);
    this.modalEntry.set(entry);
  }

  openNewEntryModal(year: number, month: number, day: number) {
    this.drawerOpen = false;
    this.modalIsNew.set(true);
    this.showDeleteConfirm.set(false);
    this.modalEntry.set({
      id: '',
      uid: '',
      date: new Date(year, month, day),
      entry: '',
      mood: null,
    });
  }

  closeEntryModal() {
    this.modalEntry.set(null);
    this.modalIsNew.set(false);
    this.showDeleteConfirm.set(false);
  }

  startEditingEntry() {
    const entry = this.modalEntry();
    if (!entry) return;

    const d = entry.date;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    this.entryDateISO.set(iso);
    this.entryText.set(entry.entry ?? '');
    this.selectedMood = entry.mood ?? 0;
    this.editingEntry.set(this.modalIsNew() ? null : entry);

    this.closeEntryModal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEditing() {
    this.editingEntry.set(null);
    this.entryDateISO.set(this.getTodayISO());
    this.entryText.set('');
    this.selectedMood = 0;
    this.toast.info('Edición cancelada');
  }

  async confirmDeleteEntry(): Promise<void> {
    const entry = this.modalEntry();
    if (!entry?.id) return;

    this.isDeleting.set(true);
    try {
      await this.diaryService.deleteEntry(entry.id);
      this.entries.update(list => list.filter(e => e.id !== entry.id));
      this.toast.success('Entrada eliminada correctamente.', 'Entrada eliminada');
      this.closeEntryModal();
    } catch (error) {
      console.error('Error al eliminar la entrada:', error);
      this.toast.error('No se pudo eliminar la entrada.', 'Error al eliminar');
    } finally {
      this.isDeleting.set(false);
      this.showDeleteConfirm.set(false);
    }
  }

  resetToToday(): void {
    const todayISO = this.getTodayISO();
    this.entryDateISO.set(todayISO);
    const [y, m] = todayISO.split('-').map(Number);
    if (y && m) {
      this.pickerYear.set(y);
      this.pickerMonth.set(m - 1);
    }
    this.toast.info('Fecha restablecida a hoy');
  }

  onSearch(value: string) {
    this.searchQuery.set(value);
  }

  onSearchBlur() {
    setTimeout(() => this.searchQuery.set(''), 150);
  }

  selectSearchResult(entry: Entry) {
    this.searchQuery.set('');
    this.makeshift(entry);
  }

  private runSearch(query: string): SearchResult[] {
    const q = query.trim();
    if (!q) return [];

    const results: SearchResult[] = [];
    for (const entry of this.entries()) {
      const text = entry.entry ?? '';
      if (!text) continue;
      const snippet = this.buildSnippet(text, q);
      if (snippet) results.push({ entry, ...snippet });
    }
    return results;
  }

  private buildSnippet(
    text: string,
    query: string
  ): { before: string; match: string; after: string } | null {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return null;

    const wordsBefore = text.slice(0, idx).trim().split(/\s+/).filter(Boolean);
    const wordsAfter = text.slice(idx + query.length).trim().split(/\s+/).filter(Boolean);

    const hasMoreBefore = wordsBefore.length > SEARCH_CONTEXT_WORDS;
    const hasMoreAfter = wordsAfter.length > SEARCH_CONTEXT_WORDS;

    const beforeWords = wordsBefore.slice(-SEARCH_CONTEXT_WORDS);
    const afterWords = wordsAfter.slice(0, SEARCH_CONTEXT_WORDS);

    const before = (hasMoreBefore ? '…' : '') +
      (beforeWords.length ? beforeWords.join(' ') + ' ' : '');
    const match = text.slice(idx, idx + query.length);
    const after = (afterWords.length ? ' ' + afterWords.join(' ') : '') +
      (hasMoreAfter ? '…' : '');

    return { before, match, after };
  }

  onCalendarScroll(event: Event) {
    const el = event.target as HTMLElement;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < CALENDAR_SCROLL_THRESHOLD;

    if (nearBottom && this.visibleMonthCount() < this.calendarMonths().length) {
      this.visibleMonthCount.update(n => n + CALENDAR_LAZY_BATCH);
    }
  }

  private buildCalendar(): CalendarMonth[] {
    const allEntries = this.entries();
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), 1);

    const historyStart = new Date(
      today.getFullYear(),
      today.getMonth() - CALENDAR_MONTHS_OF_HISTORY,
      1
    );

    let start = historyStart;
    const entriesByDate = new Map<string, Entry>();

    if (allEntries.length > 0) {
      const sorted = [...allEntries].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );
      const earliest = sorted[0].date;
      const earliestMonth = new Date(earliest.getFullYear(), earliest.getMonth(), 1);

      if (earliestMonth < historyStart) start = earliestMonth;

      for (const entry of allEntries) {
        const d = entry.date;
        const text = entry.entry ?? '';
        if (text.trim().length > 0) {
          entriesByDate.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, entry);
        }
      }
    }

    const months: CalendarMonth[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

      const cells: CalendarCell[] = [];
      for (let i = 0; i < firstWeekday; i++) cells.push({ kind: 'lead' });

      for (let day = 1; day <= daysInMonth; day++) {
        const entry = entriesByDate.get(`${year}-${month}-${day}`) ?? null;
        cells.push({ kind: 'day', dayNumber: day, hasEntry: entry !== null, entry });
      }

      while (cells.length % 7 !== 0) cells.push({ kind: 'trail' });

      months.push({ year, month, label: `${MONTH_NAMES[month]} ${year}`, cells });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    months.reverse();
    return months;
  }

  openSettings() {
    this.settingsOpen.set(true);
  }

  closeSettings() {
    this.settingsOpen.set(false);
  }


  toggleDarkMode() {
    this.prefs.toggleTheme();
    const next = this.prefs.theme();
    this.toast.info(
      next === 'cushy' ? 'Tema claro (Cushy) activado.' : 'Modo oscuro activado.',
      'Tema actualizado'
    );
  }

  setDrawerView(view: 'grid' | 'calendar') {
    this.prefs.setDrawerView(view);
    this.toast.info(
      view === 'grid' ? 'Vista de cuadrícula seleccionada.' : 'Vista de calendario seleccionada.',
      'Vista actualizada'
    );
  }

  getTodayISO(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  formatDateSpanish(date: Date): string {
    return `${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`;
  }

  moodColor(mood: number | null | undefined): string {
    if (mood == null || mood <= 0) return 'transparent';

    const m = Math.max(1, Math.min(5, mood));
    const t = m / 5;
    const sat = 30 + t * 60;
    const light = 88 - t * 8;
    return `hsl(50, ${sat}%, ${light}%)`;
  }

  async changePin(): Promise<void> {
    this.closeSettings();
    await this.router.navigate(['/pin-setup']);
  }

  async lockNow(): Promise<void> {
    this.crypto.lock();
    this.closeSettings();
    await this.router.navigate(['/unlock']);
  }

  toggleProfileMenu() {
    this.profileMenuOpen.update(v => !v);
  }

  closeProfileMenu() {
    this.profileMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.profile-menu-wrapper')) {
      this.closeProfileMenu();
    }
    if (!target?.closest('.date-wrapper')) {
      this.closeDatePicker();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.datePickerOpen()) {
        this.closeDatePicker();
        return;
      }
      if (this.settingsOpen()) {
        this.closeSettings();
        return;
      }
      if (this.modalEntry()) {
        this.closeEntryModal();
        return;
      }
      if (this.profileMenuOpen()) {
        this.closeProfileMenu();
        return;
      }
      if (this.drawerOpen) {
        this.drawerOpen = false;
        return;
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      if (!this.isLoadingEntries() && !this.isSaving()) {
        event.preventDefault();
        this.onSave();
      }
    }
  }

  async logout(): Promise<void> {
    this.closeProfileMenu();
    try {
      await this.auth.logout();
      this.toast.info('Has cerrado sesión correctamente.', 'Hasta pronto');
      await this.router.navigate(['/login']);
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
      this.toast.error('Error al cerrar sesión.');
    }
  }

}
