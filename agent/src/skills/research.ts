import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { Skill, SkillContext, SkillResult } from './registry.js';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export class ResearchSkill implements Skill {
  name = 'research';
  description = 'Research any topic with comprehensive analysis and sources';
  categories = ['research', 'analysis'];

  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: config.ai.apiKey });
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    logger.task(context.taskId, 'Starting research...');

    try {
      // Step 1: Analyze the research question
      const analysis = await this.analyzeQuestion(context.description);

      // Step 2: Search for information (simulated - use Exa in production)
      const searchResults = await this.search(analysis.searchQueries);

      // Step 3: Synthesize findings
      const report = await this.synthesize(context.description, searchResults);

      logger.task(context.taskId, 'Research completed');

      return {
        success: true,
        deliverable: report,
        approach: `Analyzed question, searched ${searchResults.length} sources, synthesized findings`,
        metadata: {
          sourcesCount: searchResults.length,
          searchQueries: analysis.searchQueries
        }
      };
    } catch (error) {
      logger.error(`Research skill error:`, error);
      return {
        success: false,
        deliverable: `Research failed: ${error instanceof Error ? error.message : String(error)}`,
        approach: 'Failed during execution'
      };
    }
  }

  private async analyzeQuestion(description: string): Promise<{
    mainQuestion: string;
    subQuestions: string[];
    searchQueries: string[];
  }> {
    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 500,
      system: 'You are a research assistant. Analyze the research question and generate search queries. Return JSON only.',
      messages: [{
        role: 'user',
        content: `Analyze this research request:
"${description}"

Return JSON:
{
  "mainQuestion": "the core question being asked",
  "subQuestions": ["related questions to explore"],
  "searchQueries": ["3-5 specific search queries to find information"]
}`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return JSON.parse(text);
  }

  private async search(queries: string[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Use Exa API if configured (recommended for production)
    if (config.mcp.exa.apiKey) {
      try {
        for (const query of queries.slice(0, 3)) { // Limit to 3 queries to manage costs
          // Use searchAndContents for richer results with text extraction
          const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': config.mcp.exa.apiKey
            },
            body: JSON.stringify({
              query,
              numResults: 5,
              useAutoprompt: true,
              type: 'neural', // Neural search for better semantic matching
              contents: {
                text: { maxCharacters: 1000 } // Get text content
              }
            })
          });

          if (response.ok) {
            const data = await response.json();
            for (const result of data.results || []) {
              results.push({
                title: result.title || 'Untitled',
                url: result.url,
                snippet: result.text?.slice(0, 800) || result.highlight || ''
              });
            }
            logger.info(`Exa search "${query.slice(0, 30)}..." returned ${data.results?.length || 0} results`);
          } else {
            const errorText = await response.text();
            logger.warn(`Exa search failed for "${query}": ${response.status} - ${errorText}`);
          }
        }
      } catch (error) {
        logger.error('Exa search error:', error);
      }
    }

    // Fallback: Use free web search as backup if no Exa results
    if (results.length === 0) {
      logger.warn('No Exa API key or search failed, using fallback search');

      // Use DuckDuckGo HTML API as free fallback
      for (const query of queries.slice(0, 2)) {
        try {
          const response = await fetch(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AgentBounty/1.0)'
              }
            }
          );

          if (response.ok) {
            const html = await response.text();
            // Extract result links and snippets from HTML
            const resultMatches = html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([^<]+)/g);

            for (const match of resultMatches) {
              if (results.length >= 10) break;
              results.push({
                title: match[2].trim(),
                url: match[1],
                snippet: match[3].trim()
              });
            }
          }
        } catch (error) {
          logger.warn('DuckDuckGo fallback failed:', error);
        }
      }
    }

    // If still no results, provide helpful message
    if (results.length === 0) {
      results.push({
        title: 'Search unavailable',
        url: 'https://exa.ai',
        snippet: 'No search results available. For best results, configure EXA_API_KEY in your environment. Get $10 free credits at exa.ai.'
      });
    }

    return results;
  }

  private async synthesize(question: string, sources: SearchResult[]): Promise<string> {
    const sourceSummary = sources.map((s, i) =>
      `[${i + 1}] ${s.title}\n${s.snippet}\nSource: ${s.url}`
    ).join('\n\n');

    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 2000,
      system: `You are a research analyst. Synthesize the provided sources into a comprehensive research report.
Include:
- Executive summary
- Key findings
- Analysis
- Sources cited with [n] notation
Be thorough but concise.`,
      messages: [{
        role: 'user',
        content: `Research Question: ${question}

Sources:
${sourceSummary}

Please synthesize this into a comprehensive research report.`
      }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }
}
