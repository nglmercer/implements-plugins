import type { IPlugin, PluginContext } from "../../../mod.ts";
import type { EventBusPluginType } from "./event-bus.ts";
import { generateText } from "@xsai/generate-text";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentPluginType {
  metadata: { name: string; version: string };
  generateResponse(comment: string, context: ChatContext): Promise<string>;
  getStats(): AgentStats;
}

export interface ChatContext {
  nickname: string;
  comment: string;
  isFollower: boolean;
  isSubscriber: boolean;
  isModerator: boolean;
  followRole: number;
  recentHistory: HistoryEntry[];
}

export interface HistoryEntry {
  nickname: string;
  comment: string;
  timestamp: number;
}

export interface AgentStats {
  totalComments: number;
  filteredComments: number;
  responsesGenerated: number;
  errors: number;
}

export interface AgentConfig {
  baseURL: string;
  model: string;
  systemPrompt: string;
  maxContextMessages: number;
  minCommentLength: number;
  respondToMods: boolean;
  respondToSubs: boolean;
  respondToFollowers: boolean;
  respondToAll: boolean;
  temperature: number;
}

// ---------------------------------------------------------------------------
// Default configuration — local LM Studio
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: AgentConfig = {
  baseURL: "http://localhost:1234/v1/",
  model: "lfm2.5-vl-1.6b",
  systemPrompt:
    "You are a friendly and engaging live stream assistant. Respond to viewer comments in a natural, conversational way. Keep responses short (1-2 sentences), fun, and appropriate for a live chat. Address the user by their nickname when relevant.",
  maxContextMessages: 10,
  minCommentLength: 2,
  respondToMods: true,
  respondToSubs: true,
  respondToFollowers: true,
  respondToAll: false,
  temperature: 0.8,
};

// ---------------------------------------------------------------------------
// Relevance filter
// ---------------------------------------------------------------------------

function isRelevant(comment: string, context: ChatContext, config: AgentConfig): { relevant: boolean; reason: string } {
  const trimmed = comment.trim();

  if (trimmed.length < config.minCommentLength) {
    return { relevant: false, reason: "too_short" };
  }

  if (context.isModerator && !config.respondToMods) {
    return { relevant: false, reason: "mod_filtered" };
  }

  if (context.isSubscriber && !config.respondToSubs) {
    return { relevant: false, reason: "sub_filtered" };
  }

  if (context.isFollower && !config.respondToFollowers) {
    return { relevant: false, reason: "follower_filtered" };
  }

  if (!config.respondToAll && !context.isFollower && !context.isSubscriber && !context.isModerator) {
    return { relevant: false, reason: "not_follower_sub" };
  }

  return { relevant: true, reason: "passed" };
}

// ---------------------------------------------------------------------------
// Agent plugin
// ---------------------------------------------------------------------------

class AiAgentPlugin implements IPlugin {
  readonly metadata = {
    name: "ai-agent",
    version: "1.0.0",
    emits: ["agent"] as const,
    listens: ["tiktok"] as const,
  };

  private config: AgentConfig;
  private stats: AgentStats = {
    totalComments: 0,
    filteredComments: 0,
    responsesGenerated: 0,
    errors: 0,
  };
  private history: HistoryEntry[] = [];
  private bus: EventBusPluginType | undefined;

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setup(_ctx: PluginContext): void {}

  onEnable(ctx: PluginContext): void {
    this.bus = ctx.getPlugin<EventBusPluginType>("event-bus");
    if (!this.bus) return;

    this.bus.on(
      (e) => e.platform === "tiktok" && e.eventName === "chat",
      async (event) => {
        await this.handleChat(event);
      },
    );

    console.log(`[ai-agent] enabled | model: ${this.config.model} | baseURL: ${this.config.baseURL}`);
  }

  onDisable(_ctx: PluginContext): void {}

  onUnload(_ctx: PluginContext): void {}

  getStats(): AgentStats {
    return { ...this.stats };
  }

  async generateResponse(comment: string, context: ChatContext): Promise<string> {
    const recentMessages = context.recentHistory
      .slice(-this.config.maxContextMessages)
      .map((h) => ({
        role: "user" as const,
        content: `${h.nickname}: ${h.comment}`,
      }));

    const { text } = await generateText({
      baseURL: this.config.baseURL,
      model: this.config.model,
      messages: [
        { role: "system", content: this.config.systemPrompt },
        ...recentMessages,
        { role: "user", content: `${context.nickname}: ${comment}` },
      ],
      temperature: this.config.temperature,
    });

    return text ?? "";
  }

  private async handleChat(event: { data: Record<string, unknown> }): Promise<void> {
    const data = event.data;
    const comment = (data.comment as string) ?? "";
    const nickname = (data.nickname as string) ?? "unknown";

    this.stats.totalComments++;

    const context: ChatContext = {
      nickname,
      comment,
      isFollower: (data.userIdentity as Record<string, unknown>)?.isFollowerOfAnchor === true,
      isSubscriber: (data.isSubscriber as boolean) ?? false,
      isModerator: (data.isModerator as boolean) ?? false,
      followRole: (data.followRole as number) ?? 0,
      recentHistory: this.history,
    };

    const { relevant, reason } = isRelevant(comment, context, this.config);

    if (!relevant) {
      this.stats.filteredComments++;
      console.log(`[ai-agent] filtered | ${nickname}: "${comment}" | reason: ${reason}`);
      return;
    }

    this.history.push({
      nickname,
      comment,
      timestamp: Date.now(),
    });

    if (this.history.length > 100) {
      this.history = this.history.slice(-50);
    }

    try {
      console.log(`[ai-agent] processing | ${nickname}: "${comment}"`);
      const response = await this.generateResponse(comment, context);
      this.stats.responsesGenerated++;

      console.log(`[ai-agent] response | → ${response}`);

      this.bus?.emit("agent", "response", {
        originalComment: comment,
        originalUser: nickname,
        response,
        platform: "tiktok",
        timestamp: Date.now(),
      });
    } catch (err) {
      this.stats.errors++;
      console.error(`[ai-agent] error generating response:`, err);
    }
  }
}

const aiAgent = new AiAgentPlugin();
export default aiAgent;
