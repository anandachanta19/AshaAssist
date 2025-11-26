/**
 * @file VisitPage.jsx
 * @description Unified chat interface.
 * Features:
 * 1. Role-Based Access: Admin (Read-Only) vs Asha Karmi (Full Access).
 * 2. Continue Chat Flow: existing chats require a "Continue" action to resume context.
 * 3. RESTORED: Text-to-Speech logic reverted to the simple version that works best.
 * 4. Voice Input: Uses 'textBeforeListening' to append text instead of overwriting.
 */

import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api';
import Loading from '../components/Loading';
import { useAuth } from '../context/AuthContext';

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
        // Sync messages when initialMessages load
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

        let translatedContent;

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
        const updatedUserMessage = { ...userMessage, isTranslating: false, translatedContent: translatedContent };
        await sendMessage(updatedUserMessage);
    };

    const sendMessage = async (userMessageObject) => {
        const assistantThinkingMessageId = Date.now() + 1;
        setMessages(prev => [...prev, { id: assistantThinkingMessageId, role: "assistant", content: "Assistant is thinking..." }]);

        try {
            const historyForAI = [
                ...messages.filter(m => m.id !== assistantThinkingMessageId).map(msg => {
                    if (msg.role === 'user') {
                        return { role: 'user', content: msg.translatedContent || msg.content };
                    }
                    return { role: 'model', content: msg.content };
                }),
                { role: 'user', content: userMessageObject.translatedContent }
            ];

            const response = await axios.post(`${NODE_BACKEND_URL}/chat`, {
                visitId: visitId,
                messages: historyForAI,
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
 * @description Main fused component.
 */
const VisitPage = () => {
    const { visitId } = useParams();
    const navigate = useNavigate();

    // --- Auth Context & Role Check ---
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';

    // --- State ---
    const [visit, setVisit] = useState(null);
    const [loadingVisit, setLoadingVisit] = useState(true);
    const [error, setError] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [initialMessages, setInitialMessages] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [lastAnalysis, setLastAnalysis] = useState(null);
    const [alert, setAlert] = useState(null);
    const [structuredData, setStructuredData] = useState(null);
    const [speechLang, setSpeechLang] = useState('hi-IN');

    // --- State: "Continue Chat" Logic (User Only) ---
    const [isChatInputActive, setIsChatInputActive] = useState(true);
    const [isContinuing, setIsContinuing] = useState(false);

    const { messages, setMessages, input, setInput, handleInputChange, handleSubmit, isLoading } = useChat(visitId, initialMessages, speechLang);

    // --- Voice Input Refs ---
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const textBeforeListening = useRef(""); // Keep this fix for Voice Input
    const scrollRef = useRef(null);

    // --- Text-to-Speech (Fixed for all languages with debugging) ---
    const handleSpeak = (textToSpeak, lang) => {
        window.speechSynthesis.cancel();

        // Wait for voices to load if they haven't already
        const speakWithVoice = () => {
            const cleanText = textToSpeak.replace(/[*#]/g, '').replace(/\n/g, ' . ');
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = lang;

            const voices = window.speechSynthesis.getVoices();

            // Debug: Log available voices for the language
            console.log(`Requested language: ${lang}`);
            console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));

            // Try to find exact match first, then language prefix match
            let voice = voices.find(v => v.lang === lang) ||
                voices.find(v => v.lang.startsWith(lang.split('-')[0])) ||
                voices.find(v => v.lang.toLowerCase().includes(lang.split('-')[0].toLowerCase()));

            // If no voice found, try without region code (e.g., 'te' instead of 'te-IN')
            if (!voice) {
                const langCode = lang.split('-')[0];
                voice = voices.find(v => v.lang.startsWith(langCode));
            }

            // Last resort: use default voice but keep the language setting
            if (!voice) {
                console.warn(`No voice found for ${lang}, using default voice`);
                voice = voices[0]; // Use first available voice
            }

            if (voice) {
                utterance.voice = voice;
                console.log(`Using voice: ${voice.name} (${voice.lang})`);
            }

            // Set rate and pitch for better clarity
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // Error handling
            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
                setError(`Speech error: ${event.error}`);
            };

            utterance.onend = () => {
                console.log('Speech finished');
            };

            window.speechSynthesis.speak(utterance);
        };

        // Check if voices are loaded
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            speakWithVoice();
        } else {
            // Wait for voices to load
            window.speechSynthesis.onvoiceschanged = () => {
                speakWithVoice();
            };
            // Fallback timeout in case onvoiceschanged doesn't fire
            setTimeout(() => {
                if (window.speechSynthesis.getVoices().length > 0) {
                    speakWithVoice();
                }
            }, 100);
        }
    };

    // --- Fetch Data ---
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
                    setAlert(response.data.alert);
                    setStructuredData(response.data.structuredData);

                    // --- Logic: Lock Input if history exists AND not Admin ---
                    if ((loadedMessages.length > 0 || loadedAnalysis) && !isAdmin) {
                        setIsChatInputActive(false);
                    } else {
                        setIsChatInputActive(true);
                    }

                    if (loadedAnalysis) {
                        setInitialMessages([...loadedMessages, { id: 'analysis-loaded-' + Date.now(), role: 'assistant', content: loadedAnalysis, isAnalysis: true, isLastAnalysis: true }]);
                    } else if (loadedMessages.length === 0) {
                        // Inject initial greeting if no history exists
                        setInitialMessages([{
                            id: 'greeting-' + Date.now(),
                            role: 'assistant',
                            content: "Hello! How is your health condition today?"
                        }]);
                    } else { setInitialMessages(loadedMessages); }
                }
            } catch (err) { console.error("Error fetching chat history:", err); setError("Could not load previous chat history."); }
            finally { if (isMounted) setLoadingHistory(false); }
        };

        const fetchVisitData = async () => {
            if (!isMounted) return;
            setLoadingVisit(true);
            try {
                const response = await apiClient.get(`/visits/${visitId}`);
                if (isMounted) setVisit(response.data);
            } catch (err) { console.error("Error fetching visit for header:", err); if (isMounted && !error) setError('Failed to load visit details.'); }
            finally { if (isMounted) setLoadingVisit(false); }
        };

        fetchVisitData();
        fetchChatHistory();
        return () => { isMounted = false; };
    }, [visitId, isAdmin]);

    // --- Save Chat ---
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
            console.log("Chat session saved successfully.");
        } catch (err) {
            console.error("Failed to save chat:", err);
            setError("Could not save chat session.");
        }
    };

    // --- End Session (User Only) ---
    const handleEndSession = async () => {
        if (isLoading || isAnalyzing || messages.length < 2) return;
        setIsAnalyzing(true);
        setError('');
        try {
            const messagesForAnalysis = messages
                .filter(m => !m.isAnalysis)
                .map(m => ({
                    role: m.role,
                    content: (m.role === 'user' ? m.translatedContent : m.content) || m.content
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
            setAlert(analysisResponse.data.alert);
            setStructuredData(newStructuredData);
            await saveChatSession(newAnalysisText, newStructuredData);

        } catch (err) {
            console.error("Failed to get analysis:", err);
            setError("Could not generate session analysis.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // --- Continue Chat (User Only) ---
    const handleContinueChat = async () => {
        if (isAdmin) return;
        setIsContinuing(true);
        try {
            const response = await axios.post(`${NODE_BACKEND_URL}/follow-up/${visitId}`);
            if (response.data && response.data.success && response.data.followUpQuestion) {
                const followUpMessage = {
                    id: Date.now(),
                    role: 'assistant',
                    content: response.data.followUpQuestion
                };
                setMessages(prev => [...prev, followUpMessage]);
            }
            setIsChatInputActive(true);
        } catch (err) {
            console.error("Error resuming chat:", err);
            setIsChatInputActive(true);
            setError("Failed to load follow-up question, but you can continue chatting.");
        } finally {
            setIsContinuing(false);
        }
    };

    // --- Speech Recognition (Keep overwrite fix) ---
    const handleListenToggle = () => {
        if (isListening) {
            if (recognitionRef.current) { recognitionRef.current.stop(); }
            setIsListening(false);
        } else {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) { setError("Speech recognition not supported."); return; }

            // Store whatever text is currently in the input before we start listening
            textBeforeListening.current = input;

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
                    if (event.results[i].isFinal) {
                        fullFinalTranscript += transcriptPart + ' ';
                    } else {
                        fullInterimTranscript += transcriptPart;
                    }
                }

                const newTranscript = fullFinalTranscript + fullInterimTranscript;

                // Combine old text + new text
                const spacer = (textBeforeListening.current && newTranscript) ? ' ' : '';
                setInput(textBeforeListening.current + spacer + newTranscript);
            };

            recognition.onerror = (event) => {
                if (event.error !== 'no-speech') {
                    setError(`Speech error: ${event.error}`);
                    setIsListening(false);
                }
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.start();
            setIsListening(true);
        }
    };

    // --- Auto-scroll ---
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);


    if (loadingVisit || loadingHistory) return (
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            <div className="flex-1 flex items-center justify-center">
                <Loading size="lg" color="white" text="Loading chat..." />
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            {/* Header */}
            <header className="px-6 py-4 border-b border-gray-700 flex-shrink-0">
                <div className="flex justify-between items-center mb-2">
                    <button onClick={() => navigate(-1)} className="text-blue-400 hover:underline">← Back</button>
                    {!isAdmin && (
                        <button onClick={handleEndSession} disabled={isLoading || isAnalyzing || messages.length < 2} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed">
                            {isAnalyzing ? (
                                <span className="inline-flex items-center gap-2"><Loading size="xs" inline color="white" />Analyzing...</span>
                            ) : 'End & Analyze'}
                        </button>
                    )}
                    {isAdmin && <div className="px-3 py-1 bg-gray-700 rounded text-sm text-gray-300">Read Only Mode</div>}
                </div>
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Chat</h1>
                    <p className="text-gray-400 text-lg">Patient: {visit?.patient?.fullName || 'N/A'}</p>
                </div>
            </header>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col overflow-y-hidden">
                <section ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Welcome Message Removed */}

                    {/* Messages */}
                    {messages.map((m) => (
                        (m.content && m.content !== "") || m.isTranslating ? (
                            <div key={m.id || Math.random()} className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className="flex items-start gap-2 group">
                                    {/* Bubble Style */}
                                    <div className={`p-3 rounded-2xl max-w-lg relative ${m.role === 'user' ? 'bg-blue-500 text-white' : m.isAnalysis ? m.isLastAnalysis ? 'bg-gray-800 border border-yellow-500/30' : 'bg-gray-800 border border-green-500/30' : 'bg-gray-700 text-gray-200'}`}>

                                        {m.role === 'assistant' && m.content === 'Assistant is thinking...' ? (
                                            <span className="text-sm italic flex items-center gap-2">
                                                <Loading size="xs" inline color="white" text="Thinking..." />
                                            </span>
                                        ) : m.isAnalysis ? (
                                            <div className="w-full space-y-4">
                                                {/* Header & Severity */}
                                                <div className="flex items-center justify-between border-b border-gray-600 pb-3 mb-2">
                                                    <h4 className={`font-bold text-lg flex items-center gap-2 ${m.isLastAnalysis ? 'text-yellow-400' : 'text-green-400'}`}>
                                                        {m.isLastAnalysis ? 'Last Session Analysis' : 'Current Session Analysis'}
                                                    </h4>
                                                    {alert && m.isLastAnalysis && (
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${alert.severity === 'high' ? 'bg-red-900/50 border-red-500 text-red-200 animate-pulse' : alert.severity === 'medium' ? 'bg-orange-900/50 border-orange-500 text-orange-200' : 'bg-green-900/50 border-green-500 text-green-200'}`}>
                                                            {alert.severity} Severity
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Alert Details (if high/medium) */}
                                                {alert && m.isLastAnalysis && (alert.severity === 'high' || alert.severity === 'medium') && (
                                                    <div className={`p-4 rounded-xl border ${alert.severity === 'high' ? 'bg-red-900/20 border-red-500/50' : 'bg-orange-900/20 border-orange-500/50'}`}>
                                                        <p className="font-semibold text-sm text-white mb-1">{alert.label}</p>
                                                        <p className="text-xs text-gray-300 mb-2">{alert.reason}</p>
                                                        {alert.recommendedAction && (
                                                            <div className="flex items-start gap-2 mt-2 pt-2 border-t border-white/10">
                                                                <span className="text-lg">👉</span>
                                                                <span className="text-sm font-medium text-white">{alert.recommendedAction}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Structured Data Grid */}
                                                {structuredData && m.isLastAnalysis && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {structuredData.main_complaint && (
                                                            <div className="bg-gray-900/40 p-3 rounded-lg border border-gray-700/50">
                                                                <span className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Main Complaint</span>
                                                                <span className="text-sm font-medium text-white">{structuredData.main_complaint}</span>
                                                            </div>
                                                        )}
                                                        {structuredData.duration_mentioned && (
                                                            <div className="bg-gray-900/40 p-3 rounded-lg border border-gray-700/50">
                                                                <span className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Duration</span>
                                                                <span className="text-sm text-gray-300">{structuredData.duration_mentioned}</span>
                                                            </div>
                                                        )}
                                                        {structuredData.all_symptoms && structuredData.all_symptoms.length > 0 && (
                                                            <div className="col-span-1 md:col-span-2 bg-gray-900/40 p-3 rounded-lg border border-gray-700/50">
                                                                <span className="text-[10px] uppercase tracking-wider text-gray-400 block mb-2">Symptoms</span>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {structuredData.all_symptoms.map((sym, idx) => (
                                                                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-200">
                                                                            {sym.symptom}
                                                                            {sym.severity && <span className="text-blue-400/70 text-[10px]">({sym.severity})</span>}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {structuredData.medications_mentioned && structuredData.medications_mentioned.length > 0 && (
                                                            <div className="col-span-1 md:col-span-2 bg-gray-900/40 p-3 rounded-lg border border-gray-700/50">
                                                                <span className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">Medications</span>
                                                                <span className="text-sm text-gray-300">{structuredData.medications_mentioned.join(', ')}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Markdown Analysis */}
                                                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 text-sm text-gray-200 prose prose-invert prose-sm max-w-none shadow-inner">
                                                    <ReactMarkdown>{m.content}</ReactMarkdown>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap pr-8">
                                                {m.content}
                                                {m.isTranslating && (<span className="ml-2 inline-flex items-center space-x-1 opacity-70"> <span className="h-1 w-1 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span> <span className="h-1 w-1 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></span> <span className="h-1 w-1 bg-white rounded-full animate-bounce"></span> </span>)}
                                            </p>
                                        )}

                                        {/* Speaker Button on individual messages */}
                                        {m.content !== 'Assistant is thinking...' && (
                                            <button
                                                onClick={() => handleSpeak(m.content, speechLang)}
                                                className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Read aloud"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : null
                    ))}
                </section>

                {error && <p className="px-6 text-red-400 text-sm">{error}</p>}

                {!isAdmin && (
                    <footer className="px-6 py-4 border-t border-gray-700 flex-shrink-0">
                        {!isChatInputActive ? (
                            <div className="flex items-center justify-center w-full">
                                <button
                                    onClick={handleContinueChat}
                                    disabled={isContinuing}
                                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg transition-transform transform active:scale-95 flex items-center gap-2 disabled:bg-blue-800 disabled:cursor-wait"
                                >
                                    {isContinuing ? (
                                        <> <Loading size="xs" inline color="white" /> Resuming... </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Continue Previous Chat
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="flex items-center gap-3">
                                <select
                                    value={speechLang}
                                    onChange={(e) => setSpeechLang(e.target.value)}
                                    className="h-10 px-2 bg-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        )}
                    </footer>
                )}
            </div>
        </div>
    );
};

export default VisitPage;