/**
 * @file VisitPage.jsx
 * @description Unified chat interface with role-based access control.
 * - User (Asha Karmi): Full access (Chat, Voice, Translate, End & Analyze).
 * - Admin: Read-only access (View history only).
 */

import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api';
import Loading from '../components/Loading';
import { useAuth } from '../context/AuthContext'; // --- ADDED: Import Auth Context ---

const NODE_BACKEND_URL = 'http://localhost:8001';

/**
 * @hook useChat
 * Manages chat state, translation, and non-streaming AI interaction.
 */
const useChat = (visitId, initialMessages = [], speechLang) => {
    const [messages, setMessages] = useState(initialMessages);
    const [input, setInput] = useState("");
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [translatingMessageId, setTranslatingMessageId] = useState(null);

    useEffect(() => {
        if (initialMessages.length > 0 && messages.length === 0) {
            setMessages(initialMessages);
        }
    }, [initialMessages, messages.length]);

    const handleInputChange = (e) => setInput(e.target.value);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoadingAI || translatingMessageId) return;

        const userMessageId = Date.now();
        const originalContent = input;

        const userMessage = {
            id: userMessageId,
            role: "user",
            content: originalContent,
            translatedContent: null,
            isTranslating: true
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setTranslatingMessageId(userMessageId);

        let translatedContent = originalContent;

        try {
            const translateResponse = await apiClient.post('/translate', { text: originalContent });
            translatedContent = translateResponse.data;
            setMessages(prev => prev.map(msg =>
                msg.id === userMessageId ? { ...msg, isTranslating: false, translatedContent: translatedContent } : msg
            ));
        } catch (translateError) {
            console.error("Translation error:", translateError);
            setMessages(prev => prev.filter(msg => msg.id !== userMessageId));
            setMessages(prev => [...prev, { id: Date.now(), role: "assistant", content: "Sorry, I couldn't translate that." }]);
            setTranslatingMessageId(null);
            return;
        } finally {
            setTranslatingMessageId(null);
        }

        setIsLoadingAI(true);
        await sendMessage({ ...userMessage, isTranslating: false, translatedContent: translatedContent });
    };

    const sendMessage = async (userMessageObject) => {
        const assistantThinkingMessageId = Date.now() + 1;
        setMessages(prev => [...prev, { id: assistantThinkingMessageId, role: "assistant", content: "Assistant is thinking..." }]);

        try {
            const historyForAI = messages
                .filter(m => m.id !== assistantThinkingMessageId)
                .map(msg => {
                    if (msg.role === 'user') {
                        return { role: 'user', content: msg.translatedContent || msg.content };
                    }
                    return { role: 'model', content: msg.content };
                });

            const finalPayload = [
                ...historyForAI,
                { role: 'user', content: userMessageObject.translatedContent }
            ];

            const response = await axios.post(`${NODE_BACKEND_URL}/chat`, {
                visitId: visitId,
                messages: finalPayload,
                targetLanguage: speechLang
            });

            setMessages(prev => prev.filter(msg => msg.id !== assistantThinkingMessageId));

            const assistantResponseMessage = {
                id: Date.now(),
                role: 'assistant',
                content: response.data.content
            };
            setMessages(prev => [...prev, assistantResponseMessage]);

        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => prev.filter(msg => msg.id !== assistantThinkingMessageId));
            setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: "Error processing chat request." }]);
        } finally {
            setIsLoadingAI(false);
        }
    };

    const isLoading = isLoadingAI || !!translatingMessageId;
    return { messages, setMessages, input, setInput, handleInputChange, handleSubmit, isLoading };
};


/**
 * @component VisitPage
 * @description Main chat component. Handles Admin vs User view.
 */
