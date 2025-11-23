/**
 * AshaAssist ChatBot Backend Server
 *
 * Overview:
 * - Express server providing endpoints to index visit transcripts into a vector store,
 *   chat with contextual retrieval, analyze conversations, translate responses, and
 *   persist chat sessions in MongoDB.
 *
 * Core services and libraries:
 * - DataStax Astra DB (Vector): Stores transcript chunks with `$vector` for similarity search.
 * - Ollama: Generates text embeddings (`nomic-embed-text`) for indexing and retrieval.
 * - Google Generative AI (Gemini): Generates assistant responses and structured extraction.
 * - Google Cloud Translation API: Translates assistant output to a requested target language.
 * - MongoDB (Mongoose): Persists chat messages, analysis, and structured data (`models/Chat.js`).
 *
 * Environment variables (required):
 * - `ASTRA_DB_NAMESPACE`           : Astra DB keyspace/namespace.
 * - `ASTRADB_COLLECTION`           : Astra DB collection name used for storing transcript chunks.
 * - `ASTRA_DB_API`                 : Astra DB Data API endpoint URL.
 * - `ASTRA_DB_APPLICATION_TOKEN`   : Astra DB application token.
 * - `GEMINI_API_KEY`               : Google Generative AI API key.
 * - `GOOGLE_PROJECT_ID`            : GCP project ID with Cloud Translation API enabled.
 *
 * Other configuration:
 * - MongoDB connection is initialized via `config/db.js` on server startup.
 * - CORS is enabled for `http://localhost:5173` (Vite dev server) with credentials.
 *
 * Important note:
 * - The Gemini model string `"gemini-2.5-pro"` may not be available in all regions/tenants
 *   and can return 404. If so, switch to an available model for your project.
 *
 * High-level data flow:
 * - Indexing (/index): Split transcript into chunks -> embed via Ollama -> insert into Astra DB with `$vector`.
 * - Chat (/chat): Embed latest user message -> retrieve top-K similar chunks for the same visit ->
 *   craft prompt for Gemini -> generate English response -> translate to `targetLanguage` -> return.
 * - Analyze (/analyze): Use Gemini to extract structured JSON -> craft analysis prompt (fallback to raw text if needed) ->
 *   generate English analysis -> translate -> return both `analysis` and `structuredData`.
 * - Persistence (/save-chat, /chat/*): Upsert and fetch chat sessions in MongoDB by `visitId` or `_id`.
 *
 * Endpoints:
 * - POST `/index`
 *   Body: `{ visitId: string, transcript: string }`
 *   Returns: `{ message: string, chunksStored: number }`
 *
 * - POST `/chat`
 *   Body: `{ visitId: string, messages: Array<{ role: 'user'|'assistant', content: string }>, targetLanguage: string }`
 *   Returns: `{ content: string }` (possibly translated)
 *
 * - POST `/analyze`
 *   Body: `{ visitId: string, messages: Array<{ role: 'user'|'assistant', content: string }>, targetLanguage: string }`
 *   Returns: `{ analysis: string, structuredData: object }` (analysis may be translated)
 *
 * - POST `/save-chat`
 *   Body: `{ visitId: string, messages: Array<...>, analysis?: string, structuredData?: object }`
 *   Returns: `{ message: string, chatId: string }`
 *
 * - GET `/chat/visit/:visitId`
 *   Returns: `{ messages: Array<...>, analysis: string|null, structuredData: object|null }`
 *
 * - GET `/chat/:chatId`
 *   Returns: Full chat document by MongoDB `_id`.
 */

import { DataAPIClient } from "@datastax/astra-db-ts";
import { TranslationServiceClient } from "@google-cloud/translate";
import { GoogleGenerativeAI } from "@google/generative-ai";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import ollama from "ollama";
import connectDB from "./config/db.js";
import Chat from "./models/Chat.js";
import Alert from "./models/Alert.js";

dotenv.config();
connectDB();

const {
    ASTRA_DB_NAMESPACE,
    ASTRADB_COLLECTION,
    ASTRA_DB_API,
    ASTRA_DB_APPLICATION_TOKEN,
    GEMINI_API_KEY,
    GOOGLE_PROJECT_ID,
} = process.env;

