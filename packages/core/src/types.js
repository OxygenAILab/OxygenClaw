"use strict";
/**
 * OxygenClaw Core Types
 * Integrated from: TinyClaw, EdgeClaw, NanoClaw, StepClaw, OpenHands, UI-TARS
 * Enhanced with multi-model switching capability
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODE_CONFIGS = void 0;
exports.MODE_CONFIGS = {
    fast: {
        mode: 'fast',
        label: 'Fast',
        description: 'Almost no thinking, 1 web search. Quick response.',
        icon: 'Zap',
        color: 'success',
        chat: {
            maxWebSearches: 1,
            thinkingDepth: 'L1',
            enableCoT: false,
            enableCrossValidation: false,
            temperature: 0.3,
            contextBudget: 8000,
            deliverMarkdown: false
        },
        task: {
            maxWebSearches: 1,
            thinkingDepth: 'L1',
            enableDynamicCognition: false,
            enableMoA: false,
            maxAgents: 1,
            autoSelectModel: false,
            temperature: 0.3,
            contextBudget: 8000
        }
    },
    think: {
        mode: 'think',
        label: 'Think',
        description: 'Moderate thinking depth, multi-round web search.',
        icon: 'Brain',
        color: 'primary',
        chat: {
            maxWebSearches: 5,
            thinkingDepth: 'L2',
            enableCoT: false,
            enableCrossValidation: false,
            temperature: 0.6,
            contextBudget: 16000,
            deliverMarkdown: false
        },
        task: {
            maxWebSearches: 5,
            thinkingDepth: 'L3',
            enableDynamicCognition: true,
            enableMoA: false,
            maxAgents: 1,
            autoSelectModel: false,
            temperature: 0.5,
            contextBudget: 32000
        }
    },
    expert: {
        mode: 'expert',
        label: 'Expert',
        description: 'CoT thinking for chat, dynamic cognition for task. Multi-round web search.',
        icon: 'Award',
        color: 'tertiary',
        chat: {
            maxWebSearches: 10,
            thinkingDepth: 'L3',
            enableCoT: true,
            enableCrossValidation: false,
            temperature: 0.7,
            contextBudget: 32000,
            deliverMarkdown: false
        },
        task: {
            maxWebSearches: 10,
            thinkingDepth: 'L4',
            enableDynamicCognition: true,
            enableMoA: false,
            maxAgents: 1,
            autoSelectModel: false,
            temperature: 0.6,
            contextBudget: 64000
        }
    },
    research: {
        mode: 'research',
        label: 'Research',
        description: 'Max thinking depth, cross-validation, unlimited search. Delivers markdown document.',
        icon: 'BookOpen',
        color: 'secondary',
        chat: {
            maxWebSearches: -1,
            thinkingDepth: 'L5',
            enableCoT: true,
            enableCrossValidation: true,
            temperature: 0.8,
            contextBudget: 128000,
            deliverMarkdown: true
        },
        task: {
            maxWebSearches: -1,
            thinkingDepth: 'L5',
            enableDynamicCognition: true,
            enableMoA: false,
            maxAgents: 1,
            autoSelectModel: true,
            temperature: 0.7,
            contextBudget: 128000
        }
    },
    moa: {
        mode: 'moa',
        label: 'MoA',
        description: 'Ultra-MoE, GroupChat. Dynamic cognition召集 models, collaborative thinking. Voting and markdown delivery.',
        icon: 'Users',
        color: 'error',
        chat: {
            maxWebSearches: -1,
            thinkingDepth: 'L5',
            enableCoT: true,
            enableCrossValidation: true,
            temperature: 0.7,
            contextBudget: 128000,
            deliverMarkdown: true
        },
        task: {
            maxWebSearches: -1,
            thinkingDepth: 'L5',
            enableDynamicCognition: true,
            enableMoA: true,
            maxAgents: 7,
            autoSelectModel: true,
            temperature: 0.6,
            contextBudget: 256000,
            frameworkPatterns: ['mixture-of-agents', 'ultra-moe', 'group-chat', 'debate'],
            defaultPattern: 'mixture-of-agents',
            votingStrategy: 'weighted'
        }
    }
};
//# sourceMappingURL=types.js.map