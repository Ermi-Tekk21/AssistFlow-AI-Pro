import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Server } from "node:http";
import { app } from "../src/app";
import { AppDataSource } from "../src/config/database";

describe("Phase 0 Baseline Tests", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    // Start ephemeral Express HTTP server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  after(async () => {
    if (server) {
      if (typeof (server as any).closeAllConnections === "function") {
        (server as any).closeAllConnections();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("GET /health should return 200 with service status", async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);

    const body = (await response.json()) as { status: string; service: string };
    assert.equal(body.status, "ok");
    assert.equal(body.service, "AssistFlow AI");
  });

  it("AppDataSource should connect to PostgreSQL and execute query successfully", async () => {
    assert.equal(AppDataSource.isInitialized, true);
    const result = await AppDataSource.query("SELECT 1 as connected");
    assert.equal(Array.isArray(result), true);
    assert.equal(result[0].connected, 1);
  });
});
