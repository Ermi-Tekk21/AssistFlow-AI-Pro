import { z } from "zod";
import { PendingActionType, PendingActionStatus } from "../../entities/PendingAction";

export const actionIdParamSchema = z.object({
  id: z.string().uuid("Invalid action ID: must be a valid UUID"),
});

export const proposeActionSchema = z.object({
  actionType: z.nativeEnum(PendingActionType),
  proposal: z
    .string()
    .trim()
    .min(1, "Proposal description cannot be empty")
    .max(1000, "Proposal description cannot exceed 1000 characters"),
  payload: z.record(z.string(), z.any()),
  targetEntityId: z.string().uuid("targetEntityId must be a valid UUID").optional().nullable(),
  targetEntityType: z.enum(["task", "reminder", "calendar_event"]).optional().nullable(),
  expiresInMinutes: z.coerce.number().int().min(1).max(60).optional().default(10),
});

export const confirmationReplySchema = z.object({
  reply: z.string().trim().min(1, "Reply cannot be empty"),
  actionId: z.string().uuid("actionId must be a valid UUID").optional(),
});

export const listPendingActionsQuerySchema = z.object({
  status: z.nativeEnum(PendingActionStatus).optional(),
  activeOnly: z.coerce.boolean().optional().default(false),
});

export type ProposeActionInput = z.infer<typeof proposeActionSchema>;
export type ConfirmationReplyInput = z.infer<typeof confirmationReplySchema>;
export type ListPendingActionsQuery = z.infer<typeof listPendingActionsQuerySchema>;