if (!ASTRA_DB_API || !ASTRA_DB_APPLICATION_TOKEN || !GEMINI_API_KEY || !ASTRA_DB_NAMESPACE || !ASTRADB_COLLECTION) {
    console.error("💥 Missing required environment variables.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

const translationClient = new TranslationServiceClient();

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API, { keyspace: ASTRA_DB_NAMESPACE });

const app = express();
app.use(bodyParser.json());
app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);

/**
 * Translate plain text to a target language using Google Cloud Translation.
 *
 * Behavior:
 * - Skips translation when `targetLanguage` is falsy or starts with `en`.
 * - Falls back to returning the original English text on translation errors.
 *
 * @param {string} text - English input text to translate.
 * @param {string} targetLanguage - BCP-47 language code (e.g., `hi`, `es`, `en-GB`).
 * @returns {Promise<string>} Translated text (or original text on error/skip).
 */
async function translateText(text, targetLanguage) {
    // Don't translate if the target is English
    if (!targetLanguage || targetLanguage.startsWith('en')) {
        console.log("   Target is English, skipping translation.");
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
        console.log(`   Translation successful: ${translation.substring(0, 50)}...`);
        return translation;
    } catch (error) {
        console.error("   ❌ Translation error:", error);
        return text;
    }
}

/**
 * POST /index
 * Index visit transcript into Astra DB with vector embeddings.
 *
 * Request body:
 * - visitId: string (required) — unique identifier for the visit
 * - transcript: string (required) — full transcript to be chunked and indexed
 *
 * Response: 200
 * - { message: string, chunksStored: number }
 *
 * Errors:
 * - 400 on missing fields
 * - 500 on unexpected failures
 */
app.post("/index", async (req, res) => {
    try {
        const { visitId, transcript } = req.body;
        if (!visitId || !transcript) { return res.status(400).json({ error: "visitId and transcript are required." }); }
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
            } catch (ollamaError) { console.error(`❌ Ollama embedding error for chunk: "${cleanedChunk.slice(0, 50)}..."`, ollamaError.message); }
        }
        console.log(`✅ INDEXING COMPLETE: Stored ${count} chunks for Visit ID: ${visitId}`);
        res.status(200).json({ message: "Indexing successful", chunksStored: count });
    } catch (error) { console.error("💥 Error in POST /index:", error); res.status(500).json({ error: "Internal Server Error during indexing" }); }
});


/**
 * POST /chat
 * Contextual chat for a specific visit.
 *
 * Flow:
 * - Embed latest user message via Ollama
 * - Retrieve top-K similar transcript chunks for the same `visitId` from Astra DB
 * - Build prompt and call Gemini to produce an English response
 * - Translate to `targetLanguage` and return
 *
 * Request body:
 * - visitId: string (required)
 * - messages: Array<{ role: 'user'|'assistant', content: string }> (required)
 * - targetLanguage: string (required) — BCP-47 code
 *
 * Response: 200
 * - { content: string } — translated assistant response
 */
