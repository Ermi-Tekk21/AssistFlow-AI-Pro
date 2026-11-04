import { AppDataSource } from "../../config/database";
import {
  PendingAction,
  PendingActionStatus,
  PendingActionType,
} from "../../entities/PendingAction";
import { tasksService } from "../tasks/tasks.service";
import { remindersService } from "../reminders/reminders.service";
import { calendarService } from "../calendar/calendar.service";
import { BadRequestError, NotFoundError } from "../../middleware/errors";
import {
  ProposeActionInput,
  ConfirmationReplyInput,
  ListPendingActionsQuery,
} from "./confirmations.validation";

export class ConfirmationsService {
  private get actionRepo() {
    return AppDataSource.getRepository(PendingAction);
  }

  async proposeAction(userId: string, input: ProposeActionInput): Promise<PendingAction> {
    const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60 * 1000);

    const pendingAction = this.actionRepo.create({
      userId,
      actionType: input.actionType,
      proposal: input.proposal,
      payload: input.payload,
      targetEntityId: input.targetEntityId ?? null,
      targetEntityType: input.targetEntityType ?? null,
      expiresAt,
      status: PendingActionStatus.PENDING,
      confirmedAt: null,
      executedAt: null,
      executionResult: null,
    });

    return await this.actionRepo.save(pendingAction);
  }

  async listActions(
    userId: string,
    query: ListPendingActionsQuery
  ): Promise<PendingAction[]> {
    const qb = this.actionRepo.createQueryBuilder("action");
    qb.where("action.userId = :userId", { userId });

    if (query.status) {
      qb.andWhere("action.status = :status", { status: query.status });
    }

    if (query.activeOnly) {
      qb.andWhere("action.status = :pendingStatus", {
        pendingStatus: PendingActionStatus.PENDING,
      });
      qb.andWhere("action.expiresAt > :now", { now: new Date() });
    }

    qb.orderBy("action.createdAt", "DESC");
    return await qb.getMany();
  }

  async getActionById(userId: string, actionId: string): Promise<PendingAction> {
    const action = await this.actionRepo.findOne({
      where: { id: actionId, userId },
    });

    if (!action) {
      throw new NotFoundError("Pending action not found");
    }

    // Lazy expiration check
    if (action.status === PendingActionStatus.PENDING && new Date() >= action.expiresAt) {
      action.status = PendingActionStatus.EXPIRED;
      return await this.actionRepo.save(action);
    }

    return action;
  }

  async confirmAction(
    userId: string,
    actionId: string
  ): Promise<{ action: PendingAction; result: any }> {
    // 1. Atomically lock and transition from PENDING to CONFIRMED
    const action = await AppDataSource.transaction(async (txManager) => {
      const repo = txManager.getRepository(PendingAction);

      const target = await repo.findOne({
        where: { id: actionId, userId },
        lock: { mode: "pessimistic_write" },
      });

      if (!target) {
        throw new NotFoundError("Pending action not found");
      }

      if (target.status !== PendingActionStatus.PENDING) {
        throw new BadRequestError(
          `Pending action has already been ${target.status}`
        );
      }

      if (new Date() >= target.expiresAt) {
        target.status = PendingActionStatus.EXPIRED;
        await repo.save(target);
        throw new BadRequestError("Pending action has expired and cannot be confirmed");
      }

      // Mark as confirmed
      target.status = PendingActionStatus.CONFIRMED;
      target.confirmedAt = new Date();
      return await repo.save(target);
    });

    // 2. Execute stored payload outside the transaction so locks are not held
    try {
      const executionResult = await this.executeAction(
        action.actionType,
        userId,
        action.payload,
        action.targetEntityId
      );
      action.status = PendingActionStatus.EXECUTED;
      action.executedAt = new Date();
      action.executionResult = executionResult;
      await this.actionRepo.save(action);

      return { action, result: executionResult };
    } catch (error: any) {
      action.status = PendingActionStatus.FAILED;
      action.executionResult = { error: error.message ?? "Execution failed" };
      await this.actionRepo.save(action);
      throw error;
    }
  }

  async rejectAction(userId: string, actionId: string): Promise<PendingAction> {
    return await AppDataSource.transaction(async (txManager) => {
      const repo = txManager.getRepository(PendingAction);

      const action = await repo.findOne({
        where: { id: actionId, userId },
        lock: { mode: "pessimistic_write" },
      });

      if (!action) {
        throw new NotFoundError("Pending action not found");
      }

      if (action.status !== PendingActionStatus.PENDING) {
        throw new BadRequestError(
          `Pending action has already been ${action.status}`
        );
      }

      if (new Date() >= action.expiresAt) {
        action.status = PendingActionStatus.EXPIRED;
        await repo.save(action);
        throw new BadRequestError("Pending action has expired and cannot be rejected");
      }

      action.status = PendingActionStatus.REJECTED;
      return await repo.save(action);
    });
  }

  async resolveReply(
    userId: string,
    input: ConfirmationReplyInput
  ): Promise<{ action: PendingAction; result?: any; decision: "confirmed" | "rejected" }> {
    const rawReply = input.reply.toLowerCase().trim();

    const isPositive = ["y", "yes", "confirm", "proceed", "true", "ok"].includes(rawReply);
    const isNegative = ["n", "no", "reject", "cancel", "false"].includes(rawReply);

    if (!isPositive && !isNegative) {
      throw new BadRequestError(
        "Unrecognized reply. Please respond with 'yes' / 'y' to confirm, or 'no' / 'n' to reject."
      );
    }

    let targetActionId = input.actionId;

    if (!targetActionId) {
      // Find active pending actions for user
      const activeActions = await this.actionRepo.find({
        where: {
          userId,
          status: PendingActionStatus.PENDING,
        },
        order: { createdAt: "DESC" },
      });

      const unexpiredActive = activeActions.filter((a) => new Date() < a.expiresAt);

      if (unexpiredActive.length === 0) {
        throw new BadRequestError(
          "No active pending action found to confirm or reject"
        );
      }

      if (unexpiredActive.length > 1) {
        throw new BadRequestError(
          "Ambiguous confirmation: multiple pending actions are awaiting confirmation. Please specify the action ID."
        );
      }

      targetActionId = unexpiredActive[0].id;
    }

    if (isPositive) {
      const { action, result } = await this.confirmAction(userId, targetActionId);
      return { action, result, decision: "confirmed" };
    } else {
      const action = await this.rejectAction(userId, targetActionId);
      return { action, decision: "rejected" };
    }
  }

  private async executeAction(
    actionType: PendingActionType,
    userId: string,
    payload: Record<string, any>,
    targetEntityId?: string | null
  ): Promise<any> {
    // Helper to reliably resolve target entity ID from payload or targetEntityId
    const resolveId = (...candidates: Array<any>): string => {
      for (const c of candidates) {
        if (c && typeof c === "string" && c.trim().length > 0) {
          return c.trim();
        }
      }
      throw new BadRequestError(`Cannot execute ${actionType}: missing target entity ID`);
    };

    // Helper to extract clean update input (stripping identifier fields)
    const extractUpdateInput = (raw: Record<string, any>): Record<string, any> => {
      const input = raw.input && typeof raw.input === "object" ? { ...raw.input } : { ...raw };
      delete input.id;
      delete input.taskId;
      delete input.reminderId;
      delete input.calendarEventId;
      delete input.eventId;
      delete input.targetEntityId;
      return input;
    };

    switch (actionType) {
      case PendingActionType.TASK_CREATE:
        return await tasksService.createTask(userId, payload as any);

      case PendingActionType.TASK_UPDATE: {
        const taskId = resolveId(payload.id, payload.taskId, targetEntityId);
        const updateInput = extractUpdateInput(payload);
        return await tasksService.updateTask(userId, taskId, updateInput);
      }

      case PendingActionType.TASK_COMPLETE: {
        const taskId = resolveId(payload.id, payload.taskId, targetEntityId);
        return await tasksService.completeTask(userId, taskId);
      }

      case PendingActionType.TASK_DELETE: {
        const taskId = resolveId(payload.id, payload.taskId, targetEntityId);
        return await tasksService.deleteTask(userId, taskId);
      }

      case PendingActionType.REMINDER_CREATE:
        return await remindersService.createReminder(userId, payload as any);

      case PendingActionType.REMINDER_UPDATE: {
        const reminderId = resolveId(payload.id, payload.reminderId, targetEntityId);
        const updateInput = extractUpdateInput(payload);
        return await remindersService.updateReminder(userId, reminderId, updateInput);
      }

      case PendingActionType.REMINDER_SNOOZE: {
        const reminderId = resolveId(payload.id, payload.reminderId, targetEntityId);
        const snoozeMinutes =
          payload.input?.snoozeMinutes ??
          payload.snoozeMinutes ??
          payload.input?.minutes ??
          payload.minutes ??
          15;
        const scheduledAt = payload.input?.scheduledAt ?? payload.scheduledAt;
        return await remindersService.snoozeReminder(userId, reminderId, {
          snoozeMinutes,
          scheduledAt,
        });
      }

      case PendingActionType.REMINDER_CANCEL: {
        const reminderId = resolveId(payload.id, payload.reminderId, targetEntityId);
        return await remindersService.cancelReminder(userId, reminderId);
      }

      case PendingActionType.CALENDAR_EVENT_CREATE:
        return await calendarService.createEvent(userId, payload as any);

      case PendingActionType.CALENDAR_EVENT_UPDATE: {
        const eventId = resolveId(payload.id, payload.calendarEventId, payload.eventId, targetEntityId);
        const updateInput = extractUpdateInput(payload);
        return await calendarService.updateEvent(userId, eventId, updateInput);
      }

      case PendingActionType.CALENDAR_EVENT_CANCEL: {
        const eventId = resolveId(payload.id, payload.calendarEventId, payload.eventId, targetEntityId);
        return await calendarService.cancelEvent(userId, eventId);
      }

      default:
        throw new BadRequestError(`Unsupported action type execution: ${actionType}`);
    }
  }
}

export const confirmationsService = new ConfirmationsService();
