"use strict";
/**
 * OMM - Oxygen Memo Manager
 * Hierarchical memory with TLB hot-page cache and pointer-linked associations
 * Integrated from: oxygen-memo skill
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OMMManager = exports.DEFAULT_MEMORY_CONFIG = void 0;
exports.createMemoryManager = createMemoryManager;
exports.createAgentMemory = createAgentMemory;
const uuid_1 = require("uuid");
exports.DEFAULT_MEMORY_CONFIG = {
    maxShortTermPages: 50,
    maxLongTermPages: 500,
    tlbCacheSize: 20,
    tlbHitThreshold: 0.7,
    autoConsolidate: true,
    consolidationInterval: 300000 // 5 minutes
};
// ============================================
// OMM Implementation
// ============================================
class OMMManager {
    config;
    shortTerm = [];
    longTerm = [];
    tlbCache = new Map();
    rootIndex = new Map(); // tag -> page IDs
    consolidationTimer;
    constructor(config = {}) {
        this.config = { ...exports.DEFAULT_MEMORY_CONFIG, ...config };
        this.startAutoConsolidation();
    }
    /**
     * Store a new memory page
     */
    store(content, tags = [], pointers = []) {
        const now = new Date();
        const page = {
            id: (0, uuid_1.v4)(),
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
            this.rootIndex.get(tag).push(page.id);
        }
        // Evict if over limit
        this.evictIfNeeded();
        return page;
    }
    /**
     * Recall memories by tags or semantic search
     */
    recall(query, tags, limit = 10) {
        const results = [];
        // TLB fast path
        const tlbResults = this.searchTLB(query, tags);
        results.push(...tlbResults);
        // If TLB hit rate is good, return cached results
        if (results.length >= limit * this.config.tlbHitThreshold) {
            return results.slice(0, limit);
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
        return results.slice(0, limit);
    }
    /**
     * Search TLB cache (fast path)
     */
    searchTLB(query, tags) {
        const results = [];
        const queryLower = query.toLowerCase();
        for (const [id, page] of this.tlbCache) {
            if (tags && !tags.some(t => page.tags.includes(t)))
                continue;
            if (page.content.toLowerCase().includes(queryLower)) {
                results.push(page);
            }
        }
        return results;
    }
    /**
     * Search memory array
     */
    searchMemory(memory, query, tags) {
        const results = [];
        const queryLower = query.toLowerCase();
        for (const page of memory) {
            if (tags && !tags.some(t => page.tags.includes(t)))
                continue;
            if (page.content.toLowerCase().includes(queryLower)) {
                results.push(page);
            }
        }
        return results.sort((a, b) => b.accessCount - a.accessCount);
    }
    /**
     * Promote page to TLB cache
     */
    promoteToTLB(page) {
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
    evictIfNeeded() {
        // Evict short-term
        while (this.shortTerm.length > this.config.maxShortTermPages) {
            const evicted = this.shortTerm.shift();
            this.promoteToLongTerm(evicted);
        }
        // Evict long-term
        while (this.longTerm.length > this.config.maxLongTermPages) {
            const evicted = this.longTerm.shift();
            this.forget(evicted.id);
        }
    }
    /**
     * Promote page to long-term memory
     */
    promoteToLongTerm(page) {
        page.tlbResident = false;
        this.tlbCache.delete(page.id);
        this.longTerm.push(page);
    }
    /**
     * Forget a memory page
     */
    forget(pageId) {
        const removedFromShort = this.shortTerm.some(p => p.id === pageId);
        const removedFromLong = this.longTerm.some(p => p.id === pageId);
        this.tlbCache.delete(pageId);
        return removedFromShort || removedFromLong;
    }
    /**
     * Create pointer link between memories
     */
    link(sourceId, targetId) {
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
    merge(pageIds) {
        const pages = pageIds
            .map(id => [...this.shortTerm, ...this.longTerm].find(p => p.id === id))
            .filter((p) => p !== undefined);
        if (pages.length === 0)
            return null;
        const mergedContent = pages.map(p => p.content).join('\n\n---\n\n');
        const mergedTags = [...new Set(pages.flatMap(p => p.tags))];
        const mergedPointers = [...new Set(pages.flatMap(p => p.pointers))];
        // Remove originals
        for (const id of pageIds) {
            this.forget(id);
        }
        return this.store(mergedContent, mergedTags, mergedPointers);
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
    startAutoConsolidation() {
        if (this.config.autoConsolidate) {
            this.consolidationTimer = setInterval(() => {
                this.consolidate();
            }, this.config.consolidationInterval);
        }
    }
    /**
     * Consolidate similar memories
     */
    consolidate() {
        // Simple consolidation: merge pages with similar tags
        const tagGroups = new Map();
        for (const page of this.shortTerm) {
            for (const tag of page.tags) {
                if (!tagGroups.has(tag)) {
                    tagGroups.set(tag, []);
                }
                tagGroups.get(tag).push(page);
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
    destroy() {
        if (this.consolidationTimer) {
            clearInterval(this.consolidationTimer);
        }
    }
}
exports.OMMManager = OMMManager;
// ============================================
// Memory Manager Factory
// ============================================
function createMemoryManager(config) {
    return new OMMManager(config);
}
/**
 * Get AgentMemory structure for compatibility
 */
function createAgentMemory(omm) {
    return {
        shortTerm: [...omm['shortTerm']],
        longTerm: [...omm['longTerm']],
        workingMemory: new Map()
    };
}
//# sourceMappingURL=omm.js.map