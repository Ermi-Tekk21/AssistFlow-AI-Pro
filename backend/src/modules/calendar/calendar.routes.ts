import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { calendarController } from "./calendar.controller";

const router = Router();

// Public OAuth callback & auth URL endpoints
router.get("/auth/callback", calendarController.handleOAuthCallback.bind(calendarController));
router.get("/auth/url", calendarController.getAuthUrl.bind(calendarController));

// Protected calendar routes
router.use(authenticate);

router.get("/auth/status", calendarController.getIntegrationStatus.bind(calendarController));
router.post("/auth/connect", calendarController.connectAccount.bind(calendarController));
router.get("/events", calendarController.listEvents.bind(calendarController));
router.get("/events/:id", calendarController.getEvent.bind(calendarController));
router.post("/events", calendarController.createEvent.bind(calendarController));
router.patch("/events/:id", calendarController.updateEvent.bind(calendarController));
router.post("/events/:id/cancel", calendarController.cancelEvent.bind(calendarController));
router.delete("/events/:id/permanent", calendarController.deleteEventPermanently.bind(calendarController));
router.delete("/events/:id", (req, res, next) => {
  if (req.query.permanent === "true") {
    return calendarController.deleteEventPermanently(req, res, next);
  }
  return calendarController.cancelEvent(req, res, next);
});

export const calendarRouter = router;
