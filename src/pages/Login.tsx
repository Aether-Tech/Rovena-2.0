import { useState } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import '../index.css';
import './Login.css';

interface LoginProps {
    onAuthSuccess: () => void;
}

export function Login({ onAuthSuccess }: LoginProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (!email || !password) {
                throw new Error('Preencha todos os campos');
            }

            if (!isLogin) {
                if (password !== confirmPassword) {
                    throw new Error('As senhas não coincidem');
                }
                if (password.length < 6) {
                    throw new Error('A senha deve ter pelo menos 6 caracteres');
                }
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }

            onAuthSuccess();
        } catch (err: any) {
            console.error('Auth error:', err);
            // Translate Firebase errors to Portuguese
            const errorMessages: Record<string, string> = {
                'auth/user-not-found': 'Usuário não encontrado',
                'auth/wrong-password': 'Senha incorreta',
                'auth/email-already-in-use': 'Este email já está em uso',
                'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres',
                'auth/invalid-email': 'Email inválido',
                'auth/invalid-credential': 'Credenciais inválidas',
                'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
            };
            setError(errorMessages[err.code] || err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        setError('');
        setLoading(true);

        try {
            await signInWithPopup(auth, googleProvider);
            onAuthSuccess();
        } catch (err: any) {
            console.error('Google auth error:', err);
            if (err.code !== 'auth/popup-closed-by-user') {
                setError('Erro ao fazer login com Google');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <header className="login-header">
                    <div className="login-logo">R</div>
                    <h1 className="login-title">Rovena</h1>
                    <p className="login-subtitle">
                        Central de interação IA x Humano
                    </p>
                </header>

                <div className="login-card">
                    <div className="login-tabs">
                        <button
                            className={`login-tab ${isLogin ? 'active' : ''}`}
                            onClick={() => {
                                setIsLogin(true);
                                setError('');
                            }}
                        >
                            Entrar
                        </button>
                        <button
                            className={`login-tab ${!isLogin ? 'active' : ''}`}
                            onClick={() => {
                                setIsLogin(false);
                                setError('');
                            }}
                        >
                            Criar Conta
                        </button>
                    </div>

                    {error && (
                        <div className="login-alert error">{error}</div>
                    )}

                    <form className="login-form" onSubmit={handleEmailAuth}>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Senha</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className="form-input password-input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {!isLogin && (
                            <div className="form-group">
                                <label className="form-label">Confirmar Senha</label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        className="form-input password-input"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle-btn"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        tabIndex={-1}
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="login-button"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="spinner" />
                            ) : isLogin ? (
                                <>
                                    <LogIn size={18} />
                                    Entrar
                                </>
                            ) : (
                                <>
                                    <UserPlus size={18} />
                                    Criar Conta
                                </>
                            )}
                        </button>
                    </form>

                    <div className="login-divider">ou continue com</div>

                    <button
                        className="google-button"
                        onClick={handleGoogleAuth}
                        disabled={loading}
                    >
                        <svg className="google-icon" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Google
                    </button>

                    <p className="login-footer">
                        Ao continuar, você concorda com nossos{' '}
                        <a href="#">Termos de Uso</a> e{' '}
                        <a href="#">Política de Privacidade</a>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Login;
