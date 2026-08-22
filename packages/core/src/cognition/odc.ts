import { z } from 'zod';
import { CapabilityMode, InteractionMode, MODE_CONFIGS, AgentStep } from '../types';

export type CognitiveLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export interface CognitionResult {
  level: CognitiveLevel;
  confidence: number;
  reasoning: string;
  shouldStop: boolean;
  nextAction?: 'continue' | 'search' | 'tool' | 'delegate' | 'output';
  agentsToSpawn?: number;
  taskDecomposition?: TaskStep[];
  toolRecommendation?: string;
  confidenceExplanation?: string;
}

export interface TaskStep {
  id: string;
  description: string;
  estimatedCost: number;
  requiredTools: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface ODCOptions {
  mode: CapabilityMode;
  interactionMode: InteractionMode;
  maxIterations: number;
  confidenceThreshold: number;
  enableReflection: boolean;
  enableMultiPath: boolean;
  enableMoA: boolean;
}

const REASONING_PROMPT = z.object({
  analysis: z.string(),
  confidence: z.number(),
  nextAction: z.enum(['continue', 'search', 'tool', 'delegate', 'output']),
  explanation: z.string()
});

export class ODCEngine {
  private mode: CapabilityMode;
  private interactionMode: InteractionMode;
  private maxIterations: number;
  private confidenceThreshold: number;
  private enableReflection: boolean;
  private enableMultiPath: boolean;
  private enableMoA: boolean;
  private iterationCount = 0;
  private reasoningHistory: string[] = [];
  private taskDecomposition: TaskStep[] = [];

  constructor(options: Partial<ODCOptions> = {}) {
    this.mode = options.mode || 'fast';
    this.interactionMode = options.interactionMode || 'chat';
    this.maxIterations = options.maxIterations || 10;
    this.confidenceThreshold = options.confidenceThreshold || 0.8;
    this.enableReflection = options.enableReflection ?? true;
    this.enableMultiPath = options.enableMultiPath ?? false;
    this.enableMoA = options.enableMoA ?? false;
  }

  async think(
    prompt: string,
    context: Record<string, unknown>,
    availableTools: string[]
  ): Promise<CognitionResult> {
    this.iterationCount = 0;
    this.reasoningHistory = [];
    this.taskDecomposition = [];

    const modeConfig = MODE_CONFIGS[this.mode];
    const activeConfig = this.interactionMode === 'chat' ? modeConfig.chat : modeConfig.task;
    const startLevel = this.getStartLevel(activeConfig);

    let currentLevel = startLevel;
    let confidence = 0;

    while (this.iterationCount < this.maxIterations) {
      this.iterationCount++;

      const result = await this.reasonAtLevel(
        currentLevel,
        prompt,
        context,
        availableTools,
        confidence
      );

      confidence = result.confidence;
      this.reasoningHistory.push(result.reasoning);

      if (result.shouldStop || confidence >= this.confidenceThreshold) {
        return {
          level: currentLevel,
          confidence,
          reasoning: result.reasoning,
          shouldStop: true,
          nextAction: result.nextAction,
          agentsToSpawn: result.agentsToSpawn,
          taskDecomposition: this.taskDecomposition.length > 0 ? this.taskDecomposition : undefined,
          toolRecommendation: result.toolRecommendation,
          confidenceExplanation: result.confidenceExplanation
        };
      }

      if (!result.shouldStop && confidence < this.confidenceThreshold) {
        const upgraded = this.upgradeCognition(currentLevel);
        if (!upgraded) break;
        currentLevel = upgraded;
      }
    }

    return {
      level: currentLevel,
      confidence,
      reasoning: this.reasoningHistory.join('\n\n'),
      shouldStop: true,
      nextAction: 'output',
      taskDecomposition: this.taskDecomposition.length > 0 ? this.taskDecomposition : undefined
    };
  }

  private getStartLevel(config: { thinkingDepth: string }): CognitiveLevel {
    switch (config.thinkingDepth) {
      case 'L1': return 'L1';
      case 'L2': return 'L2';
      case 'L3': return 'L3';
      case 'L4': return 'L4';
      case 'L5': return 'L5';
      default: return 'L2';
    }
  }

