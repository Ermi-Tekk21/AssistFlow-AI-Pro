import express from "express";
import { tasksRouter } from "./modules/tasks/tasks.routes";
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

// 404 Catch-all handler for unknown endpoints
app.use((_req, _res, next) => {
  next(new NotFoundError("Endpoint not found"));
});

// Centralized error handler
app.use(errorHandler);
