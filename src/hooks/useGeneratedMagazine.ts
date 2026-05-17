// src/hooks/useGeneratedMagazine.ts
// Persists generated magazine state to IndexedDB.
// Survives tab crashes, network drops, and accidental closes.

import { useState, useEffect, useCallback } from 'react';

const DB_NAME    = 'magznmaker_generated';
const STORE_NAME = 'magazine_state';
const TTL_MS     = 24 * 60 * 60 * 1000; // 24 hours

export interface GeneratedPage {
  pageNumber:      number;
  title:           string;
  layoutType:      string;
  layout_json:     any;
  visualMetaphor:  string | null;
  textValues:      Record<string, string>;
  modelPhotoUrls:  Record<string, string>; // slotId → url
  userPhotoUrls:   Record<string, string>; // slotId → url (user uploads)
  maskUrl:         string | null;
  palette:         Record<string, string> | null;
  fontCombo:       Record<string, string> | null;
  background:      string | null;
}

export interface GeneratedMagazineState {
  sessionId:     string;
  savedAt:       number;
  magazineTitle: string;
  tagline:       string;
  brief:         any;
  pages:         GeneratedPage[];
}

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function saveToDb(state: GeneratedMagazineState) {
  const db    = await openDb();
  const tx    = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put(state);
}

async function loadFromDb(sessionId: string): Promise<GeneratedMagazineState | null> {
  const db    = await openDb();
  const tx    = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.get(sessionId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

async function loadLatestFromDb(): Promise<GeneratedMagazineState | null> {
  const db    = await openDb();
  const tx    = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const now   = Date.now();
  return new Promise((resolve, reject) => {
    const items: GeneratedMagazineState[] = [];
    const cursor = store.openCursor();
    cursor.onsuccess = (e) => {
      const c = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (c) {
        if (now - c.value.savedAt < TTL_MS) items.push(c.value);
        c.continue();
      } else {
        // Return most recent
        items.sort((a, b) => b.savedAt - a.savedAt);
        resolve(items[0] ?? null);
      }
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

async function deleteFromDb(sessionId: string) {
  const db    = await openDb();
  const tx    = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(sessionId);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGeneratedMagazine() {
  const [state,     setState]     = useState<GeneratedMagazineState | null>(null);
  const [sessionId, setSessionId] = useState<string>(() =>
    `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  );
  const [hasRestore, setHasRestore] = useState(false);
  const [restoreData, setRestoreData] = useState<GeneratedMagazineState | null>(null);

  // Check for restorable state on mount
  useEffect(() => {
    loadLatestFromDb().then(saved => {
      if (saved && Date.now() - saved.savedAt < TTL_MS) {
        setHasRestore(true);
        setRestoreData(saved);
      }
    }).catch(() => {});
  }, []);

  // Auto-save whenever state changes
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => {
      saveToDb({ ...state, savedAt: Date.now() }).catch(() => {});
    }, 800); // debounce 800ms
    return () => clearTimeout(t);
  }, [state]);

  const initSession = useCallback((initial: Omit<GeneratedMagazineState, 'sessionId' | 'savedAt'>) => {
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setSessionId(id);
    const full: GeneratedMagazineState = { ...initial, sessionId: id, savedAt: Date.now() };
    setState(full);
    return full;
  }, []);

  const updatePage = useCallback((pageNumber: number, updates: Partial<GeneratedPage>) => {
    setState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        savedAt: Date.now(),
        pages: prev.pages.map(p =>
          p.pageNumber === pageNumber ? { ...p, ...updates } : p
        ),
      };
    });
  }, []);

  const setUserPhoto = useCallback((pageNumber: number, slotId: string, url: string) => {
    setState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        savedAt: Date.now(),
        pages: prev.pages.map(p =>
          p.pageNumber === pageNumber
            ? { ...p, userPhotoUrls: { ...p.userPhotoUrls, [slotId]: url } }
            : p
        ),
      };
    });
  }, []);

  const setTextValue = useCallback((pageNumber: number, fieldId: string, value: string) => {
    setState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        savedAt: Date.now(),
        pages: prev.pages.map(p =>
          p.pageNumber === pageNumber
            ? { ...p, textValues: { ...p.textValues, [fieldId]: value } }
            : p
        ),
      };
    });
  }, []);

  const applyBulkPhotos = useCallback((urls: string[]) => {
    setState(prev => {
      if (!prev || !urls.length) return prev;
      let urlIdx = 0;
      const pages = prev.pages.map(p => {
        const slots = Object.keys(p.modelPhotoUrls);
        if (!slots.length) return p;
        const userPhotoUrls = { ...p.userPhotoUrls };
        slots.forEach(slotId => {
          userPhotoUrls[slotId] = urls[urlIdx % urls.length];
          urlIdx++;
        });
        return { ...p, userPhotoUrls };
      });
      return { ...prev, savedAt: Date.now(), pages };
    });
  }, []);

  const restore = useCallback(() => {
    if (restoreData) {
      setState(restoreData);
      setSessionId(restoreData.sessionId);
      setHasRestore(false);
    }
  }, [restoreData]);

  const dismiss = useCallback(() => {
    if (restoreData) deleteFromDb(restoreData.sessionId).catch(() => {});
    setHasRestore(false);
    setRestoreData(null);
  }, [restoreData]);

  const clear = useCallback(() => {
    if (state) deleteFromDb(state.sessionId).catch(() => {});
    setState(null);
  }, [state]);

  return {
    state, sessionId, hasRestore,
    initSession, updatePage, setUserPhoto,
    setTextValue, applyBulkPhotos,
    restore, dismiss, clear,
  };
}