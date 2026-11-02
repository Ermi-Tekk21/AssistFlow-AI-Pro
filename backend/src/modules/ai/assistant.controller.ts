import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { assistantService } from "./assistant.service";
import { getAuthenticatedUserId } from "../../middleware/auth";

const MessageInputSchema = z.object({
  message: z.string().min(1, "Message is required"),
  sessionId: z.string().uuid().optional(),
});

export class AssistantController {
  async handleMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const parsed = MessageInputSchema.parse(req.body);

      const result = await assistantService.processMessage(
        userId,
        parsed.message,
        parsed.sessionId
      );

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId : undefined;

      const session = await assistantService.getOrCreateSession(userId, sessionId);
      res.status(200).json({ data: session });
    } catch (err) {
      next(err);
    }
  }
}

export const assistantController = new AssistantController();
