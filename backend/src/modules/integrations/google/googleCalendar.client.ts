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

    // Check if token is expired (or expires within 60s) and needs refresh
    const isExpired = !account.expiresAt || account.expiresAt.getTime() <= Date.now() + 60000;
    if (isExpired && account.refreshToken) {
      try {
        const refreshed = await this.refreshAccessToken(account.refreshToken);
        account.accessToken = refreshed.accessToken;
        account.expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
        await accountRepo.save(account);
        return account.accessToken;
      } catch (refreshErr: any) {
        console.warn("[GoogleCalendar] Proactive token refresh failed:", refreshErr?.message || refreshErr);
        // If we still have an access token, try using it; otherwise fall back
        if (account.accessToken && account.accessToken !== "simulated-oauth-token") {
          return account.accessToken;
        }
        return "simulated-oauth-token";
      }
    }

    return account.accessToken;
  }

  public async forceRefreshToken(userId: string): Promise<string> {
    const accountRepo = AppDataSource.getRepository(IntegrationAccount);
    const account = await accountRepo.findOne({
      where: { userId, provider: "google" },
    });

    if (!account || !account.refreshToken) {
      throw new Error("No Google refresh token available to refresh access token");
    }

    const refreshed = await this.refreshAccessToken(account.refreshToken);
    account.accessToken = refreshed.accessToken;
    account.expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
    await accountRepo.save(account);
    console.log(`[GoogleCalendar] Successfully refreshed Google access token for user ${userId}.`);
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
    let lastError: any = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`Failed to refresh Google OAuth token (status ${res.status}): ${errText}`);
        }

        const data = (await res.json()) as any;
        return {
          accessToken: data.access_token,
          expiresIn: data.expires_in || 3600,
        };
      } catch (err: any) {
        lastError = err;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }

    throw lastError || new Error("Failed to refresh Google OAuth token after retries");
  }

  async listEvents(
    userId: string,
    options: { timeMin?: string; timeMax?: string; maxResults?: number } = {}
  ): Promise<GoogleCalendarEventResponse[]> {
    let token = await this.getValidAccessToken(userId);

    if (this.customTransport) {
      return await this.customTransport.listEvents(token, options);
    }

    if (token === "simulated-oauth-token") {
      return [];
    }

    const query = new URLSearchParams();
    if (options.timeMin) query.set("timeMin", options.timeMin);
    if (options.timeMax) query.set("timeMax", options.timeMax);
    if (options.maxResults) query.set("maxResults", String(options.maxResults));
    query.set("singleEvents", "true");
    query.set("orderBy", "startTime");

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query.toString()}`;
    const makeRequest = async (authToken: string) => {
      return await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
        signal: AbortSignal.timeout(10000),
      });
    };

    let res: Response;
    try {
      res = await makeRequest(token);
    } catch {
      return [];
    }

    if (res.status === 401) {
      try {
        token = await this.forceRefreshToken(userId);
        res = await makeRequest(token);
      } catch {
        return [];
      }
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return [];
      }
      throw new Error(`Google Calendar API list error (status ${res.status})`);
    }

    const data = (await res.json()) as any;
    return data.items || [];
  }

  async createEvent(
    userId: string,
    payload: GoogleCalendarEventPayload
  ): Promise<GoogleCalendarEventResponse> {
    let token = await this.getValidAccessToken(userId);

    if (this.customTransport) {
      return await this.customTransport.createEvent(token, payload);
    }

    if (token === "simulated-oauth-token") {
      const meetCode = `${Math.random().toString(36).substring(2, 5)}-${Math.random()
        .toString(36)
        .substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
      return {
        id: `sim-google-${Date.now()}`,
        summary: payload.summary,
        description: payload.description,
        start: payload.start,
        end: payload.end,
        location: payload.location,
        hangoutLink: `https://meet.google.com/${meetCode}`,
        attendees: payload.attendees?.map((a) => ({ ...a, responseStatus: "accepted" })),
        status: "confirmed",
      };
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

    // Notice sendUpdates=all instructs Google Calendar to send invitations & updates to all attendees
    const url =
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all";

    const makeRequest = async (authToken: string) => {
      return await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventWithConference),
        signal: AbortSignal.timeout(12000),
      });
    };

    let res: Response;
    try {
      res = await makeRequest(token);
    } catch (networkErr: any) {
      await new Promise((r) => setTimeout(r, 600));
      res = await makeRequest(token);
    }

    // If 401 Unauthorized, automatically refresh access token and retry the Google API call
    if (res.status === 401) {
      console.warn("[GoogleCalendar] Received 401 Unauthorized. Force refreshing token and retrying event creation...");
      try {
        token = await this.forceRefreshToken(userId);
        res = await makeRequest(token);
      } catch (refreshErr: any) {
        console.error("[GoogleCalendar] Failed to force-refresh token after 401:", refreshErr.message);
      }
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Google Calendar API create error (status ${res.status}): ${errBody}`);
    }

    return (await res.json()) as GoogleCalendarEventResponse;
  }

  async updateEvent(
    userId: string,
    googleEventId: string,
    payload: Partial<GoogleCalendarEventPayload>
  ): Promise<GoogleCalendarEventResponse> {
    let token = await this.getValidAccessToken(userId);

    if (this.customTransport) {
      return await this.customTransport.updateEvent(token, googleEventId, payload);
    }

    if (token === "simulated-oauth-token") {
      return {
        id: googleEventId,
        summary: payload.summary || "",
        description: payload.description,
        start: payload.start || {},
        end: payload.end || {},
        status: "confirmed",
      };
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
      googleEventId
    )}?conferenceDataVersion=1&sendUpdates=all`;

    const makeRequest = async (authToken: string) => {
      return await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });
    };

    let res: Response;
    try {
      res = await makeRequest(token);
    } catch (networkErr: any) {
      await new Promise((r) => setTimeout(r, 600));
      res = await makeRequest(token);
    }

    if (res.status === 401) {
      console.warn("[GoogleCalendar] Received 401 Unauthorized. Force refreshing token and retrying event update...");
      try {
        token = await this.forceRefreshToken(userId);
        res = await makeRequest(token);
      } catch (refreshErr: any) {
        console.error("[GoogleCalendar] Failed to force-refresh token after 401:", refreshErr.message);
      }
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Google Calendar API update error (status ${res.status}): ${errBody}`);
    }

    return (await res.json()) as GoogleCalendarEventResponse;
  }

  async cancelEvent(userId: string, googleEventId: string): Promise<void> {
    let token = await this.getValidAccessToken(userId);

    if (this.customTransport) {
      return await this.customTransport.deleteEvent(token, googleEventId);
    }

    if (token === "simulated-oauth-token") {
      return;
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
      googleEventId
    )}?sendUpdates=all`;

    const makeRequest = async (authToken: string) => {
      return await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
        signal: AbortSignal.timeout(12000),
      });
    };

    let res: Response;
    try {
      res = await makeRequest(token);
    } catch (networkErr: any) {
      await new Promise((r) => setTimeout(r, 600));
      res = await makeRequest(token);
    }

    if (res.status === 401) {
      console.warn("[GoogleCalendar] Received 401 Unauthorized. Force refreshing token and retrying event delete...");
      try {
        token = await this.forceRefreshToken(userId);
        res = await makeRequest(token);
      } catch (refreshErr: any) {
        console.error("[GoogleCalendar] Failed to force-refresh token after 401:", refreshErr.message);
      }
    }

    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Google Calendar API delete error (status ${res.status}): ${errBody}`);
    }
  }
}

export const googleCalendarClient = new GoogleCalendarClient();
