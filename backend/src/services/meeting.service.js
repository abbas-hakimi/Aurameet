import crypto from "crypto";
import mongoose from "mongoose";
import Meeting from "../models/Meeting.js";
import Participant from "../models/Participant.js";
import AppError from "../utils/AppError.js";

const settingKeys = ["waitingRoom", "lockMeeting", "allowChat", "allowScreenShare"];
const idValue = (value) => String(value?._id ?? value?.id ?? value);
const codeFilter = (code) => {
    if (typeof code !== "string" || !/^[a-z0-9]{8}$/i.test(code)) throw new AppError("Invalid meeting code", 400);
    return code.toUpperCase();
};
const findMeeting = async (code) => {
    const meeting = await Meeting.findOne({ meetingCode: codeFilter(code) });
    if (!meeting) throw new AppError("Meeting not found", 404);
    return meeting;
};
const requireHost = (meeting, userId, action) => {
    if (idValue(meeting.host) !== idValue(userId)) throw new AppError(`Only the host can ${action}`, 403);
};

export const createMeeting = async ({ title, hostId, scheduledAt, settings = {} }) => {
    if (typeof title !== "string" || !title.trim() || title.trim().length > 120) throw new AppError("Meeting title must be 1 to 120 characters", 400);
    if (scheduledAt !== undefined && (typeof scheduledAt !== "string" || !Number.isFinite(Date.parse(scheduledAt)))) throw new AppError("Invalid scheduled date", 400);
    validateSettings(settings);
    let meetingCode;
    do { meetingCode = crypto.randomBytes(4).toString("hex").toUpperCase(); }
    while (await Meeting.exists({ meetingCode }));
    return Meeting.create({ meetingCode, title: title.trim(), host: hostId, scheduledAt, settings });
};

const validateSettings = (settings) => {
    if (!settings || typeof settings !== "object" || Array.isArray(settings) || Object.keys(settings).some(k => !settingKeys.includes(k)) || Object.values(settings).some(v => typeof v !== "boolean")) throw new AppError("Invalid meeting settings", 400);
};

export const getMeetingByCode = async (meetingCode, userId) => {
    const meeting = await Meeting.findOne({ meetingCode: codeFilter(meetingCode) }).populate("host", "name username avatar");
    if (!meeting) throw new AppError("Meeting not found", 404);
    if (meeting.host._id.toString() !== userId.toString()) meeting.waitingParticipants = undefined;
    return meeting;
};

