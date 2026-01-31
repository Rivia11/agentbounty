export interface TaskAnalysis {
  category: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedTokens: number;
  toolsRequired: string[];
}

export interface PriceBreakdown {
  item: string;
  amount: number;
}

export interface PriceResult {
  total: number;
  breakdown: PriceBreakdown[];
}

const BASE_PRICES: Record<string, number> = {
  research: 2,
  website: 15,
  writing: 5,
  code: 10,
  design: 20,
  other: 5
};

const COMPLEXITY_MULTIPLIERS: Record<string, number> = {
  simple: 1,
  medium: 1.5,
  complex: 2.5
};

const TOOL_COSTS: Record<string, number> = {
  'playwright-mcp': 0.5,
  'exa-mcp': 0.25,
  'vercel-mcp': 1,
  'github-mcp': 0.5,
  'dalle-mcp': 2,
  'polymarket-mcp': 0
};

const CATEGORY_TOOLS: Record<string, string[]> = {
  research: ['exa-mcp'],
  website: ['playwright-mcp', 'vercel-mcp'],
  writing: [],
  code: ['github-mcp'],
  design: ['dalle-mcp'],
  other: []
};

export class PricingEngine {
  calculate(analysis: TaskAnalysis): PriceResult {
    const breakdown: PriceBreakdown[] = [];

    // Base price for category
    const basePrice = BASE_PRICES[analysis.category] || BASE_PRICES.other;
    breakdown.push({ item: `${analysis.category} base`, amount: basePrice });

    // Complexity multiplier
    const multiplier = COMPLEXITY_MULTIPLIERS[analysis.complexity];
    const complexityAdjustment = basePrice * (multiplier - 1);
    if (complexityAdjustment > 0) {
      breakdown.push({ item: `${analysis.complexity} complexity`, amount: complexityAdjustment });
    }

    // Tool costs
    for (const tool of analysis.toolsRequired) {
      const toolCost = TOOL_COSTS[tool];
      if (toolCost && toolCost > 0) {
        breakdown.push({ item: tool.replace('-mcp', ''), amount: toolCost });
      }
    }

    // Token cost for very long outputs (>4000 tokens)
    if (analysis.estimatedTokens > 4000) {
      const extraTokens = analysis.estimatedTokens - 4000;
      const tokenCost = Math.round(extraTokens * 0.0001 * 100) / 100;
      if (tokenCost > 0) {
        breakdown.push({ item: 'extended output', amount: tokenCost });
      }
    }

    // Calculate total
    const total = Math.round(breakdown.reduce((sum, b) => sum + b.amount, 0) * 100) / 100;

    // Minimum price
    const finalTotal = Math.max(total, 1);

    return {
      total: finalTotal,
      breakdown
    };
  }

  inferTools(category: string): string[] {
    return CATEGORY_TOOLS[category] || [];
  }

  estimateTokens(description: string): number {
    // Rough estimate: ~4 chars per token, output usually 2-3x input
    const inputTokens = Math.ceil(description.length / 4);
    return inputTokens * 3 + 1000; // Base output tokens
  }

  analyzeComplexity(description: string): 'simple' | 'medium' | 'complex' {
    const wordCount = description.split(/\s+/).length;
    const hasMultipleRequirements = description.includes(' and ') || description.includes(', ');
    const hasTechnicalTerms = /api|database|integration|deploy|custom/i.test(description);

    if (wordCount > 50 || (hasMultipleRequirements && hasTechnicalTerms)) {
      return 'complex';
    }
    if (wordCount > 20 || hasMultipleRequirements || hasTechnicalTerms) {
      return 'medium';
    }
    return 'simple';
  }

  quickEstimate(description: string, category: string): PriceResult {
    return this.calculate({
      category,
      complexity: this.analyzeComplexity(description),
      estimatedTokens: this.estimateTokens(description),
      toolsRequired: this.inferTools(category)
    });
  }
}
