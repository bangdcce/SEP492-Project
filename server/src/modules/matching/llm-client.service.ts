import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async analyze(prompt: string): Promise<{ content: string } | null> {
    try {
      const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
      const groqKey = this.configService.get<string>('GROQ_API_KEY');

      if (geminiKey) {
        try {
          const result = await this.callGemini(prompt, geminiKey);
          return { content: result };
        } catch (geminiErr) {
          this.logger.warn('Gemini call failed, trying Groq fallback...', geminiErr);
        }
      }

      if (groqKey) {
        try {
          const result = await this.callGroq(prompt, groqKey);
          return { content: result };
        } catch (groqErr) {
          this.logger.warn('Groq call also failed.', groqErr);
        }
      }

      this.logger.warn('No LLM API key available or all calls failed.');
      return null;
    } catch (err) {
      this.logger.error('LLM analyze error', err);
      return null;
    }
  }

  private async callGemini(prompt: string, key: string): Promise<string> {
    const model =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const response = await axios.post(
      url,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      },
      { timeout: 30000 },
    );

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
  }

  private async callGroq(prompt: string, key: string): Promise<string> {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const response = await axios.post(
      url,
      {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1024,
      },
      {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 30000,
      },
    );

    return response.data?.choices?.[0]?.message?.content || '';
  }
}
