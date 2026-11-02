import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { remindersController } from "./reminders.controller";

export const remindersRouter = Router();

// Enforce authentication on all reminder routes
remindersRouter.use(authenticate);

remindersRouter.post("/", (req, res, next) => remindersController.create(req, res, next));
remindersRouter.get("/", (req, res, next) => remindersController.list(req, res, next));
remindersRouter.get("/:id", (req, res, next) => remindersController.getById(req, res, next));
remindersRouter.patch("/:id", (req, res, next) => remindersController.update(req, res, next));
remindersRouter.post("/:id/snooze", (req, res, next) => remindersController.snooze(req, res, next));
remindersRouter.post("/:id/cancel", (req, res, next) => remindersController.cancel(req, res, next));
