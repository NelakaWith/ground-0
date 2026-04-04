import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

// Limit input to ~2500 chars (~600 tokens) — news ledes carry all key info
const MAX_INPUT_CHARS = 2500;

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

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'GROQ_API_KEY is not set. Structured analysis will be disabled.',
      );
    }
    this.groq = new Groq({ apiKey });
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
    try {
      const model =
        this.configService.get<string>('GROQ_MODEL') ||
        'llama-3.3-70b-versatile';
      const response = await this.callWithRateLimit(() =>
        this.groq.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: `Identify the primary "Target" (person, entity, or process) and key "Entities" in the text. Output JSON: {"target": string, "entities": string[]}`,
            },
            { role: 'user', content: text.substring(0, MAX_INPUT_CHARS) },
          ],
          response_format: { type: 'json_object' },
        }),
      );

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from Groq');

      return JSON.parse(content) as { target: string; entities: string[] };
    } catch (error) {
      if (error instanceof GroqRateLimitError) throw error;
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
    try {
      const model =
        this.configService.get<string>('GROQ_MODEL') ||
        'llama-3.3-70b-versatile';
      const response = await this.callWithRateLimit(() =>
        this.groq.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: `Analyze this text relative to target: "${target}". Output JSON: {"sentimentScore": number (-1 to 1), "chargedAdjectives": string[], "summary": string (1 sentence)}`,
            },
            { role: 'user', content: text.substring(0, MAX_INPUT_CHARS) },
          ],
          response_format: { type: 'json_object' },
        }),
      );

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from Groq');

      return JSON.parse(content) as {
        sentimentScore: number;
        chargedAdjectives: string[];
        summary: string;
      };
    } catch (error) {
      if (error instanceof GroqRateLimitError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in Pass 2 (Framing Extraction): ${message}`);
      throw error;
    }
  }
}