app.post("/chat", async (req, res) => {
    try {
        const { visitId, messages, targetLanguage } = req.body;
        const latestMessage = messages?.[messages.length - 1]?.content;
        if (!visitId) { return res.status(400).json({ error: "Missing visitId in request body" }); }
        if (!messages || messages.length === 0 || !latestMessage) { return res.status(400).json({ error: "Missing or invalid messages array" }); }
        if (!targetLanguage) { return res.status(400).json({ error: "Missing targetLanguage" }); }
        console.log(`\n💬 CHAT [Visit ID: ${visitId}] User: "${latestMessage}"`);
        let docContext = "";
        let embedding = [];
        try {
            const embedResp = await ollama.embeddings({ model: "nomic-embed-text", prompt: latestMessage });
            embedding = embedResp.embedding;
            console.log(`   Vector: [${embedding.length} dimensions]`);
        } catch (err) { console.error("   ❌ Ollama embedding error:", err.message); }
        if (embedding.length > 0) {
            try {
                const collection = await db.collection(ASTRADB_COLLECTION);
                console.log(`   Querying AstraDB collection '${ASTRADB_COLLECTION}' for visitId '${visitId}'...`);
                const cursor = collection.find({ visitId: visitId }, { sort: { $vector: embedding }, limit: 5, includeSimilarity: true });
                const documents = await cursor.toArray();
                console.log(`   📚 Retrieved ${documents?.length} documents`);
                if (documents?.length > 0) {
                    docContext = documents.map((doc, i) => `Context Document ${i + 1}:\n${doc.text} (Similarity: ${doc.$similarity?.toFixed(4) || 'N/A'})`).join("\n\n");
                    console.log(`   Context sample: "${docContext.slice(0, 100)}..."`);
                } else { console.log("   No relevant documents found for this visit.") }
            } catch (err) { console.error("   ❌ DB query error:", err); }
        } else { console.log("   Skipping DB query due to embedding error."); }
        const systemPrompt = `
You are an AI healthcare assistant aiding a community health worker during a patient visit (Visit ID: ${visitId}).
Your goal is to help the health worker ask a relevant, simple question based on the conversation so far and provided context.
Use the context below ONLY IF it seems relevant to the latest user message. The context contains snippets from THIS patient visit's transcript.
If context is provided, prioritize it. If no context is relevant or available, use your general medical knowledge.
Always phrase questions in **simple, non-technical language** suitable for a patient.
Do NOT reveal that you used context.

Respond ONLY with a single question.
Context...
----------
START CONTEXT
${docContext || "No specific context retrieved for this query."}
END CONTEXT
----------`;
        const contents = [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "Understood. I will provide 3 patient-friendly questions..." }] },
            ...messages.map((msg) => ({
                role: msg.role === "user" ? "user" : "model",
                parts: [{ text: msg.content }],
            })),
        ];

        console.log("   🚀 Getting full response from Gemini...");
        const result = await model.generateContent({ contents });
        const englishResponse = result.response.text();
        console.log("   Received English response:", englishResponse.substring(0, 50) + "...");
        const translatedResponse = await translateText(englishResponse, targetLanguage);
        res.status(200).json({ content: translatedResponse });
    } catch (error) {
        console.error(`💥 Error in POST /chat [Visit ID: ${req.body?.visitId}]:`, error);
        if (!res.headersSent) { res.status(500).json({ error: "Internal Server Error" }); }
        else if (!res.writableEnded) { res.end(); }
    }
});


/**
 * Internal: Extract structured data from a conversation using Gemini.
 *
 * Produces a normalized JSON schema to support downstream analysis.
 * Throws on failure for the `/analyze` endpoint to handle fallback behavior.
 *
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages - Conversation history.
 * @param {string} visitId - Visit identifier for logging only.
 * @returns {Promise<{
 *   main_complaint?: string,
 *   all_symptoms?: Array<{ symptom: string, severity?: string, value?: string }>,
 *   duration_mentioned?: string,
 *   medications_mentioned?: string[],
 *   potential_conditions_mentioned?: string[]
 * }>} Extracted structured data.
 */
async function extractStructuredData(messages, visitId) {
    console.log(`   🤖 1. Extracting structured data for Visit ID: ${visitId}`);

    const conversationText = messages
        .map(msg => `${msg.role === 'user' ? 'Health Worker' : 'AI Assistant'}: ${msg.content}`)
        .join('\n');

    const extractorPrompt = `
You are a medical data extraction bot. Read the conversation and extract information into a valid JSON object.
Respond ONLY with the JSON object, nothing else. Do not use markdown backticks \`\`\`.

CONVERSATION:
"""
${conversationText}
"""

JSON STRUCTURE TO FILL:
{
  "main_complaint": "The primary symptom or complaint",
  "all_symptoms": [
    { "symptom": "name of symptom", "severity": "e.g., 'severe', 'sharp', 'dull'", "value": "e.g., 'yes', 'no', 'feverish'" }
  ],
  "duration_mentioned": "e.g., '2 days', 'a week'",
  "medications_mentioned": ["list of medications"],
  "potential_conditions_mentioned": ["list of potential diagnoses discussed"]
}
`;

    try {
        const contents = [{ role: "user", parts: [{ text: extractorPrompt }] }];
        const result = await model.generateContent({ contents });
        const jsonText = result.response.text().replace(/^```json\n?/, '').replace(/\n?```$/, '');
        const jsonData = JSON.parse(jsonText);
        console.log(`   ✅ 1. Data extracted successfully.`);
        return jsonData;
    } catch (error) {
        console.error("   ❌ Error during data extraction:", error);
        throw new Error("Failed to extract structured data from AI.");
    }
}


