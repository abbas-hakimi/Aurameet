import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
    {
        meetingCode: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        title: {
            type: String,
            required: true,
            trim: true
        },

        host: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        status: {
            type: String,
            enum: ["scheduled", "live", "ended"],
            default: "scheduled"
        },

        scheduledAt: {
            type: Date
        },

        startedAt: {
            type: Date
        },

        endedAt: {
            type: Date
        },

        waitingParticipants: [
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        name: {
            type: String,
            required: true
        },

        requestedAt: {
            type: Date,
            default: Date.now
        }
    }
],

        settings: {
            waitingRoom: {
                type: Boolean,
                default: false
            },

            lockMeeting: {
                type: Boolean,
                default: false
            },

            allowChat: {
                type: Boolean,
                default: true
            },

            allowScreenShare: {
                type: Boolean,
                default: true
            }
        }
    },
    {
        timestamps: true
    }
);

meetingSchema.index({ host: 1, createdAt: -1 });

const Meeting = mongoose.model("Meeting", meetingSchema);

export default Meeting;
