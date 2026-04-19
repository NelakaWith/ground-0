import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Limit input to ~5000 chars (~1250 tokens) — sufficient for framing/sentiment analysis
const MAX_INPUT_CHARS = 5000;
const MAX_REFINE_CHARS = 5000;

export interface ArticleAnalysis {
  target: string;
  entities: string[];
  sentimentScore: number;
  chargedAdjectives: string[];
  summary: string;
}

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
  async refineContent(
    rawMarkdown: string,
    expectedTitle: string,
  ): Promise<string> {
    const systemPrompt = `You are an expert news editor. Your task is to extract the main article text and title from a messy markdown source.
The article you are looking for is titled: "${expectedTitle}".

Rules:
1. REMOVE all navigation links, social media widgets, related news lists, and ads.
2. REMOVE copyright notices, comment section guidelines, and site footers.
3. FIX any broken formatting or concatenated text that wasn't properly spaced.
4. Output ONLY the clean article title and the body prose matching the expected title in Markdown format.
5. If there are multiple articles or lists of "Top Stories/Related News", IGNORE them and ONLY extract the primary story.
6. CRITICAL: If you cannot find a substantial article matching "${expectedTitle}" in the provided text, output exactly: [NO_ARTICLE_CONTENT_FOUND].
   Do NOT output placeholders, templates, or messages like "This is a placeholder".
Do NOT include any preamble or extra text. Just the cleaned article or the error token.`;

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
   * Combined Pass: Entity, Sentiment, and Framing Detection.
   * Performs entity extraction, sentiment scoring, and framing analysis in one LLM call.
   *
   * @param {string} text - The content (snippet or full) of the news article.
   * @param {boolean} isFullText - Whether the text is full-length or a snippet.
   * @returns {Promise<ArticleAnalysis>} The combined analysis results.
   */
  async analyzeArticle(
    text: string,
    isFullText: boolean,
  ): Promise<ArticleAnalysis> {
    const systemPrompt = `Analyze this [${
      isFullText ? 'Full Article' : 'Snippet'
    }].
1. Identify the primary "Target" (person, entity, or process).
2. Extract key "Entities".
3. Calculate "sentimentScore" relative to the target (-1 to 1).
4. Extract "chargedAdjectives" used for framing.
5. Provide a 1-sentence "summary" of the framing.

Output ONLY valid JSON:
{
  "target": string,
  "entities": string[],
  "sentimentScore": number,
  "chargedAdjectives": string[],
  "summary": string
}`;

    try {
      const content = await this.executeCompletion(
        systemPrompt,
        text.substring(0, MAX_INPUT_CHARS),
        true,
      );
      return JSON.parse(content) as ArticleAnalysis;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in Consolidated Analysis Pass: ${message}`);
      throw error;
    }
  }

  /**
   * Generates a vector embedding for a given text using Gemini.
   * Optimized to 10k chars as standard embedding models are context-limited.
   *
   * @param {string} text - The text to embed.
   * @returns {Promise<number[]>} The vector embedding.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const modelName =
        this.configService.get<string>('GEMINI_EMBEDDING_MODEL') ||
        'gemini-embedding-2-preview';
      const model = this.gemini.getGenerativeModel({
        model: modelName,
      });
      // Standard embedding models are most effective within the first ~2k-4k tokens.
      // Truncating to 10k chars is sufficient and saves compute.
      const result = await model.embedContent(text.substring(0, 10000));
      return result.embedding.values;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error generating embedding: ${message}`);
      throw error;
    }
  }
}
