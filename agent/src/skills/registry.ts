import { ResearchSkill } from './research.js';
import { WebsiteSkill } from './website.js';
import { WritingSkill } from './writing.js';
import { CodeSkill } from './code.js';
import { logger } from '../utils/logger.js';

export interface SkillContext {
  taskId: string;
  description: string;
  category: string;
}

export interface SkillResult {
  success: boolean;
  deliverable: string;
  approach: string;
  metadata?: Record<string, unknown>;
}

export interface Skill {
  name: string;
  description: string;
  categories: string[];
  execute(context: SkillContext): Promise<SkillResult>;
}

export class SkillRegistry {
  private skills = new Map<string, Skill>();

  async loadSkills(): Promise<void> {
    // Register built-in skills
    this.register(new ResearchSkill());
    this.register(new WebsiteSkill());
    this.register(new WritingSkill());
    this.register(new CodeSkill());

    logger.info(`Loaded ${this.skills.size} skills`);
  }

  register(skill: Skill): void {
    for (const category of skill.categories) {
      this.skills.set(category, skill);
    }
    logger.debug(`Registered skill: ${skill.name} for categories: ${skill.categories.join(', ')}`);
  }

  getSkill(category: string): Skill | undefined {
    return this.skills.get(category) || this.skills.get('other');
  }

  listSkills(): { name: string; categories: string[] }[] {
    const seen = new Set<string>();
    const result: { name: string; categories: string[] }[] = [];

    for (const skill of this.skills.values()) {
      if (!seen.has(skill.name)) {
        seen.add(skill.name);
        result.push({
          name: skill.name,
          categories: skill.categories
        });
      }
    }

    return result;
  }

  count(): number {
    return new Set([...this.skills.values()].map(s => s.name)).size;
  }
}
