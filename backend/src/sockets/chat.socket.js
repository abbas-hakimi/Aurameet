import Meeting from "../models/Meeting.js";
import Message from "../models/Message.js";
import Participant from "../models/Participant.js";

export const registerChatSocket = (io, socket) => {
    let windowStarted = Date.now();
    let sends = 0;
    const safe = (event, fn) => async (payload) => {
        try { await fn(payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}); }
        catch { socket.emit(event, { message: "Unable to complete chat request" }); }
    };
    socket.on("chat:send", safe("chat:error", async ({ meetingCode, message }) => {
        const code = typeof meetingCode === "string" ? meetingCode.toUpperCase() : "";
        if (!code || socket.data.meetingCode !== code || typeof message !== "string" || !message.trim() || message.trim().length > 2000) throw new Error("Invalid chat message");
        const now = Date.now();
        if (now - windowStarted > 10000) { windowStarted = now; sends = 0; }
        if (++sends > 20) throw new Error("Too many messages");
        const meeting = await Meeting.findOne({ meetingCode: code });
        if (!meeting || meeting.status !== "live") throw new Error("Chat is only available during a live meeting");
        if (!meeting.settings.allowChat && meeting.host.toString() !== socket.user.id) throw new Error("Chat is disabled");
        const saved = await Message.create({ meeting: meeting._id, sender: socket.user.id, message: message.trim(), type: "user" });
        const chatMessage = { id: saved._id.toString(), sender: { id: socket.user.id, name: socket.user.name, username: socket.user.username, avatar: socket.user.avatar }, message: saved.message, timestamp: saved.createdAt };
        io.to(code).emit("chat:message", chatMessage);
    }));

    socket.on("chat:history", safe("chat:error", async ({ meetingCode }) => {
        const code = typeof meetingCode === "string" ? meetingCode.toUpperCase() : "";
        if (!code || socket.data.meetingCode !== code) return;
        const meeting = await Meeting.findOne({ meetingCode: code });
        if (!meeting) return;
        if (meeting.status !== "live" || (!meeting.settings.allowChat && meeting.host.toString() !== socket.user.id)) throw new Error("Chat is unavailable");
        const participant = await Participant.findOne({ meeting: meeting._id, user: socket.user.id, leftAt: null }).select("joinedAt");
        if (!participant) throw new Error("Participant is not currently in the meeting");
        const docs = await Message.find({ meeting: meeting._id, createdAt: { $gte: participant.joinedAt } }).sort({ createdAt: -1 }).limit(100).populate("sender", "name username avatar").lean();
        socket.emit("chat:history", docs.reverse().map(msg => ({
            id: msg._id.toString(),
            sender: msg.sender ? { id: msg.sender._id.toString(), name: msg.sender.name, username: msg.sender.username, avatar: msg.sender.avatar } : null,
            message: msg.message,
            timestamp: msg.createdAt
        })));
    }));
};
