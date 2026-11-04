import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { calendarController } from "./calendar.controller";

const router = Router();

router.use(authenticate);

router.get("/auth/url", calendarController.getAuthUrl.bind(calendarController));
router.post("/auth/connect", calendarController.connectAccount.bind(calendarController));
router.get("/events", calendarController.listEvents.bind(calendarController));
router.get("/events/:id", calendarController.getEvent.bind(calendarController));
router.post("/events", calendarController.createEvent.bind(calendarController));
router.patch("/events/:id", calendarController.updateEvent.bind(calendarController));
router.post("/events/:id/cancel", calendarController.cancelEvent.bind(calendarController));
router.delete("/events/:id", calendarController.cancelEvent.bind(calendarController));

export const calendarRouter = router;
