import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, MessageSquare, AlertCircle } from 'lucide-react';
import { sendChatMessage, getUserTokens } from '../services/firebase';
import { getAuth } from 'firebase/auth';
import { LocalStorageService } from '../services/localStorage';
import './Chats.css';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export function Chats() {
    const location = useLocation();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [tokensUsed, setTokensUsed] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const auth = getAuth();
    const user = auth.currentUser;

    const initialMessage = location.state?.initialMessage;
    const restoredChat = location.state?.restoredChat;

    // Load initial tokens info
    useEffect(() => {
        const loadTokens = async () => {
            try {
                const result = await getUserTokens();
                const data = result.data as any;
                setTokensUsed(data.tokensUsed || 0);
            } catch (err) {
                console.error("Failed to load tokens", err);
            }
        };
        loadTokens();
    }, []);

    const processedInitialMessage = useRef(false);

    // Handle initial message or restored chat
    useEffect(() => {
        if (restoredChat) {
            setMessages(restoredChat.messages);
            setCurrentChatId(restoredChat.id);
            // Clear location state
            window.history.replaceState({}, document.title);
        } else if (initialMessage && messages.length === 0 && !processedInitialMessage.current) {
            processedInitialMessage.current = true;
            handleSendMessage(initialMessage);
            window.history.replaceState({}, document.title);
        }
    }, [initialMessage, restoredChat]);

    // Auto-save logic
    useEffect(() => {
        if (messages.length > 0) {
            saveCurrentChat();
        }
    }, [messages]);

    const saveCurrentChat = () => {
        if (messages.length === 0) return;

        const chatId = currentChatId || Date.now().toString();
        if (!currentChatId) setCurrentChatId(chatId);

        // Simple title generation based on first message
        const title = messages[0]?.content.slice(0, 30) + (messages[0]?.content.length > 30 ? '...' : '') || 'New Conversation';

        LocalStorageService.saveItem({
            id: chatId,
            type: 'chat',
            createdAt: Date.now(),
            title,
            messages
        } as any);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSendMessage = async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);
        setError(null);

        try {
            // Prepare context for AI (last 10 messages)
            const contextMessages = messages.slice(-10).map(m => ({
                role: m.role,
                content: m.content
            }));

            contextMessages.push({ role: 'user', content: text });

            const result = await sendChatMessage({
                messages: contextMessages
            });

            const data = result.data as any;

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.message.content,
                timestamp: Date.now(),
            };

            setMessages(prev => [...prev, assistantMessage]);

            if (data.tokensUsed) {
                setTokensUsed(prev => prev + data.tokensUsed);
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error sending message. Check your connection or token limit.');

            // Add error system message
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Error: ${err.message || 'Failed to communicate with AI.'}`,
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(inputValue);
        }
    };

    return (
        <div className="chats-page">
            <header className="chat-header">
                <div className="chat-header-title">
                    Smart Chat
                </div>
                <div className="chat-token-info">
                    <span>Tokens Used: {tokensUsed.toLocaleString('en-US')}</span>
                    {error && <span style={{ color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={14} /> {error}</span>}
                </div>
            </header>

            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <MessageSquare size={32} />
                        </div>
                        <h3>Start a new conversation</h3>
                        <p>Explore the power of AI with Rovena</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`message ${msg.role}`}>
                            <div className="message-avatar">
                                {msg.role === 'user' ? (
                                    user?.photoURL ? (
                                        <img
                                            src={user.photoURL}
                                            alt="User photo"
                                            className="avatar-image"
                                        />
                                    ) : (
                                        (user?.displayName?.[0] || user?.email?.[0] || 'U').toUpperCase()
                                    )
                                ) : 'R'}
                            </div>
                            <div className="message-content">
                                {msg.content}
                                <div className="message-time">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))
                )}

                {isLoading && (
                    <div className="typing-indicator">
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
                <div className="chat-input-wrapper">
                    <textarea
                        className="chat-textarea"
                        placeholder="Type your message..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        className="chat-send-button"
                        onClick={() => handleSendMessage(inputValue)}
                        disabled={!inputValue.trim() || isLoading}
                    >
                        <Send size={18} />
                    </button>
                </div>
                <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Rovena can make mistakes. Consider verifying important information.
                </div>
            </div>
        </div>
    );
}

export default Chats;