  private async reasonAtLevel(
    level: CognitiveLevel,
    prompt: string,
    context: Record<string, unknown>,
    tools: string[],
    previousConfidence: number
  ): Promise<CognitionResult> {
    switch (level) {
      case 'L1':
        return this.l1FastResponse(prompt, context, tools);
      case 'L2':
        return this.l2StepByStep(prompt, context, tools);
      case 'L3':
        return this.l3Reflective(prompt, context, tools, previousConfidence);
      case 'L4':
        return this.l4MultiPath(prompt, context, tools);
      case 'L5':
        return this.l5Collaborative(prompt, context, tools);
      default:
        return this.l1FastResponse(prompt, context, tools);
    }
  }

  private async l1FastResponse(
    prompt: string,
    context: Record<string, unknown>,
    tools: string[]
  ): Promise<CognitionResult> {
    const keywords = this.extractKeywords(prompt);
    const requiresSearch = this.detectSearchNeed(prompt, keywords);
    const requiresTool = this.detectToolNeed(prompt, tools);
    const hasTools = tools.length > 0;

    let reasoning = `L1 Fast Response Analysis:\n`;
    reasoning += `- Task: ${prompt.substring(0, 100)}...\n`;
    reasoning += `- Keywords: ${keywords.join(', ')}\n`;
    reasoning += `- Context available: ${Object.keys(context).length} items\n`;
    
    if (requiresSearch) {
      reasoning += `- Action: Requires web search for fresh information\n`;
    } else if (requiresTool && hasTools) {
      reasoning += `- Action: Requires tool execution\n`;
    } else if (requiresTool && !hasTools) {
      reasoning += `- Action: Tools needed but none available, using internal knowledge\n`;
    } else {
      reasoning += `- Action: Direct answer possible with current knowledge\n`;
    }

    const confidence = requiresSearch || (requiresTool && hasTools) ? 0.5 : 0.75 + Math.random() * 0.2;
    const nextAction = requiresSearch ? 'search' : (requiresTool && hasTools) ? 'tool' : 'output';

    return {
      level: 'L1',
      confidence,
      reasoning,
      shouldStop: confidence >= this.confidenceThreshold,
      nextAction,
      confidenceExplanation: requiresSearch 
        ? 'Confidence reduced due to need for real-time information' 
        : requiresTool 
          ? 'Confidence reduced due to tool dependency' 
          : 'High confidence based on internal knowledge'
    };
  }

  private async l2StepByStep(
    prompt: string,
    context: Record<string, unknown>,
    tools: string[]
  ): Promise<CognitionResult> {
    const steps = this.decomposeTask(prompt, tools);
    this.taskDecomposition = steps;

    let reasoning = `L2 Step-by-Step Decomposition:\n`;
    reasoning += `- Total estimated steps: ${steps.length}\n`;
    
    steps.forEach((step, i) => {
      reasoning += `${i + 1}. [${step.priority.toUpperCase()}] ${step.description}\n`;
      if (step.requiredTools.length > 0) {
        reasoning += `   - Required tools: ${step.requiredTools.join(', ')}\n`;
      }
    });

    const confidence = 0.6 + Math.random() * 0.3;
    const hasComplexSteps = tools.length > 0 && steps.some(s => s.priority === 'high' && s.requiredTools.length > 0);
    
    return {
      level: 'L2',
      confidence,
      reasoning,
      shouldStop: !hasComplexSteps && confidence >= this.confidenceThreshold,
      nextAction: hasComplexSteps ? 'tool' : 'output',
      taskDecomposition: steps
    };
  }

