import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { Skill, SkillContext, SkillResult } from './registry.js';

export class CodeSkill implements Skill {
  name = 'code';
  description = 'Generate, review, and debug code in any language';
  categories = ['code', 'programming', 'debug', 'other'];

  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: config.ai.apiKey });
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    logger.task(context.taskId, 'Starting code task...');

    try {
      // Analyze what type of code task
      const taskType = await this.analyzeCodeTask(context.description);

      let result: string;
      switch (taskType.action) {
        case 'generate':
          result = await this.generateCode(context.description, taskType);
          break;
        case 'review':
          result = await this.reviewCode(context.description);
          break;
        case 'debug':
          result = await this.debugCode(context.description);
          break;
        case 'explain':
          result = await this.explainCode(context.description);
          break;
        default:
          result = await this.generateCode(context.description, taskType);
      }

      logger.task(context.taskId, `Completed ${taskType.action} task`);

      return {
        success: true,
        deliverable: result,
        approach: `Performed ${taskType.action} for ${taskType.language} code`,
        metadata: {
          action: taskType.action,
          language: taskType.language
        }
      };
    } catch (error) {
      logger.error('Code skill error:', error);
      return {
        success: false,
        deliverable: `Code task failed: ${error instanceof Error ? error.message : String(error)}`,
        approach: 'Failed during execution'
      };
    }
  }

  private async analyzeCodeTask(description: string): Promise<{
    action: 'generate' | 'review' | 'debug' | 'explain';
    language: string;
    complexity: 'simple' | 'medium' | 'complex';
  }> {
    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 200,
      system: 'Analyze code requests and return JSON only.',
      messages: [{
        role: 'user',
        content: `Analyze this code request:
"${description}"

Return JSON:
{
  "action": "generate" | "review" | "debug" | "explain",
  "language": "detected programming language or 'multiple'",
  "complexity": "simple" | "medium" | "complex"
}`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    try {
      return JSON.parse(text);
    } catch {
      return { action: 'generate', language: 'unknown', complexity: 'medium' };
    }
  }

  private async generateCode(
    description: string,
    taskType: { language: string; complexity: string }
  ): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 4000,
      system: `You are an expert programmer. Generate clean, well-documented code.
- Use best practices and modern patterns
- Include helpful comments
- Handle edge cases
- Make it production-ready
${taskType.language !== 'unknown' ? `Primary language: ${taskType.language}` : ''}`,
      messages: [{
        role: 'user',
        content: description
      }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  private async reviewCode(description: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 2000,
      system: `You are a senior code reviewer. Provide thorough, constructive feedback:
- Security vulnerabilities
- Performance issues
- Code quality and readability
- Best practices violations
- Suggestions for improvement
Format your review clearly with sections.`,
      messages: [{
        role: 'user',
        content: `Review this code:\n\n${description}`
      }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  private async debugCode(description: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 2000,
      system: `You are an expert debugger. Analyze the code and error:
1. Identify the root cause
2. Explain why it happens
3. Provide the fix
4. Suggest how to prevent similar issues`,
      messages: [{
        role: 'user',
        content: `Debug this:\n\n${description}`
      }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  private async explainCode(description: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 2000,
      system: `You explain code clearly for developers of all levels:
- Break down complex logic
- Explain the purpose of each section
- Describe the data flow
- Note any patterns or techniques used
- Highlight potential gotchas`,
      messages: [{
        role: 'user',
        content: `Explain this code:\n\n${description}`
      }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }
}