/**
 * Run an LLM-based classifier to decide if the VISIT ANALYSIS indicates a serious condition.
 * Uses the generated summary + structured data, NOT the raw chat logs.
 */
async function detectSeriousIssue(analysisText, structuredData, visitId) {
    console.log(`   ⚠️ Running seriousness classifier on Analysis for Visit ID: ${visitId}`);

    const prompt = `
You are a Senior Medical Officer.
Your Task: Review the **Clinical Summary** provided below and determine if a Medical Referral is strictly necessary.

INPUT DATA:
1. Clinical Summary:
"""${analysisText}"""

2. Structured Findings:
${structuredData ? JSON.stringify(structuredData) : "None"}

TRIAGE DECISION LOGIC:
- **HIGH SEVERITY (alert: true)**: 
  The summary indicates an immediate threat to life, limb, or vital organs. Requires emergency transport or immediate admission.
  (Keywords to look for: "Emergency", "Urgent Referral", "Chest Indrawing", "Unconscious", "Difficulty Breathing")
  
- **MEDIUM SEVERITY (alert: true)**: 
  The summary indicates a condition that requires a Doctor's diagnosis, prescription, or intervention within 24 hours. It cannot be managed by a community worker alone.
  (Keywords to look for: "High Fever", "Infection", "Dehydration", "Refer to doctor")

- **LOW SEVERITY (alert: false)**: 
  The summary describes routine care, preventative counseling, normal checkups, or minor ailments that are self-limiting or managed with home remedies.

OUTPUT INSTRUCTIONS:
- Determine the severity based **only** on the specific details in the summary.
- Return the JSON object below.
- **Crucial:** Set "alert": true ONLY for HIGH or MEDIUM. Set "alert": false for LOW.

JSON SCHEMA:
{
  "alert": boolean, 
  "severity": "high" | "medium" | "low",
  "label": "string (short clinical label)",
  "reason": "string (based on the analysis provided)",
  "recommendedAction": "string"
}
`;

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });

        const parsed = JSON.parse(result.response.text());

        // Sanity check
        if (typeof parsed.alert !== 'boolean') {
            throw new Error("Invalid JSON structure returned");
        }

        return parsed;

    } catch (err) {
        console.error("   ❌ Seriousness classifier error:", err.message);
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
 * POST /analyze
 * Generate a concise analysis for a visit in two steps:
 * 1) Structured extraction from conversation (Gemini) with robust JSON-only output intent.
 * 2) Analysis generation (Gemini) using the structured JSON, or fallback to raw text if extraction fails.
 * Translates the final analysis to `targetLanguage`.
 *
 * Request body:
 * - visitId: string (required)
 * - messages: Array<{ role: 'user'|'assistant', content: string }> (min length 2)
 * - targetLanguage: string (required) — BCP-47 code
 *
 * Response: 200
 * - { analysis: string, structuredData: object }
 */