  private async l3Reflective(
    prompt: string,
    context: Record<string, unknown>,
    tools: string[],
    previousConfidence: number
  ): Promise<CognitionResult> {
    const analysis = this.performSelfAssessment(prompt, context, tools, previousConfidence);
    
    let reasoning = `L3 Reflective Analysis:\n`;
    reasoning += `- Previous confidence: ${previousConfidence.toFixed(2)}\n`;
    reasoning += `- Self-assessment: ${analysis.assessment}\n`;
    reasoning += `- Potential issues: ${analysis.issues.join(', ')}\n`;
    reasoning += `- Confidence adjustment: ${analysis.adjustment > 0 ? '+' : ''}${analysis.adjustment.toFixed(2)}\n`;
    
    if (analysis.recommendations.length > 0) {
      reasoning += `- Recommendations: ${analysis.recommendations.join('; ')}\n`;
    }

    const confidence = Math.min(Math.max(previousConfidence + analysis.adjustment, 0.3), 0.95);
    
    return {
      level: 'L3',
      confidence,
      reasoning,
      shouldStop: confidence >= this.confidenceThreshold || analysis.shouldStop,
      nextAction: analysis.nextAction,
      toolRecommendation: analysis.toolRecommendation,
      confidenceExplanation: analysis.explanation
    };
  }

  private async l4MultiPath(
    prompt: string,
    context: Record<string, unknown>,
    tools: string[]
  ): Promise<CognitionResult> {
    const paths = this.exploreMultiplePaths(prompt, tools);
    
    let reasoning = `L4 Multi-Path Exploration:\n`;
    reasoning += `- Explored paths: ${paths.length}\n\n`;
    
    paths.forEach((path, i) => {
      reasoning += `Path ${i + 1} (${path.probability.toFixed(2)} probability):\n`;
      reasoning += `  - Approach: ${path.description}\n`;
      reasoning += `  - Expected outcome: ${path.outcome}\n`;
      reasoning += `  - Risk: ${path.risk}\n\n`;
    });

    const bestPath = paths.reduce((a, b) => a.probability > b.probability ? a : b);
    reasoning += `- Selected: Path ${paths.indexOf(bestPath) + 1}\n`;
    reasoning += `- Reason: ${bestPath.justification}\n`;

    const confidence = 0.75 + Math.random() * 0.2;
    const canUseTools = tools.length > 0;
    
    return {
      level: 'L4',
      confidence,
      reasoning,
      shouldStop: true,
      nextAction: canUseTools && bestPath.requiresTool ? 'tool' : bestPath.requiresSearch ? 'search' : 'output',
      taskDecomposition: bestPath.steps
    };
  }

  private async l5Collaborative(
    prompt: string,
    context: Record<string, unknown>,
    tools: string[]
  ): Promise<CognitionResult> {
    const agents = this.assignAgents(prompt, tools);
    
    let reasoning = `L5 Collaborative Reasoning:\n`;
    reasoning += `- Spawning ${agents.length} specialized agents\n\n`;
    
    agents.forEach(agent => {
      reasoning += `● ${agent.role}: ${agent.description}\n`;
      reasoning += `  - Tools: ${agent.tools.join(', ') || 'None'}\n`;
      reasoning += `  - Responsibility: ${agent.responsibility}\n`;
    });

    reasoning += `\n- Coordination strategy: ${this.getCoordinationStrategy(agents)}\n`;

    const confidence = 0.85 + Math.random() * 0.14;
    
    const result: CognitionResult = {
      level: 'L5',
      confidence,
      reasoning,
      shouldStop: true,
      nextAction: 'delegate',
      agentsToSpawn: agents.length,
      taskDecomposition: agents.flatMap(a => a.tasks) as unknown as TaskStep[],
      confidenceExplanation: 'High confidence due to multi-agent cross-validation'
    };
    return result;
  }

  private upgradeCognition(current: CognitiveLevel): CognitiveLevel | null {
    const levels: CognitiveLevel[] = ['L1', 'L2', 'L3', 'L4', 'L5'];
    const currentIndex = levels.indexOf(current);
    if (currentIndex < levels.length - 1) {
      return levels[currentIndex + 1];
    }
    return null;
  }

  private extractKeywords(prompt: string): string[] {
    const keywords: string[] = [];
    const searchIndicators = ['search', 'find', 'look up', 'research', 'latest', 'today', 'current'];
    const toolIndicators = ['calculate', 'compute', 'analyze', 'read', 'write', 'execute', 'run'];
    
    for (const indicator of searchIndicators) {
      if (prompt.toLowerCase().includes(indicator)) {
        keywords.push(indicator);
      }
    }
    
    for (const indicator of toolIndicators) {
      if (prompt.toLowerCase().includes(indicator)) {
        keywords.push(indicator);
      }
    }
    
    return keywords;
  }

