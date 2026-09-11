import { SAVE_KEY, SAVE_BACKUP_KEY, SAVE_VERSION } from '../constants';
import { createDefaultSave, mergeWithDefaults, type SaveData } from '../core/GameState';

/**
 * Versioned localStorage persistence. Loading always deep-merges onto fresh
 * defaults so new fields added in later versions never crash an old save.
 * Corrupt JSON is preserved under a backup key rather than silently discarded.
 */
export class SaveSystem {
    private pendingSave = false;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    load(): SaveData {
        const raw = safeGetItem(SAVE_KEY);
        if (!raw) return createDefaultSave();
        try {
            const parsed = JSON.parse(raw) as Partial<SaveData>;
            const migrated = this.migrate(parsed);
            return mergeWithDefaults(migrated);
        } catch (err) {
            console.warn('[SaveSystem] Corrupt save detected, backing up and starting fresh.', err);
            safeSetItem(SAVE_BACKUP_KEY, raw);
            return createDefaultSave();
        }
    }

    private migrate(data: Partial<SaveData>): Partial<SaveData> {
        // Placeholder for future version migrations. Currently only v1 exists.
        if (!data.version || data.version < SAVE_VERSION) {
            data.version = SAVE_VERSION;
        }
        return data;
    }

    /** Saves immediately (used on visibility change / before unload). */
    saveNow(data: SaveData): void {
        data.lastSavedAt = Date.now();
        safeSetItem(SAVE_KEY, JSON.stringify(data));
        this.pendingSave = false;
    }

    /** Debounced save -- call after any meaningful state change. */
    requestSave(getData: () => SaveData, delayMs = 400): void {
        this.pendingSave = true;
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            if (this.pendingSave) this.saveNow(getData());
        }, delayMs);
    }

    hasPendingSave(): boolean {
        return this.pendingSave;
    }

    reset(): void {
        safeRemoveItem(SAVE_KEY);
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.pendingSave = false;
    }
}

function safeGetItem(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetItem(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch (e) { console.warn('[SaveSystem] localStorage write failed', e); }
}
function safeRemoveItem(key: string): void {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
}