app.post("/analyze", async (req, res) => {
    try {
        const { visitId, messages, targetLanguage } = req.body;
        if (!visitId) { return res.status(400).json({ error: "Missing visitId" }); }
        if (!messages || messages.length < 2) { return res.status(400).json({ error: "Insufficient chat history" }); }
        if (!targetLanguage) { return res.status(400).json({ error: "Missing targetLanguage" }); }

        console.log(`\n🔬 ANALYZING chat for Visit ID: ${visitId}...`);

        // 1. Extract Structured Data
        let structuredData;
        try {
            structuredData = await extractStructuredData(messages, visitId);
        } catch (extractionError) {
            console.warn(`   ⚠️ Could not extract structured data. Falling back to raw text analysis.`);
            structuredData = { error: "Extraction failed" };
        }

        // 2. Generate Analysis Text
        const analysisPrompt = structuredData.error ?
            `
You are an AI healthcare assistant. Analyze the following *raw* patient visit conversation (Visit ID: ${visitId}).
Provide a concise summary covering:
1.  **Main Symptoms/Concerns:** List the key health issues discussed.
2.  **Key Information Gathered:** Note any important details.
3.  **Potential Next Steps:** Suggest 1-2 simple actions.

Conversation History:
--------------------
${messages.map(msg => `${msg.role === 'user' ? 'Health Worker' : 'AI Assistant'}: ${msg.content}`).join('\n')}
--------------------
Analysis:`
            :
            `
You are an AI healthcare assistant. Analyze the following *structured summary* of a patient visit (Visit ID: ${visitId}).
Provide a concise, professional analysis in Markdown format, covering:
1.  **Main Symptoms/Concerns:** Based on the extracted data.
2.  **Key Information Gathered:** Note important details from the JSON.
3.  **Potential Next Steps:** Suggest 1-2 actions for the health worker.

STRUCTURED DATA:
\`\`\`json
${JSON.stringify(structuredData, null, 2)}
\`\`\`

Analysis:`;

        const contents = [{ role: "user", parts: [{ text: analysisPrompt }] }];
        const result = await model.generateContent({ contents });
        const analysisText = result.response.text(); // <--- THIS captures the text you shared

        // ============================================================
        // 3. NEW LOGIC: Detect Serious Issues using the ANALYSIS
        // ============================================================
        let generatedAlert = null;
        try {
            // UPDATED CALL: Passing analysisText AND structuredData
            const detectionResult = await detectSeriousIssue(analysisText, structuredData, visitId);

            // Only save if alert is TRUE (High/Medium)
            if (detectionResult && detectionResult.alert) {
                console.log(`   🚨 ALERT TRIGGERED: ${detectionResult.label} (${detectionResult.severity})`);

                const newAlert = new Alert({
                    visitId: visitId,
                    label: detectionResult.label,
                    severity: detectionResult.severity,
                    reason: detectionResult.reason,
                    recommendedAction: detectionResult.recommendedAction,
                    triggeringMessages: messages, // Save chat history for context
                    rawInference: detectionResult
                });

                await newAlert.save();
                generatedAlert = detectionResult;
            } else {
                console.log(`   ✅ Condition assessed as LOW severity/Routine. No alert saved.`);
            }
        } catch (alertError) {
            console.error("   ⚠️ Error processing seriousness alert:", alertError);
        }
        // ============================================================

        console.log(`✅ ANALYSIS COMPLETE for Visit ID: ${visitId}`);
        const translatedAnalysis = await translateText(analysisText, targetLanguage);

        res.status(200).json({
            analysis: translatedAnalysis,
            structuredData: structuredData,
            alert: generatedAlert
        });

    } catch (error) {
        console.error(`💥 Error in POST /analyze [Visit ID: ${req.body?.visitId}]:`, error);
        res.status(500).json({ error: "Failed to generate analysis." });
    }
});

/**
 * POST /save-chat
 * Upsert chat session by `visitId` including messages, analysis, and structured data.
 *
 * Request body:
 * - visitId: string (required)
 * - messages: Array<{ role: 'user'|'assistant', content: string }> (required)
 * - analysis?: string
 * - structuredData?: object
 *
 * Response: 200
 * - { message: "Chat saved successfully", chatId: string }
 */

app.post("/save-chat", async (req, res) => {
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
        console.error("💥 Error saving/updating chat:", error);
        res.status(500).json({ error: "Failed to save chat" });
    }
});

/**
 * GET /chat/visit/:visitId
 * Fetch latest chat data for a specific `visitId`.
 *
 * Response: 200
 * - { messages: Array<...>, analysis: string|null, structuredData: object|null }
 */
