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
        action.payload
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
    payload: Record<string, any>
  ): Promise<any> {
    switch (actionType) {
      case PendingActionType.TASK_CREATE:
        return await tasksService.createTask(userId, payload as any);

      case PendingActionType.TASK_UPDATE:
        return await tasksService.updateTask(userId, payload.id, payload.input);

      case PendingActionType.TASK_COMPLETE:
        return await tasksService.completeTask(userId, payload.id);

      case PendingActionType.TASK_DELETE:
        return await tasksService.deleteTask(userId, payload.id);

      case PendingActionType.REMINDER_CREATE:
        return await remindersService.createReminder(userId, payload as any);

      case PendingActionType.REMINDER_UPDATE:
        return await remindersService.updateReminder(userId, payload.id, payload.input);

      case PendingActionType.REMINDER_SNOOZE:
        return await remindersService.snoozeReminder(userId, payload.id, payload.input);

      case PendingActionType.REMINDER_CANCEL:
        return await remindersService.cancelReminder(userId, payload.id);

      case PendingActionType.CALENDAR_EVENT_CREATE:
        return await calendarService.createEvent(userId, payload as any);

      case PendingActionType.CALENDAR_EVENT_UPDATE:
        return await calendarService.updateEvent(userId, payload.id, payload.input);

      case PendingActionType.CALENDAR_EVENT_CANCEL:
        return await calendarService.cancelEvent(userId, payload.id);

      default:
        throw new BadRequestError(`Unsupported action type execution: ${actionType}`);
    }
  }
}

export const confirmationsService = new ConfirmationsService();
