import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { Skill, SkillContext, SkillResult } from './registry.js';

export class WritingSkill implements Skill {
  name = 'writing';
  description = 'Create high-quality written content - blogs, threads, docs, copy';
  categories = ['writing', 'content', 'copywriting'];

  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: config.ai.apiKey });
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    logger.task(context.taskId, 'Starting content creation...');

    try {
      // Analyze what type of content is needed
      const contentType = await this.analyzeContentType(context.description);

      // Generate the content
      const content = await this.generateContent(context.description, contentType);

      logger.task(context.taskId, `Created ${contentType.type} content`);

      return {
        success: true,
        deliverable: content,
        approach: `Created ${contentType.type} content with ${contentType.tone} tone`,
        metadata: {
          contentType: contentType.type,
          tone: contentType.tone,
          wordCount: content.split(/\s+/).length
        }
      };
    } catch (error) {
      logger.error('Writing skill error:', error);
      return {
        success: false,
        deliverable: `Content creation failed: ${error instanceof Error ? error.message : String(error)}`,
        approach: 'Failed during execution'
      };
    }
  }

  private async analyzeContentType(description: string): Promise<{
    type: 'blog' | 'thread' | 'documentation' | 'copy' | 'email' | 'other';
    tone: string;
    length: 'short' | 'medium' | 'long';
    audience: string;
  }> {
    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 300,
      system: 'Analyze content requests and return JSON only.',
      messages: [{
        role: 'user',
        content: `Analyze this content request:
"${description}"

Return JSON:
{
  "type": "blog" | "thread" | "documentation" | "copy" | "email" | "other",
  "tone": "professional" | "casual" | "technical" | "persuasive" | "friendly",
  "length": "short" | "medium" | "long",
  "audience": "description of target audience"
}`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return JSON.parse(text);
  }

  private async generateContent(
    description: string,
    contentType: {
      type: string;
      tone: string;
      length: string;
      audience: string;
    }
  ): Promise<string> {
    const lengthGuide = {
      short: '200-400 words',
      medium: '500-800 words',
      long: '1000-1500 words'
    };

    let systemPrompt = `You are an expert content writer. Write in a ${contentType.tone} tone for ${contentType.audience}.`;

    // Add type-specific instructions
    switch (contentType.type) {
      case 'thread':
        systemPrompt += `
Create a Twitter/X thread format:
- Start with a strong hook
- Number each tweet (1/, 2/, etc.)
- Keep each tweet under 280 characters
- End with a call to action
- 10-15 tweets total`;
        break;

      case 'blog':
        systemPrompt += `
Create a blog post:
- Compelling headline
- Introduction that hooks the reader
- Clear sections with subheadings
- Actionable takeaways
- Strong conclusion
- ${lengthGuide[contentType.length as keyof typeof lengthGuide]}`;
        break;

      case 'documentation':
        systemPrompt += `
Create technical documentation:
- Clear, concise language
- Code examples where relevant
- Step-by-step instructions
- Proper formatting with headers
- Include any relevant warnings or notes`;
        break;

      case 'copy':
        systemPrompt += `
Create marketing copy:
- Focus on benefits, not features
- Strong headline and subheadlines
- Clear call to action
- Persuasive but authentic
- ${lengthGuide[contentType.length as keyof typeof lengthGuide]}`;
        break;

      default:
        systemPrompt += `\nTarget length: ${lengthGuide[contentType.length as keyof typeof lengthGuide]}`;
    }

    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Create content for:\n${description}`
      }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }
}
