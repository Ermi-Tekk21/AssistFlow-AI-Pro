import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { tasksController } from "./tasks.controller";

export const tasksRouter = Router();

// Enforce authentication on all task routes
tasksRouter.use(authenticate);

tasksRouter.post("/", (req, res, next) => tasksController.create(req, res, next));
tasksRouter.get("/", (req, res, next) => tasksController.list(req, res, next));
tasksRouter.get("/:id", (req, res, next) => tasksController.getById(req, res, next));
tasksRouter.patch("/:id", (req, res, next) => tasksController.update(req, res, next));
tasksRouter.post("/:id/complete", (req, res, next) => tasksController.complete(req, res, next));
tasksRouter.delete("/:id", (req, res, next) => tasksController.delete(req, res, next));
