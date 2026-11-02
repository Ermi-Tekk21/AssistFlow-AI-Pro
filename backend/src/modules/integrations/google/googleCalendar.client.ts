import { AppDataSource } from "../../../config/database";
import { IntegrationAccount } from "../../../entities/IntegrationAccount";

export interface GoogleCalendarEventPayload {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  location?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  conferenceData?: any;
}

export interface GoogleCalendarEventResponse {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: any;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  status?: string;
}

export interface GoogleCalendarTransport {
  listEvents(
    accessToken: string,
    params: { timeMin?: string; timeMax?: string; maxResults?: number }
  ): Promise<GoogleCalendarEventResponse[]>;
  createEvent(
    accessToken: string,
    payload: GoogleCalendarEventPayload
  ): Promise<GoogleCalendarEventResponse>;
  updateEvent(
    accessToken: string,
    eventId: string,
    payload: Partial<GoogleCalendarEventPayload>
  ): Promise<GoogleCalendarEventResponse>;
  deleteEvent(accessToken: string, eventId: string): Promise<void>;
}

export class GoogleCalendarClient {
  private customTransport?: GoogleCalendarTransport;

  public setTransport(transport: GoogleCalendarTransport | undefined): void {
    this.customTransport = transport;
  }

  private async getValidAccessToken(userId: string): Promise<string> {
    const accountRepo = AppDataSource.getRepository(IntegrationAccount);
    const account = await accountRepo.findOne({
      where: { userId, provider: "google" },
    });

    if (!account) {
      // In development or testing without OAuth linked, return simulated token
      return "simulated-oauth-token";
    }

    // Check if token is expired and needs refresh
    if (account.expiresAt && account.expiresAt.getTime() <= Date.now() + 60000 && account.refreshToken) {
      const refreshed = await this.refreshAccessToken(account.refreshToken);
      account.accessToken = refreshed.accessToken;
      account.expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
      await accountRepo.save(account);
      return account.accessToken;
    }

    return account.accessToken;
  }

  private async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET for OAuth refresh");
    }

    const tokenUrl = "https://oauth2.googleapis.com/token";
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to refresh Google OAuth token (status ${res.status})`);
    }

    const data = (await res.json()) as any;
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    };
  }

  async listEvents(
    userId: string,
    options: { timeMin?: string; timeMax?: string; maxResults?: number } = {}
  ): Promise<GoogleCalendarEventResponse[]> {
    const token = await this.getValidAccessToken(userId);

    if (this.customTransport) {
      return await this.customTransport.listEvents(token, options);
    }

    const query = new URLSearchParams();
    if (options.timeMin) query.set("timeMin", options.timeMin);
    if (options.timeMax) query.set("timeMax", options.timeMax);
    if (options.maxResults) query.set("maxResults", String(options.maxResults));
    query.set("singleEvents", "true");
    query.set("orderBy", "startTime");

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Google Calendar API list error (status ${res.status})`);
    }

    const data = (await res.json()) as any;
    return data.items || [];
  }

  async createEvent(
    userId: string,
    payload: GoogleCalendarEventPayload
  ): Promise<GoogleCalendarEventResponse> {
    const token = await this.getValidAccessToken(userId);

    if (this.customTransport) {
      return await this.customTransport.createEvent(token, payload);
    }

    // Include Google Meet conference request
    const eventWithConference = {
      ...payload,
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const url = "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventWithConference),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Google Calendar API create error (status ${res.status}): ${errBody}`);
    }

    return (await res.json()) as GoogleCalendarEventResponse;
  }

  async updateEvent(
    userId: string,
    googleEventId: string,
    payload: Partial<GoogleCalendarEventPayload>
  ): Promise<GoogleCalendarEventResponse> {
    const token = await this.getValidAccessToken(userId);

    if (this.customTransport) {
      return await this.customTransport.updateEvent(token, googleEventId, payload);
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
      googleEventId
    )}?conferenceDataVersion=1`;

    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Google Calendar API update error (status ${res.status}): ${errBody}`);
    }

    return (await res.json()) as GoogleCalendarEventResponse;
  }

  async cancelEvent(userId: string, googleEventId: string): Promise<void> {
    const token = await this.getValidAccessToken(userId);

    if (this.customTransport) {
      return await this.customTransport.deleteEvent(token, googleEventId);
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
      googleEventId
    )}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const errBody = await res.text();
      throw new Error(`Google Calendar API delete error (status ${res.status}): ${errBody}`);
    }
  }
}

export const googleCalendarClient = new GoogleCalendarClient();
