import express from "express";
import { tasksRouter } from "./modules/tasks/tasks.routes";
import { remindersRouter } from "./modules/reminders/reminders.routes";
import { confirmationsRouter } from "./modules/confirmations/confirmations.routes";
import { workflowsRouter } from "./modules/workflows/workflows.routes";
import { assistantRouter } from "./modules/ai/assistant.routes";
import { calendarRouter } from "./modules/calendar/calendar.routes";
import { errorHandler } from "./middleware/errorHandler";
import { NotFoundError } from "./middleware/errors";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
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

// 404 Catch-all handler for unknown endpoints
app.use((_req, _res, next) => {
  next(new NotFoundError("Endpoint not found"));
});

// Centralized error handler
app.use(errorHandler);
