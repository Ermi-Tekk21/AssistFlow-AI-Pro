import express from "express";
import { tasksRouter } from "./modules/tasks/tasks.routes";
import { remindersRouter } from "./modules/reminders/reminders.routes";
import { confirmationsRouter } from "./modules/confirmations/confirmations.routes";
import { workflowsRouter } from "./modules/workflows/workflows.routes";
import { assistantRouter } from "./modules/ai/assistant.routes";
import { calendarRouter } from "./modules/calendar/calendar.routes";
import { briefingRouter } from "./modules/briefing/briefing.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { errorHandler } from "./middleware/errorHandler";
import { NotFoundError } from "./middleware/errors";

export const app = express();

app.use(express.json());

// CORS headers middleware for secure cross-origin dashboard interaction
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,x-user-id,x-workflow-secret");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get(["/health", "/api/healthcheck"], (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "AssistFlow AI",
  });
});

// Feature modules
app.use("/api/tasks", tasksRouter);
app.use("/api/reminders", remindersRouter);
app.use("/api/confirmations", confirmationsRouter);
app.use("/api/workflows", workflowsRouter);
app.use("/api/assistant", assistantRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/briefing", briefingRouter);
app.use("/api/auth", authRouter);

// 404 Catch-all handler for unknown endpoints
app.use((_req, _res, next) => {
  next(new NotFoundError("Endpoint not found"));
});

// Centralized error handler
app.use(errorHandler);
