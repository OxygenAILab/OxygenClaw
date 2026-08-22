/**
 * OMM - Oxygen Memo Manager
 * Hierarchical memory with TLB hot-page cache and pointer-linked associations
 * Integrated from: oxygen-memo skill
 */

import { v4 as uuidv4 } from 'uuid';
import { MemoryPage, AgentMemory } from '../types';

// ============================================
// Memory Configuration
// ============================================
export interface MemoryConfig {
  maxShortTermPages: number;
  maxLongTermPages: number;
  tlbCacheSize: number;
  tlbHitThreshold: number;
  autoConsolidate: boolean;
  consolidationInterval: number; // ms
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  maxShortTermPages: 50,
  maxLongTermPages: 500,
  tlbCacheSize: 20,
  tlbHitThreshold: 0.7,
  autoConsolidate: true,
  consolidationInterval: 300000 // 5 minutes
};

// ============================================
// Memory Page with TLB Metadata
// ============================================
interface MemoryPageWithTLB extends MemoryPage {
  tlbResident: boolean;
  lastTlbAccess: Date;
}

// ============================================
// OMM Implementation
// ============================================
export class OMMManager {
  private config: MemoryConfig;
  private shortTerm: MemoryPageWithTLB[] = [];
  private longTerm: MemoryPageWithTLB[] = [];
  private tlbCache: Map<string, MemoryPageWithTLB> = new Map();
  private rootIndex: Map<string, string[]> = new Map(); // tag -> page IDs
  private consolidationTimer?: NodeJS.Timeout;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.startAutoConsolidation();
  }

  /**
   * Store a new memory page
   */
  store(content: string, tags: string[] = [], pointers: string[] = []): MemoryPage {
    const now = new Date();
    const page: MemoryPageWithTLB = {
      id: uuidv4(),
      content,
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
      tags,
      pointers,
      tlbResident: true,
      lastTlbAccess: now
    };

    // Add to short-term memory first
    this.shortTerm.push(page);
    this.tlbCache.set(page.id, page);

    // Update index
    for (const tag of tags) {
      if (!this.rootIndex.has(tag)) {
        this.rootIndex.set(tag, []);
      }
      this.rootIndex.get(tag)!.push(page.id);
    }

    // Evict if over limit
    this.evictIfNeeded();

    return page as MemoryPage;
  }

  /**
   * Recall memories by tags or semantic search
   */
  recall(query: string, tags?: string[], limit = 10): MemoryPage[] {
    const results: MemoryPageWithTLB[] = [];

    // TLB fast path
    const tlbResults = this.searchTLB(query, tags);
    results.push(...tlbResults);

    // If TLB hit rate is good, return cached results
    if (results.length >= limit * this.config.tlbHitThreshold) {
      return results.slice(0, limit) as MemoryPage[];
    }

    // Search short-term
    const shortTermResults = this.searchMemory(this.shortTerm, query, tags);
    results.push(...shortTermResults);

    // Search long-term if needed
    if (results.length < limit) {
      const longTermResults = this.searchMemory(this.longTerm, query, tags);
      results.push(...longTermResults);
    }

    // Update access metadata
    for (const page of results) {
      page.lastAccessed = new Date();
      page.accessCount++;
      this.promoteToTLB(page);
    }

    return results.slice(0, limit) as MemoryPage[];
  }

  /**
   * Search TLB cache (fast path)
   */
  private searchTLB(query: string, tags?: string[]): MemoryPageWithTLB[] {
    const results: MemoryPageWithTLB[] = [];
    const queryLower = query.toLowerCase();

    for (const [id, page] of this.tlbCache) {
      if (tags && !tags.some(t => page.tags.includes(t))) continue;
      if (page.content.toLowerCase().includes(queryLower)) {
        results.push(page);
      }
    }

    return results;
  }

  /**
   * Search memory array
   */
  private searchMemory(
    memory: MemoryPageWithTLB[],
    query: string,
    tags?: string[]
  ): MemoryPageWithTLB[] {
    const results: MemoryPageWithTLB[] = [];
    const queryLower = query.toLowerCase();

    for (const page of memory) {
      if (tags && !tags.some(t => page.tags.includes(t))) continue;
      if (page.content.toLowerCase().includes(queryLower)) {
        results.push(page);
      }
    }

    return results.sort((a, b) => b.accessCount - a.accessCount);
  }

  /**
   * Promote page to TLB cache
   */
  private promoteToTLB(page: MemoryPageWithTLB): void {
    if (this.tlbCache.size >= this.config.tlbCacheSize) {
      // Evict least recently used
      const lru = Array.from(this.tlbCache.entries())
        .sort((a, b) => a[1].lastTlbAccess.getTime() - b[1].lastTlbAccess.getTime())[0];
      if (lru) {
        lru[1].tlbResident = false;
        this.tlbCache.delete(lru[0]);
      }
    }

    page.tlbResident = true;
    page.lastTlbAccess = new Date();
    this.tlbCache.set(page.id, page);
  }

  /**
   * Evict pages if over limit
   */
  private evictIfNeeded(): void {
    // Evict short-term
    while (this.shortTerm.length > this.config.maxShortTermPages) {
      const evicted = this.shortTerm.shift()!;
      this.promoteToLongTerm(evicted);
    }

    // Evict long-term
    while (this.longTerm.length > this.config.maxLongTermPages) {
      const evicted = this.longTerm.shift()!;
      this.forget(evicted.id);
    }
  }

  /**
   * Promote page to long-term memory
   */
  private promoteToLongTerm(page: MemoryPageWithTLB): void {
    page.tlbResident = false;
    this.tlbCache.delete(page.id);
    this.longTerm.push(page);
  }

  /**
   * Forget a memory page
   */
  forget(pageId: string): boolean {
    const shortTermBefore = this.shortTerm.length;
    const longTermBefore = this.longTerm.length;

    this.shortTerm = this.shortTerm.filter(p => p.id !== pageId);
    this.longTerm = this.longTerm.filter(p => p.id !== pageId);
    this.tlbCache.delete(pageId);

    for (const page of [...this.shortTerm, ...this.longTerm]) {
      page.pointers = page.pointers.filter(id => id !== pageId);
    }

    return this.shortTerm.length !== shortTermBefore || this.longTerm.length !== longTermBefore;
  }

  /**
   * Create pointer link between memories
   */
  link(sourceId: string, targetId: string): boolean {
    const source = [...this.shortTerm, ...this.longTerm].find(p => p.id === sourceId);
    const target = [...this.shortTerm, ...this.longTerm].find(p => p.id === targetId);

    if (source && target) {
      if (!source.pointers.includes(targetId)) {
        source.pointers.push(targetId);
      }
      if (!target.pointers.includes(sourceId)) {
        target.pointers.push(sourceId);
      }
      return true;
    }
    return false;
  }

  /**
   * Merge multiple pages into one
   */
  merge(pageIds: string[]): MemoryPage | null {
    const pages = pageIds
      .map(id => [...this.shortTerm, ...this.longTerm].find(p => p.id === id))
      .filter((p): p is MemoryPageWithTLB => p !== undefined);

    if (pages.length === 0) return null;

    const mergedContent = pages.map(p => p.content).join('\n\n---\n\n');
    const mergedTags = [...new Set(pages.flatMap(p => p.tags))];
    const mergedPointers = [...new Set(pages.flatMap(p => p.pointers))];

    // Remove originals
    for (const id of pageIds) {
      this.forget(id);
    }

    return this.store(mergedContent, mergedTags, mergedPointers) as MemoryPage;
  }

  /**
   * Get memory stats
   */
  getStats() {
    return {
      shortTerm: this.shortTerm.length,
      longTerm: this.longTerm.length,
      tlbCache: this.tlbCache.size,
      indexEntries: this.rootIndex.size
    };
  }

  /**
   * Auto-consolidation timer
   */
  private startAutoConsolidation(): void {
    if (this.config.autoConsolidate) {
      this.consolidationTimer = setInterval(() => {
        this.consolidate();
      }, this.config.consolidationInterval);
    }
  }

  /**
   * Consolidate similar memories
   */
  private consolidate(): void {
    // Simple consolidation: merge pages with similar tags
    const tagGroups = new Map<string, MemoryPageWithTLB[]>();

    for (const page of this.shortTerm) {
      for (const tag of page.tags) {
        if (!tagGroups.has(tag)) {
          tagGroups.set(tag, []);
        }
        tagGroups.get(tag)!.push(page);
      }
    }

    // Merge groups with multiple pages
    for (const [tag, pages] of tagGroups) {
      if (pages.length > 2) {
        const toMerge = pages.slice(0, 3).map(p => p.id);
        this.merge(toMerge);
      }
    }
  }

  /**
   * Stop auto-consolidation
   */
  destroy(): void {
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer);
    }
  }
}

// ============================================
// Memory Manager Factory
// ============================================
export function createMemoryManager(config?: Partial<MemoryConfig>): OMMManager {
  return new OMMManager(config);
}

/**
 * Get AgentMemory structure for compatibility
 */
export function createAgentMemory(omm: OMMManager): AgentMemory {
  return {
    shortTerm: [...omm['shortTerm']] as MemoryPage[],
    longTerm: [...omm['longTerm']] as MemoryPage[],
    workingMemory: new Map()
  };
}
