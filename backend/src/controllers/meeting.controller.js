import mongoose from "mongoose";
import AppError from "../utils/AppError.js";
import { createMeeting, getMeetingByCode, joinMeeting, getUserMeetings, startMeeting, endMeeting, leaveMeeting, updateMeetingSettings, admitParticipant, getMeetingParticipants } from "../services/meeting.service.js";
import { admitWaitingSockets, closeMeetingRoom, removeSocketFromMeeting } from "../sockets/meeting.socket.js";

export const create = async (req, res) => {
    const meeting = await createMeeting({ ...req.body, hostId: req.user._id });
    res.status(201).json({ success: true, data: { meeting } });
};
export const getMeeting = async (req, res) => {
    const meeting = await getMeetingByCode(req.params.meetingCode, req.user._id);
    res.json({ success: true, data: { meeting } });
};
export const join = async (req, res) => {
    const result = await joinMeeting({ meetingCode: req.params.meetingCode, userId: req.user._id, name: req.user.name });
    const requestedAt = result.waiting
        ? result.meeting.waitingParticipants.find(w => w.user.toString() === req.user._id.toString())?.requestedAt
        : undefined;
    if (result.meeting.host.toString() !== req.user._id.toString()) result.meeting.waitingParticipants = undefined;
    if (result.waiting) {
        const hostId = result.meeting.host.toString();
        req.app.get("io").to(`user:${hostId}`).emit("waiting:participant", {
            user: { id: req.user._id.toString(), name: req.user.name, username: req.user.username },
            requestedAt
        });
    }
    res.json({ success: true, data: result });
};
export const getMyMeetings = async (req, res) => {
    const meetings = await getUserMeetings(req.user._id);
    res.json({ success: true, data: { meetings } });
};
export const start = async (req, res) => {
    const meeting = await startMeeting(req.params.meetingCode, req.user._id);
    req.app.get("io").to(meeting.meetingCode).emit("meeting:started", { meetingCode: meeting.meetingCode, startedAt: meeting.startedAt });
    res.json({ success: true, data: { meeting } });
};
export const end = async (req, res) => {
    const meeting = await endMeeting(req.params.meetingCode, req.user._id);
    await closeMeetingRoom(req.app.get("io"), meeting.meetingCode);
    res.json({ success: true, data: { meeting } });
};
export const leave = async (req, res) => {
    const participant = await leaveMeeting(req.params.meetingCode, req.user._id);
    const io = req.app.get("io");
    const sockets = await io.in(`user:${req.user._id}`).fetchSockets();
    for (const socket of sockets) if (socket.data.meetingCode === req.params.meetingCode.toUpperCase()) await removeSocketFromMeeting(io, socket, true);
    res.json({ success: true, data: { participant } });
};
export const updateSettings = async (req, res) => {
    const meeting = await updateMeetingSettings(req.params.meetingCode, req.user._id, req.body);
    req.app.get("io").to(meeting.meetingCode).emit("meeting:settings-updated", { settings: meeting.settings });
    res.json({ success: true, data: { settings: meeting.settings } });
};
export const admit = async (req, res) => {
    const userId = req.body.userId;
    if (!mongoose.isValidObjectId(userId)) throw new AppError("Invalid participant user id", 400);
    const participant = await admitParticipant(req.params.meetingCode, req.user._id, userId);
    await admitWaitingSockets(req.app.get("io"), req.params.meetingCode.toUpperCase(), userId.toString(), participant);
    res.json({ success: true, data: { participant } });
};
export const getParticipants = async (req, res) => {
    const participants = await getMeetingParticipants(req.params.meetingCode, req.user._id);
    res.json({ success: true, data: { participants } });
};