const VisitPage = () => {
    const { visitId } = useParams();
    const navigate = useNavigate();

    // --- ADDED: Get User Context for Role Check ---
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN'; // Check if current user is admin

    const [visit, setVisit] = useState(null);
    const [loadingVisit, setLoadingVisit] = useState(true);
    const [error, setError] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const [initialMessages, setInitialMessages] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [lastAnalysis, setLastAnalysis] = useState(null);

    const [speechLang, setSpeechLang] = useState('hi-IN');

    const { messages, setMessages, input, setInput, handleInputChange, handleSubmit, isLoading } = useChat(visitId, initialMessages, speechLang);

    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const scrollRef = useRef(null);

    const handleSpeak = (textToSpeak, lang) => {
        window.speechSynthesis.cancel();
        const cleanText = textToSpeak.replace(/[*#]/g, '').replace(/\n/g, ' . ');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = lang;

        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang === lang) || voices.find(v => v.lang.startsWith(lang.split('-')[0]));
        if (voice) {
            utterance.voice = voice;
        }
        window.speechSynthesis.speak(utterance);
    };

    useEffect(() => {
        let isMounted = true;
        const fetchChatHistory = async () => {
            if (!isMounted) return;
            setLoadingHistory(true);
            try {
                const response = await axios.get(`${NODE_BACKEND_URL}/chat/visit/${visitId}`);
                if (isMounted) {
                    const loadedMessages = response.data.messages || [];
                    const loadedAnalysis = response.data.analysis;
                    setLastAnalysis(loadedAnalysis);
                    if (loadedAnalysis) {
                        setInitialMessages([
                            ...loadedMessages,
                            {
                                id: 'analysis-loaded-' + Date.now(),
                                role: 'assistant',
                                content: loadedAnalysis,
                                isAnalysis: true,
                                isLastAnalysis: true
                            }
                        ]);
                    } else {
                        setInitialMessages(loadedMessages);
                    }
                }
            } catch (err) { console.error("Error fetching history:", err); setError("Could not load history."); }
            finally { if (isMounted) setLoadingHistory(false); }
        };

        const fetchVisitData = async () => {
            if (!isMounted) return;
            setLoadingVisit(true);
            try {
                const response = await apiClient.get(`/visits/${visitId}`);
                if (isMounted) setVisit(response.data);
            } catch (err) { console.error("Error fetching visit:", err); if (isMounted && !error) setError('Failed to load visit details.'); }
            finally { if (isMounted) setLoadingVisit(false); }
        };

        fetchVisitData();
        fetchChatHistory();
        return () => { isMounted = false; };
    }, [visitId]);

    const saveChatSession = async (analysisToSave, structuredDataToSave) => {
        try {
            await axios.post(`${NODE_BACKEND_URL}/save-chat`, {
                visitId: visitId,
                messages: messages
                    .filter(m => !m.isAnalysis)
                    .map(({ role, content }) => ({ role, content })),
                analysis: analysisToSave,
                structuredData: structuredDataToSave
            });
            console.log("Saved successfully.");
        } catch (err) {
            console.error("Save failed:", err);
            setError("Could not save chat session.");
        }
    };

    const handleEndSession = async () => {
        if (isLoading || isAnalyzing || messages.length < 2) return;
        setIsAnalyzing(true);
        setError('');
        try {
            const messagesForAnalysis = messages
                .filter(m => !m.isAnalysis)
                .map(m => ({
                    role: m.role,
                    content: (m.role === 'user' && m.translatedContent) ? m.translatedContent : m.content
                }));

            const analysisResponse = await axios.post(`${NODE_BACKEND_URL}/analyze`, {
                visitId: visitId,
                messages: messagesForAnalysis,
                targetLanguage: speechLang
            });

            const newAnalysisText = analysisResponse.data.analysis;
            const newStructuredData = analysisResponse.data.structuredData;

            const analysisMessage = {
                id: Date.now(),
                role: 'assistant',
                content: newAnalysisText,
                isAnalysis: true,
                isLastAnalysis: false
            };

            setMessages(prev => [...prev.filter(m => !m.isLastAnalysis), analysisMessage]);
            setLastAnalysis(newAnalysisText);
            await saveChatSession(newAnalysisText, newStructuredData);

        } catch (err) {
            console.error("Analysis failed:", err);
            setError("Could not generate analysis.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleListenToggle = () => {
        if (isListening) {
            if (recognitionRef.current) { recognitionRef.current.stop(); }
            setIsListening(false);
        } else {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) { setError("Speech recognition not supported."); return; }
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = speechLang;
            recognitionRef.current = recognition;
            recognition.onresult = (event) => {
                let fullInterimTranscript = '';
                let fullFinalTranscript = '';
                for (let i = 0; i < event.results.length; ++i) {
                    const transcriptPart = event.results[i][0].transcript;
                    if (event.results[i].isFinal) { fullFinalTranscript += transcriptPart + ' '; }
                    else { fullInterimTranscript = transcriptPart; }
                }
                setInput(fullFinalTranscript.trim() + (fullInterimTranscript ? ' ' + fullInterimTranscript : ''));
            };
            recognition.onerror = (event) => { setError(`Speech error: ${event.error}`); setIsListening(false); };
            recognition.onend = () => { setIsListening(false); };
            recognition.start();
            setIsListening(true);
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);


    if (loadingVisit || loadingHistory) return (
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            <header className="px-6 py-4 border-b border-gray-700 flex-shrink-0">
                <div className="flex justify-between items-center mb-2">
                    <button onClick={() => navigate(-1)} className="text-blue-400 hover:underline">← Back</button>
                    <div className="w-40 h-9 bg-gray-700 rounded-lg animate-pulse" />
                </div>
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Chat</h1>
                </div>
            </header>
            <div className="flex-1 flex items-center justify-center">
                <Loading text="Loading Visit Data..." size="md" />
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            {/* Header */}
            <header className="px-6 py-4 border-b border-gray-700 flex-shrink-0">
                <div className="flex justify-between items-center mb-2">
                    {/* --- MODIFIED: Back Button Logic --- */}
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-400 hover:underline"
                    >
                        {'← Back'}
                    </button>

                    {/* --- MODIFIED: Hide End & Analyze button for Admin --- */}
                    {!isAdmin && (
                        <button
                            onClick={handleEndSession}
                            disabled={isLoading || isAnalyzing || messages.length < 2
                            }
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
                        >
                            {
                                isAnalyzing ? (
                                    <span className="inline-flex items-center gap-2" > <Loading size="xs" inline color="white" />Analyzing...</span>
                                ) : 'End & Analyze'}
                        </button >
                    )}
                </div >
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Chat</h1>
                    <p className="text-gray-400 text-lg">Patient: {visit?.patient?.fullName || 'N/A'}</p>
                </div>
            </header >

            {/* Main Chat Area */}
            < div className="flex-1 flex flex-col overflow-y-hidden" >
                {/* Chat Messages Section */}
                < section ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6" >
                    {/* Initial Welcome Message */}
                    < div className="flex items-start gap-3" >
                        <div className="flex items-start gap-2 group">
                            <div className="p-3 rounded-2xl max-w-lg bg-gray-700 text-gray-200">
                                <p className="text-sm leading-relaxed pr-8">
                                    {isAdmin ? "Viewing chat history (Read-Only)." : "AI assistant. Use mic for selected language."}
                                </p>
                            </div>
                            {/* Speaker button is always useful, even for Admin review */}
                            <button
                                onClick={() => handleSpeak(isAdmin ? "Viewing chat history." : "AI assistant. Use mic for selected language.", speechLang)}
                                className="p-1 text-gray-500 hover:text-gray-300 transition-opacity opacity-0 group-hover:opacity-100 flex-shrink-0"
                                title="Read aloud"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zM4 9a1 1 0 011 1v.01A7.002 7.002 0 0011 17v1.99A9.002 9.002 0 012 10.01V10a1 1 0 011-1zM16 10a1 1 0 011-1v.01A9.002 9.002 0 019 18.99V17a7.002 7.002 0 006-6.99V10z" /></svg>
                            </button>
                        </div>
                    </div >

                    {/* Dynamic Messages */}
                    {
                        messages.map((m) => (
                            (m.content && m.content !== "") || m.isTranslating ? (
                                <div key={m.id || Math.random()} className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className="flex items-start gap-2 group">

                                        {/* Message Bubble */}
                                        <div className={`p-3 rounded-2xl max-w-lg relative ${m.role === 'user' ? 'bg-blue-500 text-white' : m.isAnalysis ? m.isLastAnalysis ? 'bg-gray-800 border border-yellow-500/30' : 'bg-gray-800 border border-green-500/30' : 'bg-gray-700 text-gray-200'
                                            }`}>
                                            {m.role === 'assistant' && m.content === 'Assistant is thinking...' ? (
                                                <span className="text-sm italic flex items-center gap-2">
                                                    <Loading size="xs" inline color="white" text="Thinking..." />
                                                </span>
                                            ) : m.isAnalysis ? (
                                                <div className="pr-8">
                                                    <h4 className={`font-semibold mb-2 ${m.isLastAnalysis ? 'text-yellow-400' : 'text-green-400'}`}>
                                                        {m.isLastAnalysis ? 'Last Session Analysis' : 'Current Session Analysis'}
                                                    </h4>
                                                    <div className="text-sm text-gray-200 prose prose-invert prose-sm">
                                                        <ReactMarkdown>{m.content}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap pr-8">
                                                    {m.content}
                                                    {m.role === 'user' && m.isTranslating && (<span className="ml-2 inline-flex items-center space-x-1 opacity-70"> <span className="h-1 w-1 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span> <span className="h-1 w-1 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></span> <span className="h-1 w-1 bg-white rounded-full animate-bounce"></span> </span>)}
                                                </p>
                                            )}

                                            {/* Speaker Button - Positioned Top Right inside Bubble */}
                                            {m.role === 'assistant' && !m.isAnalysis && m.content !== 'Assistant is thinking...' && (
                                                <button
                                                    onClick={() => handleSpeak(m.content, speechLang)}
                                                    className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Read aloud"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zM4 9a1 1 0 011 1v.01A7.002 7.002 0 0011 17v1.99A9.002 9.002 0 012 10.01V10a1 1 0 011-1zM16 10a1 1 0 011-1v.01A9.002 9.002 0 019 18.99V17a7.002 7.002 0 006-6.99V10z" /></svg>
                                                </button>
                                            )}
                                            {/* Also enable for analysis blocks */}
                                            {m.isAnalysis && (
                                                <button
                                                    onClick={() => handleSpeak(m.content, speechLang)}
                                                    className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Read aloud"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zM4 9a1 1 0 011 1v.01A7.002 7.002 0 0011 17v1.99A9.002 9.002 0 012 10.01V10a1 1 0 011-1zM16 10a1 1 0 011-1v.01A9.002 9.002 0 019 18.99V17a7.002 7.002 0 006-6.99V10z" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : null
                        ))
                    }
                </section >

                {error && <p className="px-6 text-red-400 text-sm">{error}</p>}

                {/* --- MODIFIED: Hide Footer entirely for Admin --- */}
                {
                    !isAdmin && (
                        <footer className="px-6 py-4 border-t border-gray-700 flex-shrink-0">
                            <form onSubmit={handleSubmit} className="flex items-center gap-3">
                                <select
                                    value={speechLang}
                                    onChange={(e) => setSpeechLang(e.target.value)}
                                    className="h-10 px-2 bg-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    aria-label="Select speech language"
                                    disabled={isLoading || isListening || isAnalyzing}
                                >
                                    <option value="hi-IN">Hindi</option>
                                    <option value="bn-IN">Bengali</option>
                                    <option value="ta-IN">Tamil</option>
                                    <option value="te-IN">Telugu</option>
                                    <option value="mr-IN">Marathi</option>
                                    <option value="gu-IN">Gujarati</option>
                                    <option value="en-IN">English</option>
                                    <option value="as-IN">Assamese</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={handleListenToggle}
                                    disabled={isLoading || isAnalyzing}
                                    className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v2a3 3 0 01-3 3z"></path></svg>
                                </button>
                                <input
                                    type="text"
                                    value={input}
                                    onChange={handleInputChange}
                                    placeholder={isListening ? "Listening..." : "Ask a question..."}
                                    className="flex-1 px-4 py-3 bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isLoading || isAnalyzing}
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading || !input.trim() || isAnalyzing}
                                    className="w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-xl flex items-center justify-center disabled:bg-gray-500 disabled:cursor-not-allowed"
                                >
                                    ➤
                                </button>
                            </form>
                        </footer>
                    )
                }
            </div >
        </div >
    );
};

export default VisitPage;