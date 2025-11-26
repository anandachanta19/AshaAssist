/**
 * Chat Model (Mongoose)
 *
 * Purpose:
 * - Persist a single chat session per `visitId`, including message history,
 *   an optional analysis summary, and optional structured JSON extracted
 *   from the conversation.
 *
 * Fields:
 * - `userId`          : Optional string; reserved for future multi-user scenarios.
 * - `visitId`         : Required string; unique identifier for a patient visit (unique index).
 * - `messages`        : Array of message subdocuments: `{ role, content }`.
 * - `analysis`        : Optional string containing a human-readable summary.
 * - `structuredData`  : Mixed type holding extracted JSON (normalized clinical data).
 * - `createdAt`       : Creation timestamp.
 * - `updatedAt`       : Last update timestamp (maintained via `pre` hooks below).
 *
 * Indexes:
 * - Unique on `visitId` (also reiterated with `chatSchema.index({ visitId: 1 })`).
 *
 * Hooks:
 * - `pre('save')` and `pre('findOneAndUpdate')` keep `updatedAt` current.
 */

// models/Chat.js
import mongoose from 'mongoose';

/**
 * @typedef {'user'|'assistant'|'model'} MessageRole
 *
 * @typedef Message
 * @property {MessageRole} role - Message author role.
 * @property {string} content - Message text content.
 */

const messageSchema = new mongoose.Schema({
  role: { type: String, required: true, enum: ['user', 'assistant', 'model'] },
  content: { type: String, required: true },
}, { _id: false });

const chatSchema = new mongoose.Schema({
  userId: { type: String, index: true, required: false },
  visitId: { type: String, required: true, index: true, unique: true },
  messages: [messageSchema],
  analysis: { type: String, default: null },
  structuredData: { type: mongoose.Schema.Types.Mixed, default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

chatSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});
chatSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

chatSchema.index({ visitId: 1 });
const Chat = mongoose.model('Chat', chatSchema);
export default Chat;