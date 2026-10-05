import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
    {
        meeting: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Meeting",
            required: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        name: {
            type: String,
            required: true
        },

        role: {
            type: String,
            enum: ["host", "co-host", "participant", "guest"],
            default: "participant"
        },

        joinedAt: {
            type: Date,
            default: Date.now
        },

        leftAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

participantSchema.index({ meeting: 1, user: 1, leftAt: 1 });

const Participant = mongoose.model(
    "Participant",
    participantSchema
);

export default Participant;
