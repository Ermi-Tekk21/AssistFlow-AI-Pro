import { Router } from "express";
import { authController } from "./auth.controller";
import { authenticate } from "../../middleware/auth";

export const authRouter = Router();

authRouter.post("/login", (req, res, next) => authController.login(req, res, next));
authRouter.get("/me", authenticate, (req, res, next) => authController.getMe(req, res, next));
authRouter.put("/profile", authenticate, (req, res, next) => authController.updateProfile(req, res, next));
authRouter.patch("/profile", authenticate, (req, res, next) => authController.updateProfile(req, res, next));
