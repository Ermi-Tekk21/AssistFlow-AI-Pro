import { Request, Response, NextFunction } from "express";
import { calendarService } from "./calendar.service";
import {
  CreateCalendarEventInputSchema,
  UpdateCalendarEventInputSchema,
  ListCalendarEventsQuerySchema,
} from "./calendar.validation";
import { getAuthenticatedUserId } from "../../middleware/auth";
import { AppDataSource } from "../../config/database";
import { IntegrationAccount } from "../../entities/IntegrationAccount";

export class CalendarController {
  async listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const query = ListCalendarEventsQuerySchema.parse(req.query);

      const result = await calendarService.listEvents(userId, query);
      res.status(200).json({ data: result.events, total: result.total });
    } catch (err) {
      next(err);
    }
  }

  async getEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const eventId = String(req.params.id);

      const event = await calendarService.getEventById(userId, eventId);
      res.status(200).json({ data: event });
    } catch (err) {
      next(err);
    }
  }

  async createEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const input = CreateCalendarEventInputSchema.parse(req.body);

      const result = await calendarService.createEvent(userId, input);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const eventId = String(req.params.id);
      const input = UpdateCalendarEventInputSchema.parse(req.body);

      const result = await calendarService.updateEvent(userId, eventId, input);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async cancelEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const eventId = String(req.params.id);

      const event = await calendarService.cancelEvent(userId, eventId);
      res.status(200).json({ data: event, message: "Calendar event cancelled successfully" });
    } catch (err) {
      next(err);
    }
  }

  async getAuthUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID || "mock-client-id";
      const redirectUri =
        process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/calendar/auth/callback";
      const scope = encodeURIComponent(
        "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events"
      );

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

      res.status(200).json({ data: { authUrl } });
    } catch (err) {
      next(err);
    }
  }

  async connectAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { accessToken, refreshToken, expiresIn } = req.body;

      if (!accessToken) {
        res.status(400).json({ error: { message: "accessToken is required" } });
        return;
      }

      const accountRepo = AppDataSource.getRepository(IntegrationAccount);
      let account = await accountRepo.findOne({
        where: { userId, provider: "google" },
      });

      if (!account) {
        account = accountRepo.create({
          userId,
          provider: "google",
          accessToken,
          refreshToken: refreshToken || null,
          expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
          scope: "calendar",
        });
      } else {
        account.accessToken = accessToken;
        if (refreshToken) account.refreshToken = refreshToken;
        if (expiresIn) account.expiresAt = new Date(Date.now() + expiresIn * 1000);
      }

      await accountRepo.save(account);
      res.status(200).json({ data: { status: "connected", provider: "google" } });
    } catch (err) {
      next(err);
    }
  }
}

export const calendarController = new CalendarController();
