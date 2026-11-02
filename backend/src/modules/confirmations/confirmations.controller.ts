import { Request, Response, NextFunction } from "express";
import { getAuthenticatedUserId } from "../../middleware/auth";
import { confirmationsService } from "./confirmations.service";
import {
  proposeActionSchema,
  confirmationReplySchema,
  listPendingActionsQuerySchema,
  actionIdParamSchema,
} from "./confirmations.validation";

export class ConfirmationsController {
  async propose(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const validatedBody = proposeActionSchema.parse(req.body);
      const action = await confirmationsService.proposeAction(userId, validatedBody);

      res.status(201).json({
        data: action,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const validatedQuery = listPendingActionsQuerySchema.parse(req.query);
      const actions = await confirmationsService.listActions(userId, validatedQuery);

      res.status(200).json({
        data: actions,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id } = actionIdParamSchema.parse(req.params);
      const action = await confirmationsService.getActionById(userId, id);

      res.status(200).json({
        data: action,
      });
    } catch (error) {
      next(error);
    }
  }

  async confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id } = actionIdParamSchema.parse(req.params);
      const outcome = await confirmationsService.confirmAction(userId, id);

      res.status(200).json({
        data: outcome,
      });
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id } = actionIdParamSchema.parse(req.params);
      const action = await confirmationsService.rejectAction(userId, id);

      res.status(200).json({
        data: action,
      });
    } catch (error) {
      next(error);
    }
  }

  async reply(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const validatedBody = confirmationReplySchema.parse(req.body);
      const outcome = await confirmationsService.resolveReply(userId, validatedBody);

      res.status(200).json({
        data: outcome,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const confirmationsController = new ConfirmationsController();