export const joinMeeting = async ({ meetingCode, userId, name }) => {
    const meeting = await findMeeting(meetingCode);
    if (meeting.status === "ended") throw new AppError("Meeting has ended", 409);
    if (meeting.status === "scheduled") throw new AppError("Meeting has not started yet", 409);
    const isHost = idValue(meeting.host) === idValue(userId);
    const active = await Participant.findOne({ meeting: meeting._id, user: userId, leftAt: null });
    if (active) return { meeting, waiting: false, participant: active };
    if (meeting.settings.lockMeeting && !isHost) throw new AppError("Meeting is locked", 409);
    if (meeting.settings.waitingRoom && !isHost) {
        await Meeting.updateOne({ _id: meeting._id, "waitingParticipants.user": { $ne: userId } }, { $push: { waitingParticipants: { user: userId, name, requestedAt: new Date() } } });
        const freshMeeting = await Meeting.findById(meeting._id);
        return { meeting: freshMeeting, waiting: true, participant: null };
    }
    if (meeting.waitingParticipants.some(w => w.user.toString() === userId.toString())) {
        await Meeting.updateOne({ _id: meeting._id }, { $pull: { waitingParticipants: { user: userId } } });
        meeting.waitingParticipants = meeting.waitingParticipants.filter(w => w.user.toString() !== userId.toString());
    }
    const participant = await Participant.findOneAndUpdate(
        { meeting: meeting._id, user: userId, leftAt: null },
        { $setOnInsert: { name, role: isHost ? "host" : "participant", joinedAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return { meeting, waiting: false, participant };
};

export const getUserMeetings = (userId) => Meeting.find({ host: userId }).sort({ createdAt: -1 }).populate("host", "name username");

export const startMeeting = async (meetingCode, userId) => {
    const meeting = await findMeeting(meetingCode);
    requireHost(meeting, userId, "start the meeting");
    if (meeting.status !== "scheduled") throw new AppError(meeting.status === "live" ? "Meeting is already live" : "Meeting has already ended", 409);
    meeting.status = "live";
    meeting.startedAt = new Date();
    await meeting.save();
    return meeting;
};

export const endMeeting = async (meetingCode, userId) => {
    const meeting = await findMeeting(meetingCode);
    requireHost(meeting, userId, "end the meeting");
    if (meeting.status !== "live") throw new AppError("Only a live meeting can be ended", 409);
    meeting.status = "ended";
    meeting.endedAt = new Date();
    meeting.waitingParticipants = [];
    await meeting.save();
    await Participant.updateMany({ meeting: meeting._id, leftAt: null }, { $set: { leftAt: meeting.endedAt } });
    return meeting;
};

export const leaveMeeting = async (meetingCode, userId) => {
    const meeting = await findMeeting(meetingCode);
    const participant = await Participant.findOne({ meeting: meeting._id, user: userId, leftAt: null });
    if (!participant) throw new AppError("Participant is not currently in the meeting", 409);
    participant.leftAt = new Date();
    await participant.save();
    return participant;
};

export const updateMeetingSettings = async (meetingCode, userId, settings) => {
    validateSettings(settings);
    const meeting = await findMeeting(meetingCode);
    requireHost(meeting, userId, "change meeting settings");
    Object.assign(meeting.settings, settings);
    await meeting.save();
    return meeting;
};

export const admitParticipant = async (meetingCode, hostId, participantUserId) => {
    if (!mongoose.isValidObjectId(participantUserId)) throw new AppError("Invalid participant user id", 400);
    const meeting = await findMeeting(meetingCode);
    requireHost(meeting, hostId, "admit participants");
    if (meeting.status !== "live") throw new AppError("Meeting is not live", 409);
    const waiting = meeting.waitingParticipants.find(w => w.user.toString() === participantUserId.toString());
    if (!waiting) throw new AppError("Participant is not in the waiting room", 409);
    const pulled = await Meeting.updateOne({ _id: meeting._id, "waitingParticipants.user": participantUserId }, { $pull: { waitingParticipants: { user: participantUserId } } });
    if (!pulled.modifiedCount) throw new AppError("Participant is not in the waiting room", 409);
    return Participant.findOneAndUpdate(
        { meeting: meeting._id, user: participantUserId, leftAt: null },
        { $setOnInsert: { name: waiting.name, role: "participant", joinedAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
};

export const removeParticipant = async (meetingCode, hostId, participantUserId) => {
    if (!mongoose.isValidObjectId(participantUserId)) throw new AppError("Invalid participant user id", 400);
    const meeting = await findMeeting(meetingCode);
    requireHost(meeting, hostId, "remove participants");
    if (idValue(meeting.host) === idValue(participantUserId)) throw new AppError("Host cannot be removed", 400);
    const participant = await Participant.findOne({ meeting: meeting._id, user: participantUserId, leftAt: null });
    if (!participant) throw new AppError("Participant is not currently in the meeting", 409);
    participant.leftAt = new Date();
    await participant.save();
    return participant;
};

export const removeWaitingParticipant = async (meetingCode, hostId, participantUserId) => {
    if (!mongoose.isValidObjectId(participantUserId)) throw new AppError("Invalid participant user id", 400);
    const meeting = await findMeeting(meetingCode);
    requireHost(meeting, hostId, "reject participants");
    const waiting = meeting.waitingParticipants.find(entry => idValue(entry.user) === idValue(participantUserId));
    const updated = await Meeting.findOneAndUpdate(
        { _id: meeting._id, waitingParticipants: { $elemMatch: { user: participantUserId } } },
        { $pull: { waitingParticipants: { user: participantUserId } } },
        { new: true }
    );
    if (!updated || !waiting) throw new AppError("Participant is not in the waiting room", 409);
    return { hostId: idValue(meeting.host), userId: idValue(participantUserId), name: waiting.name, requestedAt: waiting.requestedAt };
};

export const getMeetingParticipants = async (meetingCode, userId) => {
    const meeting = await findMeeting(meetingCode);
    requireHost(meeting, userId, "view participant analytics");
    return Participant.find({ meeting: meeting._id }).populate("user", "name username avatar").sort({ joinedAt: 1 });
};
