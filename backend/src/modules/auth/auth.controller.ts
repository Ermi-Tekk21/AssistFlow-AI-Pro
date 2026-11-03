import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import { getAuthenticatedUserId } from "../../middleware/auth";

export class AuthController {
  public async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const user = await authService.getMe(userId);

      res.status(200).json({
        status: "success",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  public async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { firstName, lastName, dailyBriefingTime, dailyBriefingEnabled, timezone } = req.body;

      const updated = await authService.updateProfile(userId, {
        firstName,
        lastName,
        dailyBriefingTime,
        dailyBriefingEnabled,
        timezone,
      });

      res.status(200).json({
        status: "success",
        data: { user: updated },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
