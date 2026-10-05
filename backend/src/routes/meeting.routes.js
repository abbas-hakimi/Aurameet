import express from "express";

import authenticate from "../middleware/auth.middleware.js";

import {
    create,
    getMeeting,
    join,
    getMyMeetings,
    start,
    end,
    leave,
    updateSettings,
    admit,
    getParticipants
} from "../controllers/meeting.controller.js";

const router = express.Router();

router.use(authenticate);

router.post("/", create);

router.get("/", getMyMeetings);

router.get("/:meetingCode", getMeeting);

router.post("/:meetingCode/join", join);

router.post("/:meetingCode/start", start);

router.post("/:meetingCode/end", end);

router.post("/:meetingCode/leave", leave);

router.patch(
    "/:meetingCode/settings",
    updateSettings
);

router.post(
    "/:meetingCode/admit",
    admit
);

router.get(
    "/:meetingCode/participants",
    getParticipants
);

export default router;