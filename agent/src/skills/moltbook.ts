import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';
const CREDENTIALS_PATH = path.join(os.homedir(), '.config', 'moltbook', 'credentials.json');

interface MoltbookCredentials {
  apiKey: string;
  agentName: string;
  claimUrl?: string;
  verified: boolean;
  registeredAt: string;
}

interface MoltbookPost {
  id: string;
  title: string;
  content: string;
  url?: string;
  submolt?: string;
  upvotes: number;
  commentCount: number;
  createdAt: string;
}

interface MoltbookAgent {
  name: string;
  description: string;
  karma: number;
  followers: number;
  following: number;
  posts: number;
}

export class MoltbookSkill {
  private credentials?: MoltbookCredentials;
  private lastPostTime?: Date;
  private lastHeartbeat?: Date;

  constructor() {}

  /**
   * Initialize - load credentials if they exist
   */
  async initialize(): Promise<boolean> {
    try {
      const data = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
      this.credentials = JSON.parse(data);
      logger.info(`Moltbook: Loaded credentials for ${this.credentials?.agentName}`);
      return true;
    } catch {
      logger.info('Moltbook: No existing credentials found');
      return false;
    }
  }

  /**
   * Register agent on Moltbook
   * Returns claim URL for Twitter verification
   */
  async register(name: string, description: string): Promise<{
    success: boolean;
    claimUrl?: string;
    verificationCode?: string;
    error?: string;
  }> {
    if (this.credentials?.verified) {
      return { success: true, error: 'Already registered and verified' };
    }

    try {
      const response = await fetch(`${MOLTBOOK_API}/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Registration failed: ${error}` };
      }

      const data = await response.json();

      // Store credentials
      this.credentials = {
        apiKey: data.api_key,
        agentName: name,
        claimUrl: data.claim_url,
        verified: false,
        registeredAt: new Date().toISOString()
      };

      await this.saveCredentials();

      logger.info(`Moltbook: Registered as ${name}, awaiting Twitter verification`);

      return {
        success: true,
        claimUrl: data.claim_url,
        verificationCode: data.verification_code
      };
    } catch (error) {
      logger.error('Moltbook registration failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Mark as verified after Twitter claim
   */
  async markVerified(): Promise<void> {
    if (this.credentials) {
      this.credentials.verified = true;
      await this.saveCredentials();
      logger.info('Moltbook: Account verified');
    }
  }

  /**
   * Create a text post
   */
  async createPost(title: string, content: string, submolt?: string): Promise<{
    success: boolean;
    postId?: string;
    error?: string;
  }> {
    if (!this.credentials?.apiKey) {
      return { success: false, error: 'Not registered on Moltbook' };
    }

    // Check 30-minute cooldown
    if (this.lastPostTime) {
      const elapsed = Date.now() - this.lastPostTime.getTime();
      if (elapsed < 30 * 60 * 1000) {
        const remaining = Math.ceil((30 * 60 * 1000 - elapsed) / 60000);
        return { success: false, error: `Post cooldown: ${remaining} minutes remaining` };
      }
    }

    try {
      const body: Record<string, string> = { title, content };
      if (submolt) body.submolt = submolt;

      const response = await fetch(`${MOLTBOOK_API}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.credentials.apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Post failed: ${error}` };
      }

      const data = await response.json();
      this.lastPostTime = new Date();

      logger.info(`Moltbook: Posted "${title}" (${data.id})`);

      return { success: true, postId: data.id };
    } catch (error) {
      logger.error('Moltbook post failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Create a link post
   */
  async createLinkPost(title: string, url: string, submolt?: string): Promise<{
    success: boolean;
    postId?: string;
    error?: string;
  }> {
    if (!this.credentials?.apiKey) {
      return { success: false, error: 'Not registered on Moltbook' };
    }

    try {
      const body: Record<string, string> = { title, url };
      if (submolt) body.submolt = submolt;

      const response = await fetch(`${MOLTBOOK_API}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.credentials.apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Link post failed: ${error}` };
      }

      const data = await response.json();
      this.lastPostTime = new Date();

      logger.info(`Moltbook: Posted link "${title}"`);

      return { success: true, postId: data.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Add a comment to a post
   */
  async comment(postId: string, content: string, parentId?: string): Promise<{
    success: boolean;
    commentId?: string;
    error?: string;
  }> {
    if (!this.credentials?.apiKey) {
      return { success: false, error: 'Not registered on Moltbook' };
    }

    try {
      const body: Record<string, string> = { content };
      if (parentId) body.parent_id = parentId;

      const response = await fetch(`${MOLTBOOK_API}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.credentials.apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Comment failed: ${error}` };
      }

      const data = await response.json();
      logger.info(`Moltbook: Commented on post ${postId}`);

      return { success: true, commentId: data.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Upvote a post
   */
  async upvotePost(postId: string): Promise<boolean> {
    if (!this.credentials?.apiKey) return false;

    try {
      const response = await fetch(`${MOLTBOOK_API}/posts/${postId}/upvote`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.credentials.apiKey}` }
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Upvote a comment
   */
  async upvoteComment(commentId: string): Promise<boolean> {
    if (!this.credentials?.apiKey) return false;

    try {
      const response = await fetch(`${MOLTBOOK_API}/comments/${commentId}/upvote`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.credentials.apiKey}` }
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Follow another agent
   */
  async follow(agentName: string): Promise<boolean> {
    if (!this.credentials?.apiKey) return false;

    try {
      const response = await fetch(`${MOLTBOOK_API}/agents/${agentName}/follow`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.credentials.apiKey}` }
      });

      if (response.ok) {
        logger.info(`Moltbook: Now following ${agentName}`);
      }

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Unfollow an agent
   */
  async unfollow(agentName: string): Promise<boolean> {
    if (!this.credentials?.apiKey) return false;

    try {
      const response = await fetch(`${MOLTBOOK_API}/agents/${agentName}/follow`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.credentials.apiKey}` }
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get feed (hot posts)
   */
  async getFeed(sort: 'hot' | 'new' | 'top' = 'hot', limit = 25): Promise<MoltbookPost[]> {
    if (!this.credentials?.apiKey) return [];

    try {
      const response = await fetch(
        `${MOLTBOOK_API}/feed?sort=${sort}&limit=${limit}`,
        { headers: { 'Authorization': `Bearer ${this.credentials.apiKey}` } }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.posts || [];
    } catch {
      return [];
    }
  }

  /**
   * Search posts
   */
  async search(query: string, type: 'posts' | 'agents' = 'posts', limit = 20): Promise<any[]> {
    if (!this.credentials?.apiKey) return [];

    try {
      const response = await fetch(
        `${MOLTBOOK_API}/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`,
        { headers: { 'Authorization': `Bearer ${this.credentials.apiKey}` } }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.results || [];
    } catch {
      return [];
    }
  }

  /**
   * Get own profile
   */
  async getProfile(): Promise<MoltbookAgent | null> {
    if (!this.credentials?.apiKey) return null;

    try {
      const response = await fetch(`${MOLTBOOK_API}/agents/me`, {
        headers: { 'Authorization': `Bearer ${this.credentials.apiKey}` }
      });

      if (!response.ok) return null;

      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Get another agent's profile
   */
  async getAgentProfile(name: string): Promise<MoltbookAgent | null> {
    if (!this.credentials?.apiKey) return null;

    try {
      const response = await fetch(
        `${MOLTBOOK_API}/agents/profile?name=${encodeURIComponent(name)}`,
        { headers: { 'Authorization': `Bearer ${this.credentials.apiKey}` } }
      );

      if (!response.ok) return null;

      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Heartbeat check - fetch latest from Moltbook
   * Should be called every 4+ hours
   */
  async heartbeat(): Promise<{
    shouldEngage: boolean;
    interestingPosts: MoltbookPost[];
  }> {
    // Prevent over-polling
    if (this.lastHeartbeat) {
      const elapsed = Date.now() - this.lastHeartbeat.getTime();
      if (elapsed < 4 * 60 * 60 * 1000) { // 4 hours
        return { shouldEngage: false, interestingPosts: [] };
      }
    }

    this.lastHeartbeat = new Date();

    try {
      // Fetch heartbeat.md for any platform updates
      const heartbeatResponse = await fetch('https://www.moltbook.com/heartbeat.md');
      if (heartbeatResponse.ok) {
        const heartbeatContent = await heartbeatResponse.text();
        logger.info('Moltbook heartbeat:', heartbeatContent.slice(0, 100));
      }

      // Get interesting posts to potentially engage with
      const feed = await this.getFeed('hot', 10);
      const interestingPosts = feed.filter(post =>
        post.content?.toLowerCase().includes('bounty') ||
        post.content?.toLowerCase().includes('freelance') ||
        post.content?.toLowerCase().includes('ai agent') ||
        post.content?.toLowerCase().includes('crypto')
      );

      return {
        shouldEngage: interestingPosts.length > 0,
        interestingPosts
      };
    } catch (error) {
      logger.error('Moltbook heartbeat failed:', error);
      return { shouldEngage: false, interestingPosts: [] };
    }
  }

  /**
   * Post about a completed task (for building reputation)
   */
  async announceCompletedTask(taskType: string, description: string): Promise<boolean> {
    const title = `✅ Completed: ${taskType}`;
    const content = `Just finished a ${taskType} task!\n\n${description}\n\n#AgentBounty #AIFreelancer`;

    const result = await this.createPost(title, content, 'agents');
    return result.success;
  }

  /**
   * Save credentials to disk
   */
  private async saveCredentials(): Promise<void> {
    if (!this.credentials) return;

    try {
      const dir = path.dirname(CREDENTIALS_PATH);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(CREDENTIALS_PATH, JSON.stringify(this.credentials, null, 2));
    } catch (error) {
      logger.error('Failed to save Moltbook credentials:', error);
    }
  }

  /**
   * Check if registered
   */
  isRegistered(): boolean {
    return !!this.credentials?.apiKey;
  }

  /**
   * Check if verified
   */
  isVerified(): boolean {
    return !!this.credentials?.verified;
  }

  /**
   * Get claim URL for Twitter verification
   */
  getClaimUrl(): string | undefined {
    return this.credentials?.claimUrl;
  }
}

// Singleton instance
let moltbookInstance: MoltbookSkill | null = null;

export async function getMoltbookSkill(): Promise<MoltbookSkill> {
  if (!moltbookInstance) {
    moltbookInstance = new MoltbookSkill();
    await moltbookInstance.initialize();
  }
  return moltbookInstance;
}
