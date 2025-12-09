import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  User,
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Home } from './pages/Home';
import { Chats } from './pages/Chats';
import { Images } from './pages/Images';
import { Archives } from './pages/Archives';
import { Charts } from './pages/Charts';
import { Presentations } from './pages/Presentations';
import { Settings } from './pages/Settings';
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

// ============ LOGIN COMPONENT ============
function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
      onLogin();
    } catch (err: any) {
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

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onLogin();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Erro ao fazer login com Google');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      padding: 24,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, #22c55e 0%, #facc15 100%)',
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '2rem', color: '#000', margin: '0 auto 16px',
          }}>R</div>
          <h1 style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 700, marginBottom: 4 }}>Rovena</h1>
          <p style={{ color: '#a1a1aa', fontSize: '0.9375rem' }}>Central de interação IA x Humano</p>
        </div>

        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', background: '#27272a', borderRadius: 8, padding: 4, marginBottom: 24 }}>
            <button onClick={() => { setIsLogin(true); setError(''); }}
              style={{ flex: 1, padding: '8px 16px', background: isLogin ? '#18181b' : 'transparent', border: 'none', borderRadius: 6, color: isLogin ? '#fff' : '#a1a1aa', fontSize: '0.9375rem', fontWeight: 500, cursor: 'pointer' }}>
              Entrar
            </button>
            <button onClick={() => { setIsLogin(false); setError(''); }}
              style={{ flex: 1, padding: '8px 16px', background: !isLogin ? '#18181b' : 'transparent', border: 'none', borderRadius: 6, color: !isLogin ? '#fff' : '#a1a1aa', fontSize: '0.9375rem', fontWeight: 500, cursor: 'pointer' }}>
              Criar Conta
            </button>
          </div>

          {error && <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, color: '#ef4444', fontSize: '0.875rem', marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: 6 }}>Email</label>
              <input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading}
                style={{ width: '100%', padding: 12, background: '#27272a', border: '1px solid #3f3f46', borderRadius: 8, color: '#fff', fontSize: '0.9375rem', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: 6 }}>Senha</label>
              <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading}
                style={{ width: '100%', padding: 12, background: '#27272a', border: '1px solid #3f3f46', borderRadius: 8, color: '#fff', fontSize: '0.9375rem', boxSizing: 'border-box' }} />
            </div>
            {!isLogin && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: 6 }}>Confirmar Senha</label>
                <input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading}
                  style={{ width: '100%', padding: 12, background: '#27272a', border: '1px solid #3f3f46', borderRadius: 8, color: '#fff', fontSize: '0.9375rem', boxSizing: 'border-box' }} />
              </div>
            )}
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', border: 'none', borderRadius: 8, color: '#000', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 8 }}>
              {loading ? 'Carregando...' : (isLogin ? 'Entrar' : 'Criar Conta')}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0', color: '#52525b', fontSize: '0.8125rem' }}>
            <div style={{ flex: 1, height: 1, background: '#3f3f46' }} />ou continue com<div style={{ flex: 1, height: 1, background: '#3f3f46' }} />
          </div>

          <button onClick={handleGoogle} disabled={loading}
            style={{ width: '100%', padding: 12, background: '#27272a', border: '1px solid #3f3f46', borderRadius: 8, color: '#fff', fontSize: '0.9375rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ DASHBOARD COMPONENT ============
function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [currentPage, setCurrentPage] = useState('home');

  const renderPage = () => {
    switch (currentPage) {
      case 'chats': return <Chats />;
      case 'images': return <Images />;
      case 'archives': return <Archives />;
      case 'charts': return <Charts />;
      case 'presentations': return <Presentations />;
      case 'settings': return <Settings userEmail={user.email || ''} userPlan="free" onLogout={onLogout} />;
      default: return <Home />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        userEmail={user.email || ''}
        userPlan="free"
        onLogout={onLogout}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
      />
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

// ============ MAIN APP ============
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  // Show loading while checking auth
  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #27272a', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Show login or dashboard
  if (!user) {
    return <LoginPage onLogin={() => { }} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

export default App;
