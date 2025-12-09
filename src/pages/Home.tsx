import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Zap,
    MessageSquare,
    MousePointerClick,
    Send,
    ListTodo,
    Plus,
    Check,
    Pencil,
    Trash2,
    TrendingUp,
} from 'lucide-react';
import './Home.css';

interface Todo {
    id: string;
    text: string;
    completed: boolean;
    createdAt: Date;
}

interface HomeProps {
    tokensUsed?: number;
    tokensLimit?: number;
    messagesLast30Days?: number;
    interactionsLast30Days?: number;
}

export function Home({
    tokensUsed = 0,
    tokensLimit = 10000,
    messagesLast30Days = 0,
    interactionsLast30Days = 0,
}: HomeProps) {
    const navigate = useNavigate();
    const [quickMessage, setQuickMessage] = useState('');
    const [todos, setTodos] = useState<Todo[]>(() => {
        const saved = localStorage.getItem('rovena-todos');
        return saved ? JSON.parse(saved) : [];
    });
    const [newTodo, setNewTodo] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    useEffect(() => {
        localStorage.setItem('rovena-todos', JSON.stringify(todos));
    }, [todos]);

    const tokensRemaining = tokensLimit - tokensUsed;
    const tokenPercentage = tokensLimit > 0 ? Math.round((tokensRemaining / tokensLimit) * 100) : 0;

    const handleQuickChat = (e: React.FormEvent) => {
        e.preventDefault();
        if (quickMessage.trim()) {
            // Navigate to chat with the message
            navigate('/chats', { state: { initialMessage: quickMessage } });
        }
    };

    const addTodo = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTodo.trim()) {
            setTodos([
                ...todos,
                {
                    id: crypto.randomUUID(),
                    text: newTodo,
                    completed: false,
                    createdAt: new Date(),
                },
            ]);
            setNewTodo('');
        }
    };

    const toggleTodo = (id: string) => {
        setTodos(
            todos.map((todo) =>
                todo.id === id ? { ...todo, completed: !todo.completed } : todo
            )
        );
    };

    const startEdit = (todo: Todo) => {
        setEditingId(todo.id);
        setEditText(todo.text);
    };

    const saveEdit = (id: string) => {
        if (editText.trim()) {
            setTodos(
                todos.map((todo) =>
                    todo.id === id ? { ...todo, text: editText } : todo
                )
            );
        }
        setEditingId(null);
        setEditText('');
    };

    const deleteTodo = (id: string) => {
        setTodos(todos.filter((todo) => todo.id !== id));
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(0) + 'K';
        }
        return num.toString();
    };

    const completedCount = todos.filter((t) => t.completed).length;

    return (
        <div className="home-page page-content">
            <header className="page-header">
                <h1 className="page-title">Dashboard</h1>
                <p className="page-subtitle">Bem-vindo de volta! Aqui está seu resumo.</p>
            </header>

            {/* Stats Grid */}
            <div className="stats-grid">
                {/* Token Card */}
                <div className="token-card">
                    <div className="token-header">
                        <div>
                            <p className="token-label">Tokens Restantes</p>
                            <p className="token-percentage">{tokenPercentage}%</p>
                        </div>
                        <div className="token-icon">
                            <Zap size={24} />
                        </div>
                    </div>
                    <div className="token-progress">
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${Math.max(0, Math.min(100, tokenPercentage))}%` }}
                            />
                        </div>
                        <div className="token-details">
                            <span>{formatNumber(tokensRemaining)} restantes</span>
                            <span>{formatNumber(tokensLimit)} total</span>
                        </div>
                    </div>
                </div>

                {/* Messages Stat */}
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon blue">
                            <MessageSquare size={20} />
                        </div>
                    </div>
                    <p className="stat-value">{messagesLast30Days}</p>
                    <p className="stat-label">Mensagens enviadas</p>
                    <div className="stat-trend up">
                        <TrendingUp size={14} />
                        <span>Últimos 30 dias</span>
                    </div>
                </div>

                {/* Interactions Stat */}
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon yellow">
                            <MousePointerClick size={20} />
                        </div>
                    </div>
                    <p className="stat-value">{interactionsLast30Days}</p>
                    <p className="stat-label">Interações totais</p>
                    <div className="stat-trend up">
                        <TrendingUp size={14} />
                        <span>Últimos 30 dias</span>
                    </div>
                </div>
            </div>

            {/* Quick Chat */}
            <section className="quick-chat">
                <div className="quick-chat-header">
                    <div className="quick-chat-icon">
                        <MessageSquare size={20} />
                    </div>
                    <div>
                        <h3 className="quick-chat-title">Chat Rápido</h3>
                        <p className="quick-chat-subtitle">Comece uma conversa agora mesmo</p>
                    </div>
                </div>
                <form className="quick-chat-form" onSubmit={handleQuickChat}>
                    <input
                        type="text"
                        className="quick-chat-input"
                        placeholder="Digite sua mensagem para iniciar um chat..."
                        value={quickMessage}
                        onChange={(e) => setQuickMessage(e.target.value)}
                    />
                    <button type="submit" className="quick-chat-submit">
                        <Send size={18} />
                        Enviar
                    </button>
                </form>
            </section>

            {/* Todos */}
            <section className="todos-section">
                <div className="todos-header">
                    <div className="todos-title">
                        <div className="todos-icon">
                            <ListTodo size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Tarefas</h3>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                Organize suas atividades
                            </p>
                        </div>
                    </div>
                    <span className="todos-count">
                        {completedCount}/{todos.length} concluídas
                    </span>
                </div>

                {todos.length === 0 ? (
                    <div className="empty-todos">
                        <ListTodo size={48} className="empty-todos-icon" />
                        <p>Nenhuma tarefa ainda. Adicione uma abaixo!</p>
                    </div>
                ) : (
                    <div className="todos-list">
                        {todos.map((todo) => (
                            <div key={todo.id} className="todo-item">
                                <div
                                    className={`todo-checkbox ${todo.completed ? 'checked' : ''}`}
                                    onClick={() => toggleTodo(todo.id)}
                                >
                                    {todo.completed && <Check size={14} color="#000" />}
                                </div>

                                {editingId === todo.id ? (
                                    <input
                                        type="text"
                                        className="todo-edit-input"
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        onBlur={() => saveEdit(todo.id)}
                                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(todo.id)}
                                        autoFocus
                                    />
                                ) : (
                                    <span
                                        className={`todo-text ${todo.completed ? 'completed' : ''}`}
                                    >
                                        {todo.text}
                                    </span>
                                )}

                                <div className="todo-actions">
                                    <button
                                        className="todo-action-btn"
                                        onClick={() => startEdit(todo)}
                                        title="Editar"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        className="todo-action-btn delete"
                                        onClick={() => deleteTodo(todo.id)}
                                        title="Excluir"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <form className="add-todo-form" onSubmit={addTodo}>
                    <input
                        type="text"
                        className="add-todo-input"
                        placeholder="Adicionar nova tarefa..."
                        value={newTodo}
                        onChange={(e) => setNewTodo(e.target.value)}
                    />
                    <button type="submit" className="add-todo-btn">
                        <Plus size={18} />
                        Adicionar
                    </button>
                </form>
            </section>
        </div>
    );
}

export default Home;
