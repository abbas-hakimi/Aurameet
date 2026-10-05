import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        meeting: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Meeting",
            required: true
        },

        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        message: {
            type: String,
            required: true,
            trim: true
        },

        type: {
            type: String,
            enum: ["user", "system"],
            default: "user"
        }
    },
    {
        timestamps: true
    }
);

messageSchema.index({ meeting: 1, createdAt: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
