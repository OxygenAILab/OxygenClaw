/**
 * OMM - Oxygen Memo Manager
 * Hierarchical memory with TLB hot-page cache and pointer-linked associations
 * Integrated from: oxygen-memo skill
 */
import { MemoryPage, AgentMemory } from '../types';
export interface MemoryConfig {
    maxShortTermPages: number;
    maxLongTermPages: number;
    tlbCacheSize: number;
    tlbHitThreshold: number;
    autoConsolidate: boolean;
    consolidationInterval: number;
}
export declare const DEFAULT_MEMORY_CONFIG: MemoryConfig;
export declare class OMMManager {
    private config;
    private shortTerm;
    private longTerm;
    private tlbCache;
    private rootIndex;
    private consolidationTimer?;
    constructor(config?: Partial<MemoryConfig>);
    /**
     * Store a new memory page
     */
    store(content: string, tags?: string[], pointers?: string[]): MemoryPage;
    /**
     * Recall memories by tags or semantic search
     */
    recall(query: string, tags?: string[], limit?: number): MemoryPage[];
    /**
     * Search TLB cache (fast path)
     */
    private searchTLB;
    /**
     * Search memory array
     */
    private searchMemory;
    /**
     * Promote page to TLB cache
     */
    private promoteToTLB;
    /**
     * Evict pages if over limit
     */
    private evictIfNeeded;
    /**
     * Promote page to long-term memory
     */
    private promoteToLongTerm;
    /**
     * Forget a memory page
     */
    forget(pageId: string): boolean;
    /**
     * Create pointer link between memories
     */
    link(sourceId: string, targetId: string): boolean;
    /**
     * Merge multiple pages into one
     */
    merge(pageIds: string[]): MemoryPage | null;
    /**
     * Get memory stats
     */
    getStats(): {
        shortTerm: number;
        longTerm: number;
        tlbCache: number;
        indexEntries: number;
    };
    /**
     * Auto-consolidation timer
     */
    private startAutoConsolidation;
    /**
     * Consolidate similar memories
     */
    private consolidate;
    /**
     * Stop auto-consolidation
     */
    destroy(): void;
}
export declare function createMemoryManager(config?: Partial<MemoryConfig>): OMMManager;
/**
 * Get AgentMemory structure for compatibility
 */
export declare function createAgentMemory(omm: OMMManager): AgentMemory;
//# sourceMappingURL=omm.d.ts.map