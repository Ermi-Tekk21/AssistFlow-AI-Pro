import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { confirmationsController } from "./confirmations.controller";

export const confirmationsRouter = Router();

// Enforce authentication on all confirmation routes
confirmationsRouter.use(authenticate);

confirmationsRouter.post("/propose", (req, res, next) => confirmationsController.propose(req, res, next));
confirmationsRouter.get("/", (req, res, next) => confirmationsController.list(req, res, next));
confirmationsRouter.post("/reply", (req, res, next) => confirmationsController.reply(req, res, next));
confirmationsRouter.get("/:id", (req, res, next) => confirmationsController.getById(req, res, next));
confirmationsRouter.post("/:id/confirm", (req, res, next) => confirmationsController.confirm(req, res, next));
confirmationsRouter.post("/:id/reject", (req, res, next) => confirmationsController.reject(req, res, next));
