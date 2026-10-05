import { joinMeeting, admitParticipant, removeParticipant, removeWaitingParticipant, updateMeetingSettings, leaveMeeting as persistLeave } from "../services/meeting.service.js";
import Meeting from "../models/Meeting.js";
import User from "../models/User.js";

const meetingRooms = new Map();
const mediaStates = new Map();
const activeScreenShares = new Map();
const safeHandler = (socket, eventName, fn) => async (payload) => {
    try { await fn(payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}); }
    catch (error) { socket.emit(eventName, { message: error.statusCode && error.statusCode < 500 ? error.message : "Unable to complete request" }); }
};
const notifyWaiting = (io, hostId, event, payload) => io.to(`user:${hostId}`).emit(event, payload);
const hostWaitingList = async (entries = []) => {
    const ids = entries.map(entry => entry.user?._id ?? entry.user).filter(Boolean);
    const users = await User.find({ _id: { $in: ids } }).select("name username avatar").lean();
    const byId = new Map(users.map(user => [user._id.toString(), user]));
    return entries.map(entry => {
        const userId = (entry.user?._id ?? entry.user)?.toString();
        const user = byId.get(userId);
        return {
            user: { id: userId, name: entry.name || user?.name || "Participant", avatar: user?.avatar || "" },
            name: entry.name || user?.name || "Participant",
            requestedAt: entry.requestedAt
        };
    });
};
const sendMeetingSnapshot = (socket, code) => {
    for (const state of mediaStates.get(code)?.values() || []) {
        if (state.socketId !== socket.id) socket.emit("participant:media-state", state);
    }
    const activeShare = activeScreenShares.get(code);
    if (activeShare) socket.emit("screenshare:started", activeShare);
};
const clearScreenShare = (io, code, socketId) => {
    const active = activeScreenShares.get(code);
    if (!active || (socketId && active.socketId !== socketId)) return false;
    activeScreenShares.delete(code);
    io.to(code).emit("screenshare:stopped", active);
    return true;
};
const clearWaiting = async (io, socket, exceptCode) => {
    const previous = socket.data.waitingMeetingCode;
    if (!previous || previous === exceptCode) return;
    const userSockets = await io.in(`user:${socket.user.id}`).fetchSockets();
    const anotherWaitingSocket = userSockets.some(other => other.id !== socket.id && other.data.waitingMeetingCode === previous);
    const meeting = anotherWaitingSocket ? null : await Meeting.findOneAndUpdate({ meetingCode: previous }, { $pull: { waitingParticipants: { user: socket.user.id } } }, { new: true });
    if (meeting) notifyWaiting(io, meeting.host.toString(), "waiting:left", { userId: socket.user.id, meetingCode: previous });
    await socket.leave(`waiting:${previous}`);
    socket.data.waitingMeetingCode = null;
};
const addSocketToMeeting = async (io, socket, code) => {
    if (socket.data.meetingCode && socket.data.meetingCode !== code) await removeSocketFromMeeting(io, socket);
    await clearWaiting(io, socket, code);
    if (socket.data.waitingMeetingCode) {
        const oldWaitingCode = socket.data.waitingMeetingCode;
        await socket.leave(`waiting:${oldWaitingCode}`);
        socket.data.waitingMeetingCode = null;
    }
    socket.join(code);
    socket.data.meetingCode = code;
    socket.data.waitingMeetingCode = null;
    if (!meetingRooms.has(code)) meetingRooms.set(code, new Map());
    const room = meetingRooms.get(code);
    room.set(socket.id, { socketId: socket.id, user: socket.user ?? socket.data.user });
    return [...room.values()];
};

