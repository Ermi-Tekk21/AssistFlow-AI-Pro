import { Request, Response, NextFunction } from "express";
import { getAuthenticatedUserId } from "../../middleware/auth";
import { remindersService } from "./reminders.service";
import {
  createReminderSchema,
  updateReminderSchema,
  snoozeReminderSchema,
  listRemindersQuerySchema,
  reminderIdParamSchema,
} from "./reminders.validation";

export class RemindersController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const validatedBody = createReminderSchema.parse(req.body);
      const reminder = await remindersService.createReminder(
        userId,
        validatedBody,
      );

      res.status(201).json({
        data: reminder,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const validatedQuery = listRemindersQuerySchema.parse(req.query);
      const result = await remindersService.listReminders(
        userId,
        validatedQuery,
      );

      res.status(200).json({
        data: result.reminders,
        meta: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id } = reminderIdParamSchema.parse(req.params);
      const reminder = await remindersService.getReminderById(userId, id);

      res.status(200).json({
        data: reminder,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id } = reminderIdParamSchema.parse(req.params);
      const validatedBody = updateReminderSchema.parse(req.body);
      const updatedReminder = await remindersService.updateReminder(
        userId,
        id,
        validatedBody,
      );

      res.status(200).json({
        data: updatedReminder,
      });
    } catch (error) {
      next(error);
    }
  }

  async snooze(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id } = reminderIdParamSchema.parse(req.params);
      const validatedBody = snoozeReminderSchema.parse(req.body);
      const snoozedReminder = await remindersService.snoozeReminder(
        userId,
        id,
        validatedBody,
      );

      res.status(200).json({
        data: snoozedReminder,
      });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id } = reminderIdParamSchema.parse(req.params);
      const cancelledReminder = await remindersService.cancelReminder(
        userId,
        id,
      );

      res.status(200).json({
        data: cancelledReminder,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const remindersController = new RemindersController();
