import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface ChatCitation {
  field_name: string;
  source_snippet: string;
  confidence: number;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatCitation[];
  created_at?: string;
}

export interface SendMessageResult {
  reply: string;
  citations: ChatCitation[];
}

@Injectable({ providedIn: 'root' })
export class ChatMatriculaService {
  private readonly api = inject(ApiService);

  async sendMessage(analysisJobId: string, message: string): Promise<SendMessageResult> {
    return this.api.post<SendMessageResult>('chat-matricula', { analysisJobId, message });
  }

  async getHistory(analysisJobId: string): Promise<ChatMessage[]> {
    const messages = await this.api.get<ChatMessage[]>(
      `chat-messages?analysis_job_id=${analysisJobId}`
    );
    return messages ?? [];
  }
}