export const registerMeetingSocket = (io, socket) => {
    socket.on("meeting:join", safeHandler(socket, "meeting:error", async ({ meetingCode }) => {
        if (typeof meetingCode !== "string") throw new Error("Invalid meeting code");
        const result = await joinMeeting({ meetingCode, userId: socket.user.id, name: socket.user.name });
        const code = result.meeting.meetingCode;
        if (result.waiting) {
            if (socket.data.meetingCode) await removeSocketFromMeeting(io, socket);
            await clearWaiting(io, socket, code);
            socket.data.waitingMeetingCode = code;
            await socket.join(`waiting:${code}`);
            socket.emit("waiting:status", { status: "waiting", meetingCode: code, message: "Waiting for the host to admit you" });
            const waiting = result.meeting.waitingParticipants.find(w => w.user.toString() === socket.user.id);
            const hostId = result.meeting.host.toString();
            notifyWaiting(io, hostId, "waiting:participant", {
                user: { id: socket.user.id, name: waiting?.name || socket.user.name, avatar: socket.user.avatar || "" },
                name: waiting?.name || socket.user.name,
                requestedAt: waiting?.requestedAt
            });
            return;
        }
        const participants = await addSocketToMeeting(io, socket, code);
        sendMeetingSnapshot(socket, code);
        socket.emit("meeting:participants", participants);
        socket.to(code).emit("participant:joined", { socketId: socket.id, user: socket.user });
        if (result.meeting.host.toString() === socket.user.id) socket.emit("waiting:list", await hostWaitingList(result.meeting.waitingParticipants));
    }));

    socket.on("meeting:leave", safeHandler(socket, "meeting:error", async () => removeSocketFromMeeting(io, socket)));

    socket.on("media:state", safeHandler(socket, "meeting:error", async ({ meetingCode, audioEnabled, videoEnabled }) => {
        const code = typeof meetingCode === "string" ? meetingCode.toUpperCase() : "";
        if (!code || socket.data.meetingCode !== code || !meetingRooms.get(code)?.has(socket.id)) throw new Error("Join the meeting before sending media state");
        if (typeof audioEnabled !== "boolean" || typeof videoEnabled !== "boolean") throw new Error("Invalid media state");
        if (!mediaStates.has(code)) mediaStates.set(code, new Map());
        const state = { meetingCode: code, userId: socket.user.id, socketId: socket.id, audioEnabled, videoEnabled };
        mediaStates.get(code).set(socket.id, state);
        io.to(code).emit("participant:media-state", state);
    }));

    socket.on("host:admit", safeHandler(socket, "meeting:error", async ({ meetingCode, participantUserId }) => {
        const participant = await admitParticipant(meetingCode, socket.user.id, participantUserId);
        await admitWaitingSockets(io, meetingCode.toUpperCase(), participantUserId, participant);
    }));

    socket.on("host:reject", safeHandler(socket, "meeting:error", async ({ meetingCode, participantUserId }) => {
        const rejected = await removeWaitingParticipant(meetingCode, socket.user.id, participantUserId);
        const code = meetingCode.toUpperCase();
        notifyWaiting(io, rejected.hostId, "waiting:left", { userId: rejected.userId, meetingCode: code });
        const targets = await io.in(`user:${participantUserId}`).fetchSockets();
        for (const target of targets) if (target.data.waitingMeetingCode === code) {
            await target.leave(`waiting:${code}`);
            target.data.waitingMeetingCode = null;
            target.emit("waiting:rejected", { message: "The host did not admit you" });
        }
    }));

    socket.on("host:remove", safeHandler(socket, "meeting:error", async ({ meetingCode, participantUserId }) => {
        await removeParticipant(meetingCode, socket.user.id, participantUserId);
        const code = meetingCode.toUpperCase();
        const targets = await io.in(`user:${participantUserId}`).fetchSockets();
        for (const target of targets) if (target.data.meetingCode === code) {
            target.emit("participant:removed", { message: "You were removed by the host" });
            await removeSocketFromMeeting(io, target, true);
        }
        io.to(code).emit("participant:removed", { userId: participantUserId });
    }));

    socket.on("meeting:lock", safeHandler(socket, "meeting:error", async ({ meetingCode, locked }) => {
        if (typeof locked !== "boolean") throw new Error("locked must be a boolean");
        const meeting = await updateMeetingSettings(meetingCode, socket.user.id, { lockMeeting: locked });
        io.to(meeting.meetingCode).emit("meeting:settings-updated", { settings: meeting.settings });
    }));

    socket.on("screenshare:start", async (payload, acknowledge) => {
        try {
            const { meetingCode, streamId, trackId } = payload && typeof payload === "object" ? payload : {};
            const code = typeof meetingCode === "string" ? meetingCode.toUpperCase() : "";
            if (!code || socket.data.meetingCode !== code || !meetingRooms.get(code)?.has(socket.id)) throw new Error("Join the meeting first");
            if (typeof streamId !== "string" || !streamId || typeof trackId !== "string" || !trackId) throw new Error("Invalid screen share stream");
            const meeting = await Meeting.findOne({ meetingCode: code });
            if (!meeting || meeting.status !== "live") throw new Error("Meeting is not live");
            if (!meeting.settings.allowScreenShare && meeting.host.toString() !== socket.user.id) throw new Error("Screen sharing is disabled");
            const current = activeScreenShares.get(code);
            if (current) throw new Error(`${current.name || "Another participant"} is already presenting.`);
            const active = { meetingCode: code, userId: socket.user.id, socketId: socket.id, name: socket.user.name, streamId, trackId };
            activeScreenShares.set(code, active);
            io.to(code).emit("screenshare:started", active);
            acknowledge?.({ success: true, share: active });
        } catch (error) {
            acknowledge?.({ success: false, message: error.message || "Unable to start screen sharing" });
        }
    });
    socket.on("screenshare:stop", (acknowledge) => {
        const code = socket.data.meetingCode;
        const current = code && activeScreenShares.get(code);
        if (!current || current.socketId !== socket.id) {
            acknowledge?.({ success: false, message: "You are not the active screen sharer" });
            return;
        }
        clearScreenShare(io, code, socket.id);
        acknowledge?.({ success: true });
    });

    const relay = (event, key) => (payload) => {
        try {
            const data = payload && typeof payload === "object" ? payload : {};
            const code = socket.data.meetingCode;
            if (!code || typeof data.to !== "string" || !data[key] || !meetingRooms.get(code)?.has(data.to)) return;
            const forwarded = { from: socket.id, [key]: data[key] };
            if (event === "webrtc:offer" && typeof data.screenMid === "string") forwarded.screenMid = data.screenMid;
            io.to(data.to).emit(event, forwarded);
        } catch { socket.emit("meeting:error", { message: "Invalid signaling payload" }); }
    };
    socket.on("webrtc:offer", relay("webrtc:offer", "offer"));
    socket.on("webrtc:answer", relay("webrtc:answer", "answer"));
    socket.on("webrtc:ice-candidate", relay("webrtc:ice-candidate", "candidate"));
};

