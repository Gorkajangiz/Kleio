import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { app } from '../firebase.config';
import { getAuth } from 'firebase/auth';
import { Entry } from '../interfaces/entry.interface';
import { CryptoService } from './crypto.service';

@Injectable({ providedIn: 'root' })
export class DiaryService {
  private db = getFirestore(app);
  private auth = getAuth(app);
  private crypto = inject(CryptoService);

  private getUserId() {
    const user = this.auth.currentUser;
    return user?.uid;
  }

  async addEntry(entryText: string, moodNumber: number, date: Date) {
    const uid = this.getUserId();
    const encryptedEntry = await this.crypto.encrypt(entryText);
    const encryptedMood = await this.crypto.encrypt(String(moodNumber));

    return addDoc(collection(this.db, 'entries'), {
      uid,
      date: date,
      entry: encryptedEntry,
      mood: encryptedMood,
    });
  }

  async addEmptyEntry(date: Date) {
    const uid = this.getUserId();
    const encryptedEntry = await this.crypto.encrypt('');
    const encryptedMood = await this.crypto.encrypt('');

    return addDoc(collection(this.db, 'entries'), {
      uid,
      date: date,
      entry: encryptedEntry,
      mood: encryptedMood,
    });
  }

  async editEntry(entry: Entry) {
    if (!entry.id) {
      return;
    }

    const encryptedEntry = await this.crypto.encrypt(entry.entry ?? '');
    const encryptedMood = await this.crypto.encrypt(
      entry.mood != null ? String(entry.mood) : ''
    );

    const entryRef = doc(this.db, 'entries', entry.id);

    return updateDoc(entryRef, {
      entry: encryptedEntry,
      mood: encryptedMood,
    });
  }

  async deleteEntry(id: string): Promise<void> {
    const entryRef = doc(this.db, 'entries', id);
    return deleteDoc(entryRef);
  }

  async getEntries(): Promise<Entry[]> {
    const uid = this.getUserId();

    const entriesRef = collection(this.db, 'entries');

    const q = query(entriesRef, where('uid', '==', uid));

    const result = await getDocs(q);

    const entries: Entry[] = [];

    for (const firestoreDoc of result.docs) {
      const data = firestoreDoc.data();

      const decryptedEntry = await this.crypto.decrypt(data['entry']);

      const decryptedMood = await this.crypto.decrypt(data['mood']);

      entries.push({
        id: firestoreDoc.id,
        uid: data['uid'],
        date: data['date'].toDate(),
        entry: decryptedEntry,
        mood: decryptedMood === '' ? null : Number(decryptedMood),
      });
    }

    return entries;
  }
}
