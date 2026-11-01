import { AppDataSource } from "../../config/database";
import { Task, TaskPriority, TaskStatus } from "../../entities/Task";
import { NotFoundError } from "../../middleware/errors";
import { CreateTaskInput, UpdateTaskInput, ListTasksQuery } from "./tasks.validation";

export class TasksService {
  private get taskRepo() {
    return AppDataSource.getRepository(Task);
  }

  async createTask(userId: string, input: CreateTaskInput): Promise<Task> {
    const task = this.taskRepo.create({
      userId,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? TaskPriority.MEDIUM,
      status: TaskStatus.PENDING,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      completedAt: null,
    });

    return await this.taskRepo.save(task);
  }

  async listTasks(
    userId: string,
    query: ListTasksQuery
  ): Promise<{ tasks: Task[]; total: number; limit: number; offset: number }> {
    const qb = this.taskRepo.createQueryBuilder("task");

    qb.where("task.userId = :userId", { userId });

    if (query.status) {
      qb.andWhere("task.status = :status", { status: query.status });
    }

    if (query.priority) {
      qb.andWhere("task.priority = :priority", { priority: query.priority });
    }

    if (query.search) {
      qb.andWhere(
        "(task.title ILIKE :search OR task.description ILIKE :search)",
        { search: `%${query.search}%` }
      );
    }

    if (query.dueBefore) {
      qb.andWhere("task.dueAt <= :dueBefore", { dueBefore: new Date(query.dueBefore) });
    }

    if (query.dueAfter) {
      qb.andWhere("task.dueAt >= :dueAfter", { dueAfter: new Date(query.dueAfter) });
    }

    const sortField = query.sortBy ? `task.${query.sortBy}` : "task.createdAt";
    const sortOrder = query.sortOrder ? (query.sortOrder.toUpperCase() as "ASC" | "DESC") : "DESC";

    qb.orderBy(sortField, sortOrder);
    qb.addOrderBy("task.id", "ASC"); // Deterministic secondary sort

    qb.skip(query.offset);
    qb.take(query.limit);

    const [tasks, total] = await qb.getManyAndCount();

    return {
      tasks,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getTaskById(userId: string, taskId: string): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new NotFoundError("Task not found");
    }

    return task;
  }

  async updateTask(userId: string, taskId: string, input: UpdateTaskInput): Promise<Task> {
    const task = await this.getTaskById(userId, taskId);

    if (input.title !== undefined) {
      task.title = input.title;
    }

    if (input.description !== undefined) {
      task.description = input.description;
    }

    if (input.priority !== undefined) {
      task.priority = input.priority;
    }

    if (input.status !== undefined) {
      if (input.status === TaskStatus.COMPLETED && task.status !== TaskStatus.COMPLETED) {
        task.completedAt = new Date();
      } else if (input.status !== TaskStatus.COMPLETED && task.status === TaskStatus.COMPLETED) {
        task.completedAt = null;
      }
      task.status = input.status;
    }

    if (input.dueAt !== undefined) {
      task.dueAt = input.dueAt ? new Date(input.dueAt) : null;
    }

    return await this.taskRepo.save(task);
  }

  async completeTask(userId: string, taskId: string): Promise<Task> {
    const task = await this.getTaskById(userId, taskId);

    task.status = TaskStatus.COMPLETED;
    task.completedAt = new Date();

    return await this.taskRepo.save(task);
  }

  async deleteTask(userId: string, taskId: string): Promise<{ success: boolean; id: string }> {
    const task = await this.getTaskById(userId, taskId);
    await this.taskRepo.remove(task);

    return { success: true, id: taskId };
  }
}

export const tasksService = new TasksService();
