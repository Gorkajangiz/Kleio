import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { addDoc, collection, getFirestore } from 'firebase/firestore';
import { app } from '../../firebase.config';
import { DiaryService } from '../../services/diary.service';
import { Entry } from '../../interfaces/entry.interface';
import { frases } from './frases';
import { AuthService } from '../../services/auth.service';
import { PreferencesService } from '../../services/preference.service';
import { CryptoService } from '../../services/crypto.service';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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
  imports: [DatePipe],
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
  private readonly db = getFirestore(app);

  readonly cushyTheme = computed(() => this.prefs.theme() === 'cushy');
  readonly darkMode = computed(() => this.prefs.theme() === 'dark');
  readonly keepSession = computed(() => this.prefs.keepSession());
  readonly userPhotoURL = signal<string | null>(null);
  readonly profileMenuOpen = signal(false);

  get drawerView() { return this.prefs.drawerView(); }

  readonly username = signal('');
  readonly motivPhrase = signal('');

  readonly entries = signal<Entry[]>([]);

  readonly entryText = signal('');
  readonly entryDateISO = signal(this.getTodayISO());
  selectedMood = 0;

  readonly modalEntry = signal<Entry | null>(null);
  readonly editingEntry = signal<Entry | null>(null);
  readonly modalIsNew = signal(false);

  drawerOpen = false;
  readonly visibleMonthCount = signal(CALENDAR_LAZY_BATCH);

  readonly searchQuery = signal('');

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
    await this.auth.waitForAuthReady();
    await this.crypto.restoreKey();
    await this.getEntries();

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

      // Si la clave aún no está disponible (p. ej. el usuario cerró
      // el navegador y sessionStorage se vació), no hay nada que
      // mostrar. Aquí podrías abrir un modal de "desbloquear".
    }
  }

  async onSave() {
    const mood = this.selectedMood;
    const text = this.entryText();
    const dateISO = this.entryDateISO();
    const editing = this.editingEntry();

    if (mood === 0) return;
    if (!editing && this.dateAlreadyHasEntry()) return;

    if (!this.crypto.isUnlocked()) {
      console.error('La clave de cifrado no está desbloqueada.');
      return;
    }

    // ¿Ya existe una entrada (aunque sea la vacía que crea
    // fillMissingDays) para esta fecha? Si sí, editamos esa en
    // lugar de crear una nueva → evita el duplicado.
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
      } else if (existingOnDate) {
        await this.diaryService.editEntry({
          ...existingOnDate,
          entry: text,
          mood,
        });
      } else {
        await this.diaryService.addEntry(text, mood, new Date(dateISO));
      }

      this.entryText.set('');
      this.entryDateISO.set(this.getTodayISO());
      this.selectedMood = 0;

      await this.getEntries();
    } catch (error) {
      console.log(error);
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
    this.modalIsNew.set(false);
    this.modalEntry.set(entry);
  }

  openNewEntryModal(year: number, month: number, day: number) {
    this.modalIsNew.set(true);
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

    this.modalEntry.set(null);
    this.modalIsNew.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEditing() {
    this.editingEntry.set(null);
    this.entryDateISO.set(this.getTodayISO());
    this.entryText.set('');
    this.selectedMood = 0;
  }

  onSearch(value: string) {
    this.searchQuery.set(value);
  }

  onSearchBlur() {
    setTimeout(() => this.searchQuery.set(''), 120);
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

  // ── Preferencias persistentes ────────────────────────
  toggleDarkMode() {
    this.prefs.toggleTheme();
  }

  setDrawerView(view: 'grid' | 'calendar') {
    this.prefs.setDrawerView(view);
  }

  getTodayISO(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  formatDateSpanish(date: Date): string {
    return `${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`;
  }

  moodColor(mood: number | null | undefined): string {
    // Sin mood (día vacío): SIN fondo → se ve el panel del drawer
    if (mood == null || mood <= 0) return 'transparent';

    const m = Math.max(1, Math.min(5, mood));
    const t = m / 5;
    const sat = 30 + t * 60;   // arranca en 30% para que se vea amarillo desde mood 1
    const light = 88 - t * 8;
    return `hsl(50, ${sat}%, ${light}%)`;
  }

  async toggleKeepSession(): Promise<void> {
    const keepSession = !this.prefs.keepSession();

    // Guardamos la preferencia
    this.prefs.setKeepSession(keepSession);

    // Y cambiamos inmediatamente la persistencia de Firebase
    await this.auth.setSessionPersistence(keepSession);
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
  }

  async logout(): Promise<void> {
    this.closeProfileMenu();
    await signOut(this.auth.getAuthInstance());
    await this.router.navigate(['/login']);   // ← tu ruta de login
  }

}
