/**
 * @file VisitPage.jsx
 * @description Unified chat interface with analysis, save, and text-to-speech.
 */

import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
/**
 * @file VisitPage.jsx
 * @description Unified chat interface per visit, with translation, streaming AI responses, and session analysis (text + structured).
 * @route /visit/:visitId
 * @dependencies react-router-dom(useParams, useNavigate), axios, react-markdown, apiClient (Axios)
 * @state
 *  - Chat: messages, input, isLoading (derived)
 *  - Visit: visit, loadingVisit
 *  - History: initialMessages, loadingHistory, lastAnalysis
 *  - Analysis: isAnalyzing
 *  - Speech: isListening, speechLang, recognitionRef
 * @api
 *  - Spring: GET /visits/{visitId}; POST /translate
 *  - Node: POST /chat (stream); GET /chat/visit/{visitId}; POST /analyze; POST /save-chat
 */

const NODE_BACKEND_URL = 'http://localhost:8001';

/**
 * @hook useChat
 * Manages chat state, translation, and NON-STREAMING AI interaction.
 */
const useChat = (visitId, initialMessages = [], speechLang) => {
    const [messages, setMessages] = useState(initialMessages);
/**
 * @component VisitPage
 * @description Main chat component for a given visitId. Loads visit and history, handles translation, sends chat to Node backend, displays streaming responses, and triggers/saves analysis.
 */
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
        const userMessage = { id: userMessageId, role: "user", content: input, isTranslating: true };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setTranslatingMessageId(userMessageId);
        let textToSend = input;
        try {
            const translateResponse = await apiClient.post('/translate', { text: input });
            textToSend = translateResponse.data;
            setMessages(prev => prev.map(msg =>
                msg.id === userMessageId ? { ...msg, isTranslating: false, content: textToSend } : msg
            ));
        } catch (translateError) {
            console.error("Translation error:", translateError);
            setMessages(prev => prev.filter(msg => msg.id !== userMessageId));
            setMessages(prev => [...prev, { id: Date.now(), role: "assistant", content: "Sorry, I couldn't translate that." }]);
            setTranslatingMessageId(null); return;
        } finally { setTranslatingMessageId(null); }
        setIsLoadingAI(true);
        await sendMessage(textToSend, { ...userMessage, isTranslating: false, content: textToSend });
    };

    const sendMessage = async (translatedText, userMessageObject) => {
        const assistantThinkingMessageId = Date.now() + 1;
        setMessages(prev => [...prev, { id: assistantThinkingMessageId, role: "assistant", content: "Assistant is thinking..." }]);

        try {
             const historyForAI = messages.filter(m => m.id !== assistantThinkingMessageId);
            
            const response = await axios.post(`${NODE_BACKEND_URL}/chat`, {
                visitId: visitId,
                messages: [...historyForAI, userMessageObject],
                targetLanguage: speechLang // <-- FIX: Pass selected language
            });

            setMessages(prev => prev.filter(msg => msg.id !== assistantThinkingMessageId));
            
            const assistantResponseMessage = {
                id: Date.now(),
                role: 'assistant',
                content: response.data.content // Get content from JSON
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
 * @description Main chat component with TTS.
 */
const VisitPage = () => {
    const { visitId } = useParams();
    const navigate = useNavigate();
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
        // Stop any currently speaking synthesis
        window.speechSynthesis.cancel();
        
        // Simple text cleanup (remove markdown for speech)
        const cleanText = textToSpeak.replace(/[*#]/g, '');

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = lang; // Set language (e.g., 'hi-IN', 'en-IN')
        
        // Find a matching voice (optional but recommended for non-English)
        const voices = window.speechSynthesis.getVoices();
        // Try exact lang match first, then fallback to base language
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
                        setInitialMessages([...loadedMessages, { id: 'analysis-loaded-' + Date.now(), role: 'assistant', content: loadedAnalysis, isAnalysis: true, isLastAnalysis: true }]);
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
    }, [visitId]); // Dependency array


    const saveChatSession = async (analysisToSave, structuredDataToSave) => {
        console.log("Saving chat session with structured data...");
        try {
            await axios.post(`${NODE_BACKEND_URL}/save-chat`, {
                visitId: visitId,
                messages: messages
                    .filter(m => !m.isAnalysis) // Don't save analysis as a message
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

    const handleEndSession = async () => {
        if (isLoading || isAnalyzing || messages.length < 2) return;
        setIsAnalyzing(true);
        setError('');
        console.log("Ending session and requesting analysis...");
        try {
            const analysisResponse = await axios.post(`${NODE_BACKEND_URL}/analyze`, {
                visitId: visitId,
                messages: messages.filter(m => !m.isAnalysis).map(({ role, content }) => ({ role, content })),
                targetLanguage: speechLang // <-- PASS selected language
            });

            const newAnalysisText = analysisResponse.data.analysis;
            const newStructuredData = analysisResponse.data.structuredData;
            console.log("Analysis Received (Translated):", newAnalysisText);

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
            console.error("Failed to get analysis:", err);
            setError("Could not generate session analysis.");
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
                    <button onClick={() => navigate('/home')} className="text-blue-400 hover:underline">← Back</button>
                    <div className="w-40 h-9 bg-gray-700 rounded-lg animate-pulse" />
                 </div>
                <div className="flex justify-between items-center">
                     <h1 className="text-2xl font-bold">Chat</h1>
                     <p className="text-gray-400 text-lg">Patient: <span className="h-6 w-32 bg-gray-700 rounded-md inline-block animate-pulse"></span></p>
                </div>
            </header>
            <div className="flex-1 flex items-center justify-center">
                 <Loading text="Loading Visit Data..." size="md" />
            </div>
        </div>
    );

    // --- JSX Rendering ---
    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            <header className="px-6 py-4 border-b border-gray-700 flex-shrink-0">
                 <div className="flex justify-between items-center mb-2">
                    <button onClick={() => navigate('/home')} className="text-blue-400 hover:underline">← Back</button>
                    <button
                        onClick={handleEndSession}
                        disabled={isLoading || isAnalyzing || messages.length < 2}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        {isAnalyzing ? (
                             <span className="inline-flex items-center gap-2"><Loading size="xs" inline color="white" />Analyzing...</span>
                        ) : 'End & Analyze'}
                    </button>
                 </div>
                <div className="flex justify-between items-center">
                     <h1 className="text-2xl font-bold">Chat</h1>
                     <p className="text-gray-400 text-lg">Patient: {visit?.patient?.fullName || 'N/A'}</p>
                </div>
            </header>

            <div className="flex-1 flex flex-col overflow-y-hidden">
               <section ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="flex items-start gap-3">
                        <div className="flex items-start gap-2">
                            <div className="p-3 rounded-2xl max-w-lg bg-gray-700 text-gray-200">
                                <p className="text-sm leading-relaxed">
                                    AI assistant. Use mic for selected language.
                                </p>
                            </div>
                            <button 
                                onClick={() => handleSpeak("AI assistant. Use mic for selected language.", speechLang)}
                                className="p-1 text-gray-500 hover:text-gray-300 transition-opacity flex-shrink-0"
                                title="Read aloud"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {messages.map((m) => (
                        (m.content && m.content !== "") || m.isTranslating ? (
                            <div key={m.id || Math.random()} className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className="flex items-start gap-2">
                                    <div className={`p-3 rounded-2xl max-w-lg ${
                                        m.role === 'user'
                                            ? 'bg-blue-500 text-white'
                                            : m.isAnalysis
                                            ? m.isLastAnalysis
                                                ? 'bg-gray-800 border border-yellow-500/30'
                                                : 'bg-gray-800 border border-green-500/30'
                                            : 'bg-gray-700 text-gray-200'
                                    }`}>
                                        {m.role === 'assistant' && m.content === 'Assistant is thinking...' ? (
                                            <span className="text-sm italic flex items-center gap-2">
                                                    <Loading size="xs" inline color="white" text="Thinking..." />
                                            </span>
                                        ) : m.isAnalysis ? (
                                            <div className="flex items-start gap-2">
                                                <div className="flex-1">
                                                    <h4 className={`font-semibold mb-2 ${m.isLastAnalysis ? 'text-yellow-400' : 'text-green-400'}`}>
                                                        {m.isLastAnalysis ? 'Last Session Analysis' : 'Current Session Analysis'}
                                                    </h4>
                                                    <div className="text-sm text-gray-200 prose prose-invert prose-sm">
                                                        <ReactMarkdown>{m.content}</ReactMarkdown>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleSpeak(m.content, speechLang)}
                                                    className="p-1 text-gray-500 hover:text-gray-300 transition-opacity flex-shrink-0 mt-1"
                                                    title="Read aloud"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                                {m.content}
                                                {m.role === 'user' && m.isTranslating && ( <span className="ml-2 inline-flex items-center space-x-1 opacity-70"> <span className="h-1 w-1 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span> <span className="h-1 w-1 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></span> <span className="h-1 w-1 bg-white rounded-full animate-bounce"></span> </span> )}
                                            </p>
                                        )}
                                    </div>
                                    
                                    {m.role === 'assistant' && !m.isAnalysis && m.content !== 'Assistant is thinking...' && (
                                        <button 
                                            onClick={() => handleSpeak(m.content, speechLang)}
                                            className="p-1 text-gray-500 hover:text-gray-300 transition-opacity flex-shrink-0"
                                            title="Read aloud"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : null
                    ))}
                </section>

                {error && <p className="px-6 text-red-400 text-sm">{error}</p>}

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
            </div>
        </div>
    );
};

export default VisitPage;