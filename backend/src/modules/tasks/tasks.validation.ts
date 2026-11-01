import { z } from "zod";
import { TaskPriority, TaskStatus } from "../../entities/Task";

// Helper for validating ISO datetime strings
const isoDateString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: "Invalid ISO 8601 date-time string" }
);

export const taskIdParamSchema = z.object({
  id: z.string().uuid("Invalid task ID: must be a valid UUID"),
});

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(255, "Title cannot exceed 255 characters"),
  description: z.string().trim().nullable().optional(),
  priority: z.nativeEnum(TaskPriority).optional().default(TaskPriority.MEDIUM),
  dueAt: isoDateString.nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(255, "Title cannot exceed 255 characters")
    .optional(),
  description: z.string().trim().nullable().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  dueAt: isoDateString.nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

export const listTasksQuerySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  search: z.string().trim().optional(),
  dueBefore: isoDateString.optional(),
  dueAfter: isoDateString.optional(),
  sortBy: z.enum(["createdAt", "dueAt", "priority", "title"]).optional().default("createdAt"),
  sortOrder: z.enum(["ASC", "DESC", "asc", "desc"]).optional().default("DESC"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
