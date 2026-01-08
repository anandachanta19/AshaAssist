import { DataAPIClient } from "@datastax/astra-db-ts";
import { TranslationServiceClient } from "@google-cloud/translate";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import ollama from "ollama";
import {
    ANALYSIS_PROMPT_RAW,
    ANALYSIS_PROMPT_STRUCTURED,
    CHAT_SYSTEM_PROMPT,
    EXTRACTOR_PROMPT,
    FOLLOW_UP_PROMPT,
    SERIOUSNESS_PROMPT
} from "../config/promptConfig.js";
import Alert from "../models/Alert.js";
import Chat from "../models/Chat.js";

dotenv.config();

const {
    ASTRA_DB_NAMESPACE,
    ASTRADB_COLLECTION,
    ASTRA_DB_API,
    ASTRA_DB_APPLICATION_TOKEN,
    GEMINI_API_KEY,
    GOOGLE_PROJECT_ID,
} = process.env;

if (!ASTRA_DB_API || !ASTRA_DB_APPLICATION_TOKEN || !GEMINI_API_KEY || !ASTRA_DB_NAMESPACE || !ASTRADB_COLLECTION) {
    console.error("💥 Missing required environment variables in ChatService.");
    // We might not want to exit here if we want to allow the app to start even if some services are down, 
    // but for now let's keep it consistent with original behavior or just log error.
}

// Initialize Clients
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const translationClient = new TranslationServiceClient();
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API, { keyspace: ASTRA_DB_NAMESPACE });

class ChatService {

    /**
     * Translate plain text to a target language using Google Cloud Translation.
     */
    async translateText(text, targetLanguage) {
        if (!targetLanguage || targetLanguage.startsWith('en')) {
            return text;
        }

        console.log(`   Translating text to: ${targetLanguage}...`);
        const request = {
            parent: `projects/${GOOGLE_PROJECT_ID}/locations/global`,
            contents: [text],
            mimeType: 'text/plain',
            sourceLanguageCode: 'en-US',
            targetLanguageCode: targetLanguage,
        };

        try {
            const [response] = await translationClient.translateText(request);
            const translation = response.translations[0].translatedText;
            return translation;
        } catch (error) {
            console.error("Translation error:", error);
            return text;
        }
    }

    /**
     * Index visit transcript into Astra DB with vector embeddings.
     */
    async indexTranscript(visitId, transcript) {
        console.log(`⏳ INDEXING: Processing transcript for Visit ID: ${visitId}`);
        const chunks = transcript.match(/[^.!?]+[.!?]*/g) || [transcript];
        const collection = await db.collection(ASTRADB_COLLECTION);
        let count = 0;

        for (const chunk of chunks) {
            const cleanedChunk = chunk.trim();
            if (cleanedChunk.length === 0) continue;
            try {
                const embedResp = await ollama.embeddings({ model: "nomic-embed-text", prompt: cleanedChunk });
                await collection.insertOne({ visitId: visitId, text: cleanedChunk, $vector: embedResp.embedding });
                count++;
            } catch (ollamaError) {
                console.error(`Ollama embedding error for chunk: "${cleanedChunk.slice(0, 50)}..."`, ollamaError.message);
            }
        }
        console.log(`✅ INDEXING COMPLETE: Stored ${count} chunks for Visit ID: ${visitId}`);
        return count;
    }

