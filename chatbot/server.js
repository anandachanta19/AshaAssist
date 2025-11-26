/**
 * AshaAssist ChatBot Backend Server
 *
 * Overview:
 * - Express server providing endpoints to index visit transcripts into a vector store,
 *   chat with contextual retrieval, analyze conversations, translate responses, and
 *   persist chat sessions in MongoDB.
 *
 * Refactored to use Controller/Service pattern.
 */

import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import connectDB from "./config/db.js";
import * as chatController from "./controllers/chatController.js";

dotenv.config();
connectDB();

const app = express();
app.use(bodyParser.json());
app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);

// Routes
app.post("/index", chatController.indexTranscript);
app.post("/chat", chatController.chat);
app.post("/analyze", chatController.analyze);
app.post("/save-chat", chatController.saveChat);
app.get("/chat/visit/:visitId", chatController.getChatByVisitId);
app.get("/chat/:chatId", chatController.getChatById);
app.post("/follow-up/:visitId", chatController.followUp);
app.get("/alerts/dashboard", chatController.getAlertsDashboard);

const PORT = process.env.PORT || 8001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
