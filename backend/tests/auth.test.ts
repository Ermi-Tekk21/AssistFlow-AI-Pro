import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import http from "node:http";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { AppDataSource } from "../src/config/database";
import { authService, getDefaultEmail } from "../src/modules/auth/auth.service";
import { JWT_SECRET } from "../src/middleware/auth";

describe("Phase 11: Authentication & User Profile Tests", () => {
  let server: http.Server;
  let baseUrl: string;
  const defaultEmail = getDefaultEmail();

  before(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    await authService.seedDefaultUser();

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe("POST /api/auth/login", () => {
    it("should reject login for non-default email addresses with 403 Forbidden", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "unknown_person@example.com",
          password: "password123",
        }),
      });

      assert.strictEqual(res.status, 403);
      const body = (await res.json()) as any;
      assert.strictEqual(body.error.code, "FORBIDDEN");
      assert.ok(body.error.message.includes("restricted to the default account"));
    });

    it("should reject login with wrong password with 401 Unauthorized", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: defaultEmail,
          password: "wrongpassword999",
        }),
      });

      assert.strictEqual(res.status, 401);
      const body = (await res.json()) as any;
      assert.strictEqual(body.error.code, "UNAUTHORIZED");
    });

    it("should successfully log in default administrator and return a valid JWT", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: defaultEmail,
          password: "password123",
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = (await res.json()) as any;
      assert.ok(body.data.token);
      assert.strictEqual(body.data.user.email, defaultEmail);
      assert.strictEqual(body.data.user.firstName, "Ermias");
      assert.strictEqual(body.data.user.lastName, "Teklemarkos");

      // Verify JWT token signature and payload
      const decoded = jwt.verify(body.data.token, JWT_SECRET) as any;
      assert.strictEqual(decoded.userId, body.data.user.id);
      assert.strictEqual(decoded.email, defaultEmail);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should retrieve profile when authenticated via JWT Bearer token", async () => {
      // 1. Login
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: defaultEmail,
          password: "password123",
        }),
      });
      const loginBody = (await loginRes.json()) as any;
      const token = loginBody.data.token;

      // 2. Fetch /me
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      assert.strictEqual(meRes.status, 200);
      const meBody = (await meRes.json()) as any;
      assert.strictEqual(meBody.data.user.email, defaultEmail);
      assert.strictEqual(meBody.data.user.firstName, "Ermias");
      assert.strictEqual(meBody.data.user.lastName, "Teklemarkos");
    });

    it("should reject invalid JWT token with 401 Unauthorized", async () => {
      const invalidToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature";
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${invalidToken}`,
        },
      });

      assert.strictEqual(res.status, 401);
    });
  });

  describe("PUT /api/auth/profile", () => {
    it("should update profile attributes while keeping email strictly immutable", async () => {
      // 1. Login
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: defaultEmail,
          password: "password123",
        }),
      });
      const loginBody = (await loginRes.json()) as any;
      const token = loginBody.data.token;

      // 2. Update profile attempt including an illegal email change
      const updateRes = await fetch(`${baseUrl}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: "Ermias",
          lastName: "Teklemarkos Updated",
          dailyBriefingTime: "07:45:00",
          dailyBriefingEnabled: true,
          email: "malicious_overwrite@example.com",
        }),
      });

      assert.strictEqual(updateRes.status, 200);
      const updateBody = (await updateRes.json()) as any;
      assert.strictEqual(updateBody.data.user.lastName, "Teklemarkos Updated");
      assert.strictEqual(updateBody.data.user.dailyBriefingTime, "07:45:00");
      // Verify email remains unchanged
      assert.strictEqual(updateBody.data.user.email, defaultEmail);

      // Reset last name
      await fetch(`${baseUrl}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lastName: "Teklemarkos",
          dailyBriefingTime: "08:00:00",
        }),
      });
    });
  });
});