    /**
     * Contextual chat for a specific visit.
     */
    async generateChatResponse(visitId, messages, targetLanguage) {
        const latestMessage = messages?.[messages.length - 1]?.content;
        console.log(`\n💬 CHAT [Visit ID: ${visitId}] User: "${latestMessage}"`);

        let docContext = "";
        let embedding = [];

        try {
            const embedResp = await ollama.embeddings({ model: "nomic-embed-text", prompt: latestMessage });
            embedding = embedResp.embedding;
        } catch (err) {
            console.error("Ollama embedding error:", err.message);
        }

        if (embedding.length > 0) {
            try {
                const collection = await db.collection(ASTRADB_COLLECTION);
                const cursor = collection.find({ visitId: visitId }, { sort: { $vector: embedding }, limit: 5, includeSimilarity: true });
                const documents = await cursor.toArray();
                if (documents?.length > 0) {
                    docContext = documents.map((doc, i) => `Context Document ${i + 1}:\n${doc.text} (Similarity: ${doc.$similarity?.toFixed(4) || 'N/A'})`).join("\n\n");
                }
            } catch (err) {
                console.error("DB query error:", err);
            }
        }

        const systemPrompt = CHAT_SYSTEM_PROMPT(visitId, docContext);
        const contents = [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "Understood. I will provide 3 patient-friendly questions..." }] },
            ...messages.map((msg) => ({
                role: msg.role === "user" ? "user" : "model",
                parts: [{ text: msg.content }],
            })),
        ];

        const result = await model.generateContent({ contents });
        const englishResponse = result.response.text();
        const translatedResponse = await this.translateText(englishResponse, targetLanguage);

        return translatedResponse;
    }

    /**
     * Extract structured data from a conversation using Gemini.
     */
    async extractStructuredData(messages, visitId) {
        console.log(`   🤖 1. Extracting structured data for Visit ID: ${visitId}`);
        const conversationText = messages
            .map(msg => `${msg.role === 'user' ? 'Health Worker' : 'AI Assistant'}: ${msg.content}`)
            .join('\n');

        const extractorPrompt = EXTRACTOR_PROMPT(conversationText);

        try {
            const contents = [{ role: "user", parts: [{ text: extractorPrompt }] }];
            const result = await model.generateContent({ contents });
            const jsonText = result.response.text().replace(/^```json\n?/, '').replace(/\n?```$/, '');
            return JSON.parse(jsonText);
        } catch (error) {
            console.error("   ❌ Error during data extraction:", error);
            throw new Error("Failed to extract structured data from AI.");
        }
    }

    /**
     * Run an LLM-based classifier to decide if the VISIT ANALYSIS indicates a serious condition.
     */
    async detectSeriousIssue(analysisText, structuredData, visitId) {
        console.log(`Running seriousness classifier on Analysis for Visit ID: ${visitId}`);
        const prompt = SERIOUSNESS_PROMPT(analysisText, structuredData);

        try {
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            });

            const parsed = JSON.parse(result.response.text());
            if (typeof parsed.alert !== 'boolean') {
                throw new Error("Invalid JSON structure returned");
            }
            return parsed;
        } catch (err) {
            console.error("Seriousness classifier error:", err.message);
            return {
                alert: false,
                severity: "low",
                label: "Error",
                reason: "Could not classify analysis.",
                recommendedAction: "Manual review required."
            };
        }
    }

    /**
     * Generate a concise analysis for a visit.
     */
    async analyzeVisit(visitId, messages, targetLanguage) {
        console.log(`\nANALYZING chat for Visit ID: ${visitId}...`);

        // 1. Extract Structured Data
        let structuredData;
        try {
            structuredData = await this.extractStructuredData(messages, visitId);
        } catch (extractionError) {
            console.warn(`Could not extract structured data. Falling back to raw text analysis.`);
            structuredData = { error: "Extraction failed" };
        }

        // 2. Generate Analysis Text
        const conversationHistory = messages.map(msg => `${msg.role === 'user' ? 'Health Worker' : 'AI Assistant'}: ${msg.content}`).join('\n');
        const analysisPrompt = structuredData.error
            ? ANALYSIS_PROMPT_RAW(visitId, conversationHistory)
            : ANALYSIS_PROMPT_STRUCTURED(visitId, structuredData);

        const contents = [{ role: "user", parts: [{ text: analysisPrompt }] }];
        const result = await model.generateContent({ contents });
        const analysisText = result.response.text();

        // 3. Detect Serious Issues
        let generatedAlert = null;
        try {
            const detectionResult = await this.detectSeriousIssue(analysisText, structuredData, visitId);
            if (detectionResult && detectionResult.alert) {
                console.log(`ALERT TRIGGERED: ${detectionResult.label} (${detectionResult.severity})`);
                const newAlert = new Alert({
                    visitId: visitId,
                    label: detectionResult.label,
                    severity: detectionResult.severity,
                    reason: detectionResult.reason,
                    recommendedAction: detectionResult.recommendedAction,
                    triggeringMessages: messages,
                    rawInference: detectionResult
                });
                await newAlert.save();
                generatedAlert = detectionResult;
            } else {
                console.log(`Condition assessed as LOW severity/Routine. No alert saved.`);
            }
        } catch (alertError) {
            console.error("Error processing seriousness alert:", alertError);
        }

        const translatedAnalysis = await this.translateText(analysisText, targetLanguage);

        return {
            analysis: translatedAnalysis,
            structuredData: structuredData,
            alert: generatedAlert
        };
    }

    /**
     * Generate a follow-up question based on previous visit analysis.
     */
    async generateFollowUpQuestion(visitId) {
        const previousChat = await Chat.findOne({ visitId });
        if (!previousChat) {
            throw new Error("No previous visit found for this patient.");
        }

        const { analysis, structuredData, messages } = previousChat;
        const prompt = FOLLOW_UP_PROMPT(analysis, structuredData, messages);

        const result = await model.generateContent(prompt);
        const botQuestion = result.response.text().trim();

        const newMessage = {
            role: 'model',
            content: botQuestion,
            timestamp: new Date()
        };

        previousChat.messages.push(newMessage);
        await previousChat.save();

        return botQuestion;
    }
}

export default new ChatService();
