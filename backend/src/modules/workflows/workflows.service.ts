import { AppDataSource } from "../../config/database";
import {
  WorkflowExecution,
  WorkflowExecutionStatus,
} from "../../entities/WorkflowExecution";
import { User } from "../../entities/User";
import { Task, TaskStatus } from "../../entities/Task";
import { Reminder } from "../../entities/Reminder";
import { remindersDeliveryService } from "../reminders/remindersDelivery.service";
import { briefingService } from "../briefing/briefing.service";

export interface BriefingUserSummary {
  userId: string;
  email: string;
  timezone: string;
  eligible: boolean;
  reason?: string;
  taskCount?: number;
  reminderCount?: number;
}

export class WorkflowsService {
  private get executionRepo() {
    return AppDataSource.getRepository(WorkflowExecution);
  }

  private get userRepo() {
    return AppDataSource.getRepository(User);
  }

  private get taskRepo() {
    return AppDataSource.getRepository(Task);
  }

  private get reminderRepo() {
    return AppDataSource.getRepository(Reminder);
  }

  async runReminderDelivery(
    triggeredBy = "n8n",
    limit = 50
  ): Promise<{ executionId: string; result: any }> {
    const execution = this.executionRepo.create({
      workflowName: "reminder_delivery",
      status: WorkflowExecutionStatus.RUNNING,
      triggeredBy,
      startedAt: new Date(),
      finishedAt: null,
      result: null,
      errorDetails: null,
    });
    await this.executionRepo.save(execution);

    try {
      const deliveryResult = await remindersDeliveryService.processDueReminders({ limit });

      execution.status = WorkflowExecutionStatus.COMPLETED;
      execution.finishedAt = new Date();
      execution.result = deliveryResult as any;
      await this.executionRepo.save(execution);

      return {
        executionId: execution.id,
        result: deliveryResult,
      };
    } catch (error: any) {
      execution.status = WorkflowExecutionStatus.FAILED;
      execution.finishedAt = new Date();
      execution.errorDetails = error?.message ?? "Reminder delivery execution failed";
      await this.executionRepo.save(execution);
      throw error;
    }
  }

  async runDailyBriefing(
    triggeredBy = "n8n",
    options?: { forceUserId?: string; referenceDate?: Date }
  ): Promise<{
    executionId: string;
    processedCount: number;
    summaries: BriefingUserSummary[];
  }> {
    const execution = this.executionRepo.create({
      workflowName: "daily_briefing",
      status: WorkflowExecutionStatus.RUNNING,
      triggeredBy,
      startedAt: new Date(),
      finishedAt: null,
      result: null,
      errorDetails: null,
    });
    await this.executionRepo.save(execution);

    try {
      let users: User[];
      if (options?.forceUserId) {
        const user = await this.userRepo.findOneBy({ id: options.forceUserId });
        users = user ? [user] : [];
      } else {
        // Query users with daily briefing enabled
        users = await this.userRepo.findBy({ dailyBriefingEnabled: true });
      }

      const summaries: BriefingUserSummary[] = [];
      const refDate = options?.referenceDate ?? new Date();

      for (const user of users) {
        const userTz = user.timezone || "Africa/Addis_Ababa";

        // Check if briefing is enabled and time matches (unless forced)
        if (!options?.forceUserId && !user.dailyBriefingEnabled) {
          summaries.push({
            userId: user.id,
            email: user.email,
            timezone: userTz,
            eligible: false,
            reason: "briefing_disabled",
          });
          continue;
        }

        // Get user's local day bounds with accurate timezone offset
        const { localDateStr, startUtc: startOfDay, endUtc: endOfDay } =
          briefingService.getLocalDayBounds(userTz, refDate);

        // Query due/incomplete tasks for user
        const tasks = await this.taskRepo
          .createQueryBuilder("task")
          .where("task.userId = :userId", { userId: user.id })
          .andWhere("task.status != :completed", { completed: TaskStatus.COMPLETED })
          .andWhere("(task.dueAt IS NULL OR task.dueAt <= :endOfDay)", { endOfDay })
          .orderBy("task.dueAt", "ASC")
          .getMany();

        // Query reminders scheduled for user's day
        const reminders = await this.reminderRepo
          .createQueryBuilder("reminder")
          .where("reminder.userId = :userId", { userId: user.id })
          .andWhere("reminder.scheduledAt BETWEEN :startOfDay AND :endOfDay", {
            startOfDay,
            endOfDay,
          })
          .orderBy("reminder.scheduledAt", "ASC")
          .getMany();

        summaries.push({
          userId: user.id,
          email: user.email,
          timezone: userTz,
          eligible: true,
          taskCount: tasks.length,
          reminderCount: reminders.length,
        });
      }

      const outcome = {
        processedCount: summaries.filter((s) => s.eligible).length,
        summaries,
      };

      execution.status = WorkflowExecutionStatus.COMPLETED;
      execution.finishedAt = new Date();
      execution.result = outcome;
      await this.executionRepo.save(execution);

      return {
        executionId: execution.id,
        ...outcome,
      };
    } catch (error: any) {
      execution.status = WorkflowExecutionStatus.FAILED;
      execution.finishedAt = new Date();
      execution.errorDetails = error?.message ?? "Daily briefing execution failed";
      await this.executionRepo.save(execution);
      throw error;
    }
  }

  async getExecutions(query?: {
    workflowName?: string;
    limit?: number;
  }): Promise<WorkflowExecution[]> {
    const qb = this.executionRepo.createQueryBuilder("execution");

    if (query?.workflowName) {
      qb.where("execution.workflowName = :name", { name: query.workflowName });
    }

    qb.orderBy("execution.startedAt", "DESC");
    qb.take(query?.limit ?? 50);

    return await qb.getMany();
  }
}

export const workflowsService = new WorkflowsService();
