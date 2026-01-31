import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { Skill, SkillContext, SkillResult } from './registry.js';

export class WebsiteSkill implements Skill {
  name = 'website';
  description = 'Build and deploy modern websites and landing pages';
  categories = ['website', 'design'];

  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({ apiKey: config.ai.apiKey });
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    logger.task(context.taskId, 'Starting website creation...');

    try {
      // Step 1: Analyze requirements
      const requirements = await this.analyzeRequirements(context.description);

      // Step 2: Generate website code
      const code = await this.generateCode(requirements);

      // Step 3: Deploy to Vercel (if configured)
      let deployUrl = '';
      if (config.mcp.vercel.token) {
        deployUrl = await this.deploy(code, context.taskId);
      }

      const deliverable = deployUrl
        ? `Your website is live!\n\n**URL:** ${deployUrl}\n\n**Code:**\n\`\`\`html\n${code.slice(0, 2000)}...\n\`\`\``
        : `Here's your website code:\n\n\`\`\`html\n${code}\n\`\`\`\n\n*Note: Vercel deployment not configured. Add VERCEL_TOKEN to deploy automatically.*`;

      logger.task(context.taskId, `Website created${deployUrl ? ` and deployed to ${deployUrl}` : ''}`);

      return {
        success: true,
        deliverable,
        approach: `Analyzed requirements, generated ${requirements.style} website${deployUrl ? ', deployed to Vercel' : ''}`,
        metadata: {
          deployUrl,
          style: requirements.style,
          sections: requirements.sections
        }
      };
    } catch (error) {
      logger.error('Website skill error:', error);
      return {
        success: false,
        deliverable: `Website creation failed: ${error instanceof Error ? error.message : String(error)}`,
        approach: 'Failed during execution'
      };
    }
  }

  private async analyzeRequirements(description: string): Promise<{
    style: string;
    sections: string[];
    colorScheme: string;
    features: string[];
  }> {
    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 500,
      system: 'You analyze website requirements. Return JSON only.',
      messages: [{
        role: 'user',
        content: `Analyze this website request:
"${description}"

Return JSON:
{
  "style": "modern" | "minimal" | "bold" | "corporate",
  "sections": ["hero", "features", "testimonials", "cta", etc.],
  "colorScheme": "dark" | "light" | "colorful",
  "features": ["responsive", "animations", etc.]
}`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return JSON.parse(text);
  }

  private async generateCode(requirements: {
    style: string;
    sections: string[];
    colorScheme: string;
    features: string[];
  }): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 4000,
      system: `You are an expert frontend developer. Generate a complete, production-ready single-page website.
Use modern HTML5, Tailwind CSS (via CDN), and vanilla JavaScript.
The code should be beautiful, responsive, and ready to deploy.
Return ONLY the HTML code, no explanations.`,
      messages: [{
        role: 'user',
        content: `Create a ${requirements.style} website with ${requirements.colorScheme} color scheme.

Sections needed: ${requirements.sections.join(', ')}
Features: ${requirements.features.join(', ')}

Generate a complete, beautiful HTML file with inline Tailwind CSS.`
      }]
    });

    let code = response.content[0].type === 'text' ? response.content[0].text : '';

    // Clean up code blocks if present
    code = code.replace(/```html\n?/g, '').replace(/```\n?/g, '');

    return code;
  }

  private async deploy(code: string, taskId: string): Promise<string> {
    // In production, deploy to Vercel using their API
    // This is a simplified implementation

    if (!config.mcp.vercel.token) {
      return '';
    }

    try {
      // Create deployment
      const projectName = `agent-bounty-${taskId.slice(0, 8)}`;

      // Vercel deployment API
      const response = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.mcp.vercel.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: projectName,
          files: [
            {
              file: 'index.html',
              data: Buffer.from(code).toString('base64'),
              encoding: 'base64'
            }
          ],
          projectSettings: {
            framework: null
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        logger.warn('Vercel deployment failed:', error);
        return '';
      }

      const data = await response.json();
      return `https://${data.url}`;
    } catch (error) {
      logger.warn('Vercel deployment error:', error);
      return '';
    }
  }
}