export const admitWaitingSockets = async (io, code, userId, participant) => {
    const targets = await io.in(`user:${userId}`).fetchSockets();
    for (const target of targets) if (target.data.waitingMeetingCode === code) {
        const participants = await addSocketToMeeting(io, target, code);
        target.emit("waiting:admitted", { meetingCode: code, participant });
        sendMeetingSnapshot(target, code);
        target.emit("meeting:participants", participants);
        io.to(code).emit("participant:joined", { socketId: target.id, user: target.data.user });
    }
    const meeting = await Meeting.findOne({ meetingCode: code }).select("host");
    if (meeting) notifyWaiting(io, meeting.host.toString(), "waiting:left", { userId: userId.toString(), meetingCode: code });
};

export const closeMeetingRoom = async (io, code) => {
    clearScreenShare(io, code);
    io.to(code).emit("meeting:ended", { meetingCode: code });
    io.to(`waiting:${code}`).emit("meeting:ended", { meetingCode: code });
    const sockets = await io.in(code).fetchSockets();
    for (const socket of sockets) await removeSocketFromMeeting(io, socket, true);
    const waitingSockets = await io.in(`waiting:${code}`).fetchSockets();
    for (const socket of waitingSockets) {
        socket.data.waitingMeetingCode = null;
        await socket.leave(`waiting:${code}`);
    }
    meetingRooms.delete(code);
    mediaStates.delete(code);
    activeScreenShares.delete(code);
};

export const removeSocketFromMeeting = async (io, socket, skipPersistence = false) => {
    const user = socket.user ?? socket.data.user;
    if (!user?.id) return;
    const code = socket.data.meetingCode;
    const waitingCode = socket.data.waitingMeetingCode;
    if (waitingCode) {
        const otherWaitingSockets = await io.in(`user:${user.id}`).fetchSockets();
        const hasOtherWaitingSocket = otherWaitingSockets.some(other => other.id !== socket.id && other.data.waitingMeetingCode === waitingCode);
        socket.data.waitingMeetingCode = null;
        if (!hasOtherWaitingSocket) {
            const meeting = await Meeting.findOneAndUpdate({ meetingCode: waitingCode }, { $pull: { waitingParticipants: { user: user.id } } }, { new: true });
            if (meeting) notifyWaiting(io, meeting.host.toString(), "waiting:left", { userId: user.id, meetingCode: waitingCode });
        }
        await socket.leave(`waiting:${waitingCode}`);
    }
    if (!code) return;
    clearScreenShare(io, code, socket.id);
    const room = meetingRooms.get(code);
    room?.delete(socket.id);
    socket.leave(code);
    socket.data.meetingCode = null;
    io.to(code).except(socket.id).emit("participant:left", { socketId: socket.id, userId: user.id });
    const media = mediaStates.get(code);
    if (media?.delete(socket.id)) {
        io.to(code).emit("participant:media-state", { meetingCode: code, userId: user.id, socketId: socket.id, audioEnabled: false, videoEnabled: false, removed: true });
        if (media.size === 0) mediaStates.delete(code);
    }
    const stillHere = room && [...room.values()].some(p => p.user.id === user.id);
    if (room?.size === 0) meetingRooms.delete(code);
    if (!skipPersistence && !stillHere) {
        try { await persistLeave(code, user.id); } catch (err) { if (err.statusCode !== 409) console.error("Unable to persist participant leave", err.message); }
    }
};
