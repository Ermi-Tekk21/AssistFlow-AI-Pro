import { z } from "zod";
import { CalendarEventStatus } from "../../entities/CalendarEvent";

export const CreateCalendarEventInputSchema = z
  .object({
    summary: z.string().min(1, "Event summary/title is required"),
    description: z.string().optional(),
    startAt: z.string().datetime({ message: "startAt must be a valid ISO 8601 string" }),
    endAt: z.string().datetime({ message: "endAt must be a valid ISO 8601 string" }),
    timezone: z.string().optional(),
    location: z.string().optional(),
    attendees: z.array(z.string().email()).optional(),
  })
  .refine(
    (data) => new Date(data.endAt).getTime() > new Date(data.startAt).getTime(),
    {
      message: "endAt must be strictly after startAt",
      path: ["endAt"],
    }
  );

export type CreateCalendarEventInput = z.infer<typeof CreateCalendarEventInputSchema>;

export const UpdateCalendarEventInputSchema = z
  .object({
    summary: z.string().min(1).optional(),
    description: z.string().optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    timezone: z.string().optional(),
    location: z.string().optional(),
    attendees: z.array(z.string().email()).optional(),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return new Date(data.endAt).getTime() > new Date(data.startAt).getTime();
      }
      return true;
    },
    {
      message: "endAt must be strictly after startAt",
      path: ["endAt"],
    }
  );

export type UpdateCalendarEventInput = z.infer<typeof UpdateCalendarEventInputSchema>;

export const ListCalendarEventsQuerySchema = z.object({
  startAfter: z.string().datetime().optional(),
  startBefore: z.string().datetime().optional(),
  status: z.nativeEnum(CalendarEventStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListCalendarEventsQuery = z.infer<typeof ListCalendarEventsQuerySchema>;