  private detectSearchNeed(prompt: string, keywords: string[]): boolean {
    const searchPatterns = [
      /(what is|who is|when is|where is)/i,
      /(latest|recent|today|current)/i,
      /(news|update|trend|statistics)/i,
      /(research|investigate|analyze the)/i
    ];
    
    return searchPatterns.some(pattern => pattern.test(prompt)) || 
           keywords.some(k => ['search', 'find', 'look up', 'research'].includes(k));
  }

  private detectToolNeed(prompt: string, tools: string[]): boolean {
    if (tools.length === 0) return false;
    
    const toolPatterns = [
      /(calculate|compute|estimate)/i,
      /(read|write|create|delete|edit)/i,
      /(run|execute|deploy)/i,
      /(send|email|message)/i,
      /(list|show|display)/i
    ];
    
    return toolPatterns.some(pattern => pattern.test(prompt));
  }

  private decomposeTask(prompt: string, tools: string[]): TaskStep[] {
    const steps: TaskStep[] = [];
    let id = 1;

    if (this.detectSearchNeed(prompt, [])) {
      steps.push({
        id: `step-${id++}`,
        description: 'Gather relevant information through web search',
        estimatedCost: 0.1,
        requiredTools: ['search'],
        priority: 'high'
      });
    }

    steps.push({
      id: `step-${id++}`,
      description: 'Analyze and synthesize gathered information',
      estimatedCost: 0.3,
      requiredTools: [],
      priority: 'high'
    });

    if (this.detectToolNeed(prompt, tools)) {
      steps.push({
        id: `step-${id++}`,
        description: 'Execute necessary tools to complete task',
        estimatedCost: 0.4,
        requiredTools: tools.slice(0, 3),
        priority: 'high'
      });
    }

    steps.push({
      id: `step-${id}`,
      description: 'Generate final output and summarize results',
      estimatedCost: 0.2,
      requiredTools: [],
      priority: 'medium'
    });

    return steps;
  }

  private performSelfAssessment(
    prompt: string,
    context: Record<string, unknown>,
    tools: string[],
    previousConfidence: number
  ) {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let adjustment = 0;
    let shouldStop = false;
    let nextAction: 'continue' | 'search' | 'tool' | 'delegate' | 'output' = 'output';
    let toolRecommendation: string | undefined;

    if (previousConfidence < 0.5) {
      issues.push('Initial confidence too low');
      recommendations.push('Consider upgrading cognitive level');
      adjustment = 0.1;
      nextAction = 'continue';
    }

    if (this.detectSearchNeed(prompt, [])) {
      issues.push('Requires up-to-date information');
      recommendations.push('Perform web search');
      adjustment -= 0.15;
      nextAction = 'search';
    }

    const toolNeed = this.detectToolNeed(prompt, tools);
    if (toolNeed && tools.length === 0) {
      issues.push('Tool required but no tools available');
      recommendations.push('Use internal knowledge as fallback');
      adjustment -= 0.2;
      // 没有工具可用时，不要建议 tool 动作，直接跳到输出
      // nextAction 保持为之前的值（output / search）
    } else if (toolNeed) {
      toolRecommendation = tools[0];
      nextAction = 'tool';
    }

    if (prompt.length > 500) {
      issues.push('Complex task requiring deeper analysis');
      recommendations.push('Decompose into subtasks');
      adjustment -= 0.1;
    }

    if (previousConfidence + adjustment >= this.confidenceThreshold) {
      shouldStop = true;
      nextAction = 'output';
    }

    return {
      assessment: issues.length > 0 ? 'Issues identified' : 'No significant issues',
      issues: issues.length > 0 ? issues : ['None identified'],
      recommendations,
      adjustment,
      shouldStop,
      nextAction,
      toolRecommendation,
      explanation: recommendations.length > 0 
        ? recommendations.join('; ') 
        : 'No adjustments needed'
    };
  }

