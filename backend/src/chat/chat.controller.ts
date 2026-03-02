/**
 * Chat Controller - Handles chat API endpoints
 */

import { Request, Response } from 'express';
import { chatService } from './chat.service';

export class ChatController {
  /**
   * POST /api/chat
   * Process a chat message
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { message } = req.body;
      const userId = (req as any).userId || 'admin123'; // From auth middleware
      const userProfile = (req as any).userProfile || {}; // From auth middleware

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      // Process message with chat service
      const response = await chatService.processMessage(userId, message, userProfile);

      res.json(response);
    } catch (error: any) {
      console.error('Chat error:', error);
      res.status(500).json({
        error: 'Failed to process message',
        details: error.message,
      });
    }
  }

  /**
   * DELETE /api/chat/history
   * Clear chat history for the user
   */
  async clearHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || 'admin123';

      chatService.clearConversation(userId);

      res.json({ message: 'Chat history cleared successfully' });
    } catch (error: any) {
      console.error('Clear history error:', error);
      res.status(500).json({
        error: 'Failed to clear history',
        details: error.message,
      });
    }
  }
}

export const chatController = new ChatController();