app.get("/chat/visit/:visitId", async (req, res) => {
    try {
        const visitId = req.params.visitId;
        console.log(`🔍 Fetching latest chat for Visit ID: ${visitId}`);

        const chat = await Chat.findOne({ visitId: visitId })
            .sort({ updatedAt: -1 })
            .select('messages analysis structuredData');

        if (!chat) {
            return res.status(200).json({ messages: [], analysis: null, structuredData: null });
        }
        res.json({
            messages: chat.messages,
            analysis: chat.analysis,
            structuredData: chat.structuredData
        });
    } catch (error) {
        console.error("💥 Error fetching chat by visitId:", error);
        if (error.name === 'CastError') { return res.status(400).json({ error: "Invalid Visit ID format" }); }
        res.status(500).json({ error: "Failed to fetch chat" });
    }
});


/**
 * GET /chat/:chatId
 * Fetch a specific chat by its MongoDB `_id`.
 */
app.get("/chat/:chatId", async (req, res) => {
    try {
        const chatId = req.params.chatId;
        console.log(`🔍 Fetching specific chat by DB ID: ${chatId}`);
        const chat = await Chat.findById(chatId);
        if (!chat) { return res.status(404).json({ error: "Chat not found" }); }
        res.json(chat);
    } catch (error) { console.error("💥 Error fetching chat by ID:", error); if (error.name === 'CastError') { return res.status(400).json({ error: "Invalid Chat ID format" }); } res.status(500).json({ error: "Failed to fetch chat" }); }
});

// Ensure you have imported your Chat model and configured your AI model
// const Chat = require('./models/Chat');
// const { GoogleGenerativeAI } = require("@google/generative-ai");
// ... model initialization ...


app.post("/follow-up/:visitId", async (req, res) => {
    try {
        const { visitId } = req.params;

        // 1. Fetch previous visit details
        const previousChat = await Chat.findOne({ visitId });

        if (!previousChat) {
            return res.status(404).json({
                success: false,
                message: "No previous visit found for this patient.",
            });
        }

        const { analysis, structuredData, messages } = previousChat;

        // 2. Construct the prompt
        // UPDATED: Instructions to act like a doctor reviewing past records
        let followUpPrompt = `
      You are a compassionate medical assistant following up with a patient.

      CONTEXT:
      - Patient's Last Visit Analysis: ${analysis || "No previous analysis."}
      - Structured Data: ${structuredData ? JSON.stringify(structuredData) : "None"}
      - Recent Chat History: ${messages && messages.length > 0 ? JSON.stringify(messages.slice(-3)) : "None"}

      TASK:
      Review the "Last Visit Analysis" as if you are a doctor checking a patient's chart before entering the room.
      Your goal is to ask a single, natural follow-up question to check on their specific condition.

      GUIDELINES:
      1. Identify the main symptom or diagnosis from the analysis (e.g., headache, fever, injury, stomach pain).
      2. Ask specifically about that issue to see if it has improved (e.g., "How is your headache feeling today?" or "Has the fever gone down since we last spoke?").
      3. Be warm, professional, and empathetic—like a doctor checking in on a patient's recovery.
      4. Do NOT use generic greetings like "Hello" or "Welcome back". Start directly with the question.

      OUTPUT:
      Only the question text.
    `;

        // 3. Generate the question
        const result = await model.generateContent(followUpPrompt);
        const response = await result.response;
        const botQuestion = response.text().trim();

        // 4. IMPORTANT: Save this new message to the Database
        // If we don't save this now, a page refresh will wipe this question out.
        const newMessage = {
            role: 'model', // or 'assistant' depending on your schema
            content: botQuestion,
            timestamp: new Date()
        };

        previousChat.messages.push(newMessage);
        await previousChat.save();

        // 5. Send response to Frontend
        res.json({
            success: true,
            followUpQuestion: botQuestion,
        });

    } catch (error) {
        console.error("FOLLOW UP ERROR:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});




// NEW endpoint to fetch alerts for a visit

app.get("/alerts/dashboard", async (req, res) => {
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
        console.error("💥 Error fetching alerts dashboard:", error);
        res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
});

const PORT = process.env.PORT || 8001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
