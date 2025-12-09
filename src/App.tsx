import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    updateProfile
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Home } from './pages/Home';
import { Chats } from './pages/Chats';
import { Images } from './pages/Images';
import { Canva } from './pages/Canva';
import { Archives } from './pages/Archives';
import { Charts } from './pages/Charts';
import { Presentations } from './pages/Presentations';
import { Settings } from './pages/Settings';
import './pages/Login.css';
import './index.css';

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyBpx4aERcLoaRLulbpKOqeH1yu3MtBmktk",
    authDomain: "rova-25703.firebaseapp.com",
    projectId: "rova-25703",
    storageBucket: "rova-25703.firebasestorage.app",
    messagingSenderId: "983868326972",
    appId: "1:983868326972:web:e8368ecc01d0231e02af39",
    measurementId: "G-JYDFCLYN0F"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ============ LOGIN PAGE ============
function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (!email || !password) throw new Error('Preencha todos os campos');
            if (!isLogin) {
                if (!name) throw new Error('Preencha seu nome');
                if (password !== confirmPassword) throw new Error('As senhas não coincidem');
                const result = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(result.user, { displayName: name });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err: any) {
            const msgs: Record<string, string> = {
                'auth/email-already-in-use': 'Este email já está em uso',
                'auth/invalid-credential': 'Credenciais inválidas',
                'auth/user-not-found': 'Usuário não encontrado',
            };
            setError(msgs[err.code] || err.message);
        }
        setLoading(false);
    };

    const handleGoogle = async () => {
        try { await signInWithPopup(auth, googleProvider); } catch { }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <div className="login-logo">R</div>
                    <h1 className="login-title">Rovena</h1>
                    <p className="login-subtitle">Central de interação IA x Humano</p>
                </div>
                <div className="login-card">
                    <div className="login-tabs">
                        <button className={`login-tab ${isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(true); setError(''); }}>Entrar</button>
                        <button className={`login-tab ${!isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(false); setError(''); }}>Criar Conta</button>
                    </div>
                    {error && <div className="login-alert error">{error}</div>}
                    <form className="login-form" onSubmit={handleSubmit}>
                        {!isLogin && <input type="text" className="form-input" placeholder="Nome completo" value={name} onChange={e => setName(e.target.value)} />}
                        <input type="email" className="form-input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                        <div className="password-input-wrapper">
                            <input
                                type={showPassword ? "text" : "password"}
                                className="form-input"
                                placeholder="Senha"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        {!isLogin && (
                            <div className="password-input-wrapper">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    className="form-input"
                                    placeholder="Confirmar Senha"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                                >
                                    {showConfirmPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        )}
                        <button type="submit" className="login-button" disabled={loading}>{loading ? 'Carregando...' : (isLogin ? 'Entrar' : 'Criar Conta')}</button>
                    </form>
                    <div className="login-divider">ou continue com</div>
                    <button className="google-button" onClick={handleGoogle}>
                        <svg className="google-icon" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                        Google
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============ MAIN APP ============
function App() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleLogout = () => signOut(auth);

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
            </div>
        )
    }

    const displayName = user?.displayName || user?.email?.split('@')[0] || 'Usuário';

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />

                <Route path="/*" element={
                    user ? (
                        <div className="app-container">
                            <Sidebar
                                userEmail={displayName}
                                userPlan="free"
                                onLogout={handleLogout}
                            />
                            <main className="main-content">
                                <Routes>
                                    <Route path="/" element={<Home tokensUsed={0} tokensLimit={10000} />} />
                                    <Route path="/chats" element={<Chats />} />
                                    <Route path="/images" element={<Images />} />
                                    <Route path="/canva" element={<Canva />} />
                                    <Route path="/archives" element={<Archives />} />
                                    <Route path="/charts" element={<Charts />} />
                                    <Route path="/presentations" element={<Presentations />} />
                                    <Route path="/settings" element={<Settings userEmail={user.email || ''} userPlan="free" onLogout={handleLogout} />} />
                                    <Route path="*" element={<Navigate to="/" />} />
                                </Routes>
                            </main>
                        </div>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
