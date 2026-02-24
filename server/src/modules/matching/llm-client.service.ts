import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Tries Gemini first, falls back to Groq if configured.
   */
  async analyze(prompt: string): Promise<{ content: string } | null> {
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    const groqKey = this.configService.get<string>('GROQ_API_KEY');

    if (geminiKey) {
      try {
        const result = await this.callGemini(prompt, geminiKey);
        return { content: result };
      } catch (error: any) {
        this.logger.warn(`Gemini API failed: ${error.message}. Falling back...`);
      }
    }

    if (groqKey) {
      try {
        const result = await this.callGroq(prompt, groqKey);
        return { content: result };
      } catch (error: any) {
        this.logger.error(`Groq API failed: ${error.message}.`);
      }
    }

    this.logger.error('All configured LLM providers failed.');
    return null;
  }

  private async callGemini(prompt: string, key: string): Promise<string> {
    const model = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const response = await axios.post(
      url,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        // Set deterministic generation parameters
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 1,
        },
      },
      { timeout: 15000 },
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Invalid response format from Gemini');
    }

    return text;
  }

  private async callGroq(prompt: string, key: string): Promise<string> {
    const model = this.configService.get<string>('GROQ_MODEL') || 'llama-3.1-8b-instant';
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const response = await axios.post(
      url,
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('Invalid response format from Groq');
    }

    return text;
  }
}
