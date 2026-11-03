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
import { User } from "../../entities/User";
import { getDefaultEmail } from "../auth/auth.service";

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

      const cancelled = await calendarService.cancelEvent(userId, eventId);
      res.status(200).json({ data: cancelled });
    } catch (err) {
      next(err);
    }
  }

  async deleteEventPermanently(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const eventId = String(req.params.id);

      await calendarService.deleteEventPermanently(userId, eventId);
      res.status(200).json({ status: "success", message: "Event permanently deleted" });
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

      // State is used to bind the returned token to the authenticated user ID
      const state = req.query.userId || req.userId || "";

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent${
        state ? `&state=${encodeURIComponent(String(state))}` : ""
      }`;

      res.status(200).json({ data: { authUrl } });
    } catch (err) {
      next(err);
    }
  }

  async handleOAuthCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.query.code as string | undefined;
      const state = req.query.state as string | undefined;
      const error = req.query.error as string | undefined;

      if (error) {
        console.error("[Google OAuth Callback Error]:", error);
        res.redirect(`http://localhost:5173/?google_error=${encodeURIComponent(error)}`);
        return;
      }

      if (!code) {
        res.status(400).send("Missing authorization code from Google OAuth.");
        return;
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri =
        process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/calendar/auth/callback";

      if (!clientId || !clientSecret) {
        throw new Error("Missing Google OAuth Client ID or Client Secret");
      }

      let tokenRes: Response;
      try {
        tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });
      } catch (fetchErr: any) {
        console.error("[Google OAuth Network Error]:", fetchErr);
        res.redirect(
          `http://localhost:5173/?google_error=${encodeURIComponent(
            fetchErr.message || "Network timeout connecting to Google OAuth"
          )}`
        );
        return;
      }

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("[Google OAuth Token Exchange Failed]:", errText);
        let errorMsg = "Google rejected client credentials";
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error_description) {
            errorMsg = parsed.error_description;
          } else if (parsed.error) {
            errorMsg = parsed.error;
          }
        } catch {}
        res.redirect(
          `http://localhost:5173/?google_error=${encodeURIComponent(errorMsg)}`
        );
        return;
      }

      const tokenData = (await tokenRes.json()) as any;
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in;

      // Find user to associate: prefer state (userId), fallback to configured default user
      const userRepo = AppDataSource.getRepository(User);
      let targetUser: User | null = null;
      if (state) {
        targetUser = await userRepo.findOne({ where: { id: state } });
      }
      if (!targetUser) {
        const defaultEmail = getDefaultEmail();
        targetUser = await userRepo.findOne({ where: { email: defaultEmail } });
      }

      if (!targetUser) {
        res.status(404).send("User account not found for Google OAuth connection.");
        return;
      }

      const accountRepo = AppDataSource.getRepository(IntegrationAccount);
      let account = await accountRepo.findOne({
        where: { userId: targetUser.id, provider: "google" },
      });

      if (!account) {
        account = accountRepo.create({
          userId: targetUser.id,
          provider: "google",
          accessToken,
          refreshToken: refreshToken || null,
          expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
          scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
        });
      } else {
        account.accessToken = accessToken;
        if (refreshToken) account.refreshToken = refreshToken;
        if (expiresIn) account.expiresAt = new Date(Date.now() + expiresIn * 1000);
      }

      await accountRepo.save(account);
      console.log(
        `[Google OAuth] Connected Google Calendar for user: ${targetUser.email} (${targetUser.id})`
      );
      if (refreshToken) {
        console.log(`[Google OAuth] Permanent Refresh Token: ${refreshToken}`);
      }

      res.redirect("http://localhost:5173/?google_connected=true");
    } catch (err) {
      next(err);
    }
  }

  async getIntegrationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const accountRepo = AppDataSource.getRepository(IntegrationAccount);
      const account = await accountRepo.findOne({
        where: { userId, provider: "google" },
      });

      res.status(200).json({
        data: {
          connected: !!account && !!account.accessToken,
          hasRefreshToken: !!account?.refreshToken,
          expiresAt: account?.expiresAt || null,
        },
      });
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
          scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
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
