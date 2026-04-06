import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Limit input to ~1500 chars (~375 tokens) — enough for clean article content
const MAX_INPUT_CHARS = 1500;
const MAX_REFINE_CHARS = 10000;

/** Thrown when Groq returns 429 — carries the required wait time. */
export class GroqRateLimitError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(
      `Groq rate limit hit. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`,
    );
    this.name = 'GroqRateLimitError';
  }
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly groq: Groq;
  private readonly gemini: GoogleGenerativeAI;

  constructor(private readonly configService: ConfigService) {
    // Groq Setup
    const groqKey = this.configService.get<string>('GROQ_API_KEY');
    this.groq = new Groq({ apiKey: groqKey });

    // Gemini Setup
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.gemini = new GoogleGenerativeAI(geminiKey || '');
  }

  /**
   * Unified dispatcher for AI completions.
   */
  private async executeCompletion(
    systemPrompt: string,
    userContent: string,
    jsonMode = false,
  ): Promise<string> {
    const provider = this.configService.get<string>('AI_PROVIDER') || 'groq';

    try {
      if (provider === 'gemini') {
        const modelName =
          this.configService.get<string>('GEMINI_MODEL') ||
          'gemini-2.5-flash-lite';
        const model = this.gemini.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
          generationConfig: jsonMode
            ? { responseMimeType: 'application/json' }
            : {},
        });

        const result = await model.generateContent(userContent);
        const response = result.response;
        let text = response.text();

        // Sanitize JSON responses that might be wrapped in markdown blocks
        if (jsonMode) {
          text = text.replace(/```json\n?|\n?```/g, '').trim();
        }
        return text;
      } else {
        const modelName =
          this.configService.get<string>('GROQ_MODEL') ||
          'llama-3.3-70b-versatile';
        const response = await this.callWithRateLimit(() =>
          this.groq.chat.completions.create({
            model: modelName,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent },
            ],
            response_format: jsonMode ? { type: 'json_object' } : undefined,
          }),
        );
        return response.choices[0]?.message?.content || '';
      }
    } catch (error) {
      if (error instanceof GroqRateLimitError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`AI Completion Error (${provider}): ${message}`);
      throw error;
    }
  }

  /**
   * AI-powered Content Refinement (Stripping).
   * Refines messy scraper output into clean, high-fidelity article prose.
   *
   * @param {string} rawMarkdown - The raw markdown extracted by the crawler.
   * @returns {Promise<string>} The refined, clean article content.
   */
  async refineContent(rawMarkdown: string): Promise<string> {
    const systemPrompt = `You are an expert news editor. Your task is to extract the main article text and title from a messy markdown source.
Rules:
1. REMOVE all navigation links, social media widgets, related news lists, and ads.
2. REMOVE copyright notices, comment section guidelines, and site footers.
3. FIX any broken formatting or concatenated text that wasn't properly spaced.
4. Output ONLY the clean article title and the body prose in Markdown format.
5. If there are multiple articles or live updates, ONLY extract the primary one relevant to the title.
Do NOT include any preamble or extra text. Just the cleaned article.`;

    try {
      const content = await this.executeCompletion(
        systemPrompt,
        rawMarkdown.substring(0, MAX_REFINE_CHARS),
        false,
      );
      return content.trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in Content Refinement: ${message}`);
      return rawMarkdown; // Fallback to raw if refinement fails
    }
  }

  /** Parses Groq 429 message ("try again in 21m4.032s") into milliseconds. */
  private parseRetryAfterMs(error: unknown): number {
    const msg = error instanceof Error ? error.message : String(error);
    const match = msg.match(/try again in (?:(\d+)m)?(?:([\d.]+)s)?/);
    if (match) {
      const minutes = parseFloat(match[1] ?? '0');
      const seconds = parseFloat(match[2] ?? '0');
      return (minutes * 60 + seconds) * 1000;
    }
    return 60_000;
  }

  /** Calls fn(), throws GroqRateLimitError on 429 instead of blocking. */
  private async callWithRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('429') || msg.includes('rate_limit_exceeded')) {
        const retryAfterMs = this.parseRetryAfterMs(error);
        throw new GroqRateLimitError(retryAfterMs);
      }
      throw error;
    }
  }

  /**
   * Pass 1: Entity & Target Detection.
   * Identifies the primary "Target" (the main person, organization, or policy being discussed) and a list of secondary entities.
   *
   * @param {string} text - The full text of the news article to analyze.
   * @returns {Promise<{ target: string; entities: string[] }>} A promise that resolves to the identified primary target and a list of secondary entities.
   */
  async detectEntitiesAndTarget(
    text: string,
  ): Promise<{ target: string; entities: string[] }> {
    const systemPrompt = `Identify the primary "Target" (person, entity, or process) and key "Entities" in the text. Output JSON: {"target": string, "entities": string[]}`;

    try {
      const content = await this.executeCompletion(
        systemPrompt,
        text.substring(0, MAX_INPUT_CHARS),
        true,
      );
      return JSON.parse(content) as { target: string; entities: string[] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in Pass 1 (Entity Detection): ${message}`);
      throw error;
    }
  }

  /**
   * Pass 2: Sentiment & Adjective Extraction.
   * Quantifies sentiment relative to the identified target and extracts charged adjectives to highlight framing bias.
   *
   * @param {string} text - The full text of the news article.
   * @param {string} target - The primary subject (identified in Pass 1) against which the sentiment will be scored.
   * @returns {Promise<{ sentimentScore: number; chargedAdjectives: string[]; summary: string; }>} A promise resolving to the sentiment data, adjective list, and a framing summary.
   */
  async extractSentimentAndFraming(
    text: string,
    target: string,
  ): Promise<{
    sentimentScore: number;
    chargedAdjectives: string[];
    summary: string;
  }> {
    const systemPrompt = `Analyze this text relative to target: "${target}". Output JSON: {"sentimentScore": number (-1 to 1), "chargedAdjectives": string[], "summary": string (1 sentence)}`;

    try {
      const content = await this.executeCompletion(
        systemPrompt,
        text.substring(0, MAX_INPUT_CHARS),
        true,
      );
      return JSON.parse(content) as {
        sentimentScore: number;
        chargedAdjectives: string[];
        summary: string;
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in Pass 2 (Framing Extraction): ${message}`);
      throw error;
    }
  }
}
