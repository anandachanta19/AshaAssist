import mongoose from "mongoose";

const AlertSchema = new mongoose.Schema({
    visitId: { type: String, required: true, index: true },
    label: { type: String },
    severity: { type: String, enum: ["low", "medium", "high"], default: "low" },
    reason: { type: String },
    recommendedAction: { type: String },

    // NEW: Store the chat messages that triggered this alert
    triggeringMessages: [{
        role: { type: String },
        content: { type: String }
    }],

    createdAt: { type: Date, default: Date.now },
    rawInference: { type: mongoose.Schema.Types.Mixed }
});

export default mongoose.model("Alert", AlertSchema);