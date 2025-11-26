import Alert from "../models/Alert.js";
import Chat from "../models/Chat.js";
import chatService from "../services/chatService.js";

export const indexTranscript = async (req, res) => {
    try {
        const { visitId, transcript } = req.body;
        if (!visitId || !transcript) {
            return res.status(400).json({ error: "visitId and transcript are required." });
        }
        const count = await chatService.indexTranscript(visitId, transcript);
        res.status(200).json({ message: "Indexing successful", chunksStored: count });
    } catch (error) {
        console.error("Error in POST /index:", error);
        res.status(500).json({ error: "Internal Server Error during indexing" });
    }
};

export const chat = async (req, res) => {
    try {
        const { visitId, messages, targetLanguage } = req.body;
        if (!visitId) return res.status(400).json({ error: "Missing visitId" });
        if (!messages || messages.length === 0) return res.status(400).json({ error: "Missing messages" });
        if (!targetLanguage) return res.status(400).json({ error: "Missing targetLanguage" });

        const response = await chatService.generateChatResponse(visitId, messages, targetLanguage);
        res.status(200).json({ content: response });
    } catch (error) {
        console.error(`💥 Error in POST /chat [Visit ID: ${req.body?.visitId}]:`, error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const analyze = async (req, res) => {
    try {
        const { visitId, messages, targetLanguage } = req.body;
        if (!visitId) return res.status(400).json({ error: "Missing visitId" });
        if (!messages || messages.length < 2) return res.status(400).json({ error: "Insufficient chat history" });
        if (!targetLanguage) return res.status(400).json({ error: "Missing targetLanguage" });

        const result = await chatService.analyzeVisit(visitId, messages, targetLanguage);
        res.status(200).json(result);
    } catch (error) {
        console.error(`Error in POST /analyze [Visit ID: ${req.body?.visitId}]:`, error);
        res.status(500).json({ error: "Failed to generate analysis." });
    }
};

export const saveChat = async (req, res) => {
    try {
        const { visitId, messages, analysis, structuredData } = req.body;

        if (!visitId || !messages?.length) {
            return res.status(400).json({ error: "Missing visitId or messages" });
        }

        const updatedChat = await Chat.findOneAndUpdate(
            { visitId: visitId },
            {
                $set: {
                    messages: messages,
                    analysis: analysis,
                    structuredData: structuredData
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        console.log(`💾 Chat saved/updated for Visit ID: ${visitId}`);
        res.status(200).json({ message: "Chat saved successfully", chatId: updatedChat._id });

    } catch (error) {
        console.error("Error saving/updating chat:", error);
        res.status(500).json({ error: "Failed to save chat" });
    }
};

export const getChatByVisitId = async (req, res) => {
    try {
        const visitId = req.params.visitId;
        console.log(`Fetching latest chat for Visit ID: ${visitId}`);

        const chat = await Chat.findOne({ visitId: visitId })
            .sort({ updatedAt: -1 })
            .select('messages analysis structuredData');

        if (!chat) {
            return res.status(200).json({ messages: [], analysis: null, structuredData: null });
        }
        res.json({
            messages: chat.messages,
            analysis: chat.analysis,
            structuredData: chat.structuredData,
            alert: await Alert.findOne({ visitId: visitId }).sort({ createdAt: -1 })
        });
    } catch (error) {
        console.error("Error fetching chat by visitId:", error);
        if (error.name === 'CastError') { return res.status(400).json({ error: "Invalid Visit ID format" }); }
        res.status(500).json({ error: "Failed to fetch chat" });
    }
};

export const getChatById = async (req, res) => {
    try {
        const chatId = req.params.chatId;
        console.log(`Fetching specific chat by DB ID: ${chatId}`);
        const chat = await Chat.findById(chatId);
        if (!chat) { return res.status(404).json({ error: "Chat not found" }); }
        res.json(chat);
    } catch (error) {
        console.error("Error fetching chat by ID:", error);
        if (error.name === 'CastError') { return res.status(400).json({ error: "Invalid Chat ID format" }); }
        res.status(500).json({ error: "Failed to fetch chat" });
    }
};

export const followUp = async (req, res) => {
    try {
        const { visitId } = req.params;
        const botQuestion = await chatService.generateFollowUpQuestion(visitId);
        res.json({
            success: true,
            followUpQuestion: botQuestion,
        });
    } catch (error) {
        console.error("FOLLOW UP ERROR:", error);
        if (error.message === "No previous visit found for this patient.") {
            return res.status(404).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

export const getAlertsDashboard = async (req, res) => {
    try {
        const summary = await Alert.aggregate([
            {
                $group: {
                    _id: "$visitId",
                    totalAlerts: { $sum: 1 },
                    highestSeverity: { $max: "$severity" },
                    latestAlertDate: { $max: "$createdAt" },
                    alerts: {
                        $push: {
                            _id: "$_id",
                            label: "$label",
                            severity: "$severity",
                            createdAt: "$createdAt",
                            reason: "$reason",
                            recommendedAction: "$recommendedAction",
                            triggeringMessages: "$triggeringMessages"
                        }
                    }
                }
            },
            { $sort: { latestAlertDate: -1 } }
        ]);

        res.json({ dashboardData: summary });
    } catch (error) {
        console.error("Error fetching alerts dashboard:", error);
        res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
};
