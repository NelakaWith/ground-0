import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

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
      const response = await this.groq.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `Analyze the following news text.
            1. Identify the primary "Target" (the main person, organization, or policy being discussed).
            2. List all secondary entities mentioned.
            Output your response strictly in JSON format with keys "target" (string) and "entities" (array of strings).`,
          },
          { role: 'user', content: text.substring(0, 10000) }, // Limit input to stay in reasonable token bounds
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from Groq');

      return JSON.parse(content) as { target: string; entities: string[] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in Pass 1 (Entity Detection): ${message}`);
      return { target: 'Unknown', entities: [] };
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
      const response = await this.groq.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `Analyze the news text relative to the specific target: "${target}".
            1. Provide a sentiment score from -1.0 (extremely negative) to 1.0 (extremely positive).
            2. Extract a list of "Charged Adjectives" or phrases used to describe the target or the situation (e.g., "crippling", "essential", "landmark").
            3. A brief 1-sentence summary of the framing.
            Output as JSON with keys "sentimentScore" (number), "chargedAdjectives" (array), and "summary" (string).`,
          },
          { role: 'user', content: text.substring(0, 10000) },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from Groq');

      return JSON.parse(content) as {
        sentimentScore: number;
        chargedAdjectives: string[];
        summary: string;
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in Pass 2 (Framing Extraction): ${message}`);
      return {
        sentimentScore: 0,
        chargedAdjectives: [],
        summary: 'Analysis failed',
      };
    }
  }
}