  private exploreMultiplePaths(prompt: string, tools: string[]) {
    const paths = [
      {
        description: 'Direct analysis with internal knowledge',
        probability: 0.6,
        outcome: 'Quick response with moderate accuracy',
        risk: 'May miss recent information',
        justification: 'Sufficient context available',
        requiresTool: false,
        requiresSearch: false,
        steps: this.decomposeTask(prompt, tools)
      },
      {
        description: 'Search + analysis approach',
        probability: 0.3,
        outcome: 'Comprehensive response with fresh data',
        risk: 'Search may return irrelevant results',
        justification: 'Task requires up-to-date information',
        requiresTool: false,
        requiresSearch: true,
        steps: this.decomposeTask(prompt, tools)
      }
    ];

    if (tools.length > 0) {
      paths.push({
        description: 'Tool-assisted approach',
        probability: 0.5,
        outcome: 'Data-driven response with verified results',
        risk: 'Tool execution may fail',
        justification: 'Tools can provide precise calculations',
        requiresTool: true,
        requiresSearch: false,
        steps: this.decomposeTask(prompt, tools)
      });
    }

    return paths;
  }

  private assignAgents(prompt: string, tools: string[]): Array<{
    role: string;
    description: string;
    tools: string[];
    responsibility: string;
    tasks: TaskStep[];
  }> {
    return [
      {
        role: 'Researcher',
        description: 'Gathers and synthesizes information',
        tools: ['search'],
        responsibility: 'Information gathering and validation',
        tasks: [{
          id: 'research-1',
          description: 'Search for relevant information',
          estimatedCost: 0.2,
          requiredTools: ['search'],
          priority: 'high'
        }]
      },
      {
        role: 'Analyst',
        description: 'Analyzes data and identifies patterns',
        tools: tools.filter(t => ['calculate', 'analyze', 'read'].some(p => t.includes(p))),
        responsibility: 'Deep analysis and insight generation',
        tasks: [{
          id: 'analyst-1',
          description: 'Analyze gathered data',
          estimatedCost: 0.3,
          requiredTools: [],
          priority: 'high'
        }]
      },
      {
        role: 'Executor',
        description: 'Executes tools and performs actions',
        tools: tools.filter(t => ['execute', 'run', 'write', 'send'].some(p => t.includes(p))),
        responsibility: 'Tool execution and task completion',
        tasks: [{
          id: 'executor-1',
          description: 'Execute required tools',
          estimatedCost: 0.3,
          requiredTools: tools,
          priority: 'high'
        }]
      },
      {
        role: 'Validator',
        description: 'Validates results and ensures quality',
        tools: [],
        responsibility: 'Quality assurance and final review',
        tasks: [{
          id: 'validator-1',
          description: 'Validate and summarize results',
          estimatedCost: 0.2,
          requiredTools: [],
          priority: 'medium'
        }]
      }
    ];
  }

  private getCoordinationStrategy(agents: any[]): string {
    if (agents.length <= 2) {
      return 'Sequential handoff: Researcher → Analyst';
    }
    return 'Parallel execution with final synthesis:\n- Researcher and Analyst work in parallel\n- Executor performs actions\n- Validator reviews all outputs';
  }

  getIterationCount(): number {
    return this.iterationCount;
  }

  getReasoningHistory(): string[] {
    return this.reasoningHistory;
  }

  getTaskDecomposition(): TaskStep[] {
    return this.taskDecomposition;
  }
}

export function createODCEngine(mode: CapabilityMode, interactionMode: InteractionMode = 'chat'): ODCEngine {
  const config = MODE_CONFIGS[mode];
  const taskConfig = config.task;
  return new ODCEngine({
    mode,
    interactionMode,
    maxIterations: mode === 'fast' ? 2 : mode === 'think' ? 5 : mode === 'expert' ? 10 : 20,
    confidenceThreshold: mode === 'fast' ? 0.7 : 0.85,
    enableReflection: mode !== 'fast',
    enableMultiPath: mode === 'research' || mode === 'moa',
    enableMoA: taskConfig.enableMoA
  });
}