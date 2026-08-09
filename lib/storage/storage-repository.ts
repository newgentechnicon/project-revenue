/**
 * Storage abstraction (async) — Supabase-only
 *
 * Repository ไม่รู้จัก schema → ส่งและรับเป็น JSON string
 * Implementation อาจทำ smart parsing เพื่อ map key → table operations
 *
 * Operations:
 *   - read(key)            — hydrate (no destructive side effects)
 *   - write(key, value)    — UPSERT ONLY. ไม่มีการลบ row (กันลบฐานข้อมูลพลาด)
 *   - deleteItem(key, id)  — explicit per-item delete (สำหรับ multi-row tables)
 *   - replaceAll(key, val) — explicit "import/restore" semantics ที่ลบ row นอกชุดออก
 *   - remove(key)          — ลบทุก row ของ key นี้
 */

export interface StorageRepository {
  /** อ่าน raw string จาก storage (null หาก key ไม่มี) */
  read(key: string): Promise<string | null>;

  /**
   * เขียน raw string ลง storage — **UPSERT ONLY**
   * รายการที่อยู่ใน server แต่ไม่อยู่ใน value จะ *ไม่ถูกลบ*
   * (ใช้ deleteItem หรือ replaceAll เมื่อต้องการลบ explicitly)
   */
  write(key: string, value: string): Promise<void>;

  /** ลบ row เดียวจาก multi-row table (no-op สำหรับ singleton tables) */
  deleteItem(key: string, id: string): Promise<void>;

  /**
   * Explicit "import/restore" — upsert + ลบ row ที่ไม่อยู่ในชุดใหม่
   * ใช้เฉพาะตอน import data หรือ restore backup ที่เจตนาแทนทั้งหมด
   */
  replaceAll(key: string, value: string): Promise<void>;

  /** ลบ key ออกทั้งหมด */
  remove(key: string): Promise<void>;

  /** ตรวจสอบว่า storage พร้อมใช้งานหรือไม่ */
  isAvailable(): boolean;
}

// ============================================================
// NoOpStorageRepository — ใช้เมื่อยังไม่ได้ login
// ============================================================

class NoOpStorageRepository implements StorageRepository {
  isAvailable() {
    return false;
  }
  async read() {
    return null;
  }
  async write() {
    // intentionally silent — caller shouldn't write before auth
  }
  async deleteItem() {}
  async replaceAll() {}
  async remove() {}
}

// ============================================================
// In-memory implementation (for tests)
// ============================================================

export class InMemoryStorageRepository implements StorageRepository {
  private store = new Map<string, string>();

  isAvailable() {
    return true;
  }
  async read(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async write(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async deleteItem(): Promise<void> {
    // simplistic — full impl would parse envelope
  }
  async replaceAll(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// ============================================================
// Singleton getter
// ============================================================

let _instance: StorageRepository | null = null;

export function getStorageRepository(): StorageRepository {
  if (!_instance) {
    _instance = new NoOpStorageRepository();
  }
  return _instance;
}

/** สำหรับ tests / runtime switch */
export function setStorageRepository(repo: StorageRepository): void {
  _instance = repo;
}

/** Reset เป็น NoOp (เช่นเมื่อ user sign out) */
export function clearStorageRepository(): void {
  _instance = new NoOpStorageRepository();
}
