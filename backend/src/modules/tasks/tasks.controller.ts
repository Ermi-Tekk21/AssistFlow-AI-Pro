import { Request, Response, NextFunction } from "express";
import { getAuthenticatedUserId } from "../../middleware/auth";
import { tasksService } from "./tasks.service";
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
  taskIdParamSchema,
} from "./tasks.validation";

export class TasksController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const validatedBody = createTaskSchema.parse(req.body);
      const task = await tasksService.createTask(userId, validatedBody);

      res.status(201).json({
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const validatedQuery = listTasksQuerySchema.parse(req.query);
      const result = await tasksService.listTasks(userId, validatedQuery);

      res.status(200).json({
        data: result.tasks,
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

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id } = taskIdParamSchema.parse(req.params);
      const task = await tasksService.getTaskById(userId, id);

      res.status(200).json({
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id } = taskIdParamSchema.parse(req.params);
      const validatedBody = updateTaskSchema.parse(req.body);
      const updatedTask = await tasksService.updateTask(userId, id, validatedBody);

      res.status(200).json({
        data: updatedTask,
      });
    } catch (error) {
      next(error);
    }
  }

  async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id } = taskIdParamSchema.parse(req.params);
      const completedTask = await tasksService.completeTask(userId, id);

      res.status(200).json({
        data: completedTask,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id } = taskIdParamSchema.parse(req.params);
      const result = await tasksService.deleteTask(userId, id);

      res.status(200).json({
        message: "Task deleted successfully",
        id: result.id,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const tasksController = new TasksController();
