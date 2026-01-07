import { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signOut,
    onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
    checkSubscription,
    getUserTokens
} from './services/firebase';
import { Modal } from './components/Modal/Modal';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Onboarding } from './components/Onboarding/Onboarding';
// Lazy load pages for performance optimization
const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Chats = lazy(() => import('./pages/Chats').then(module => ({ default: module.Chats })));
const Images = lazy(() => import('./pages/Images').then(module => ({ default: module.Images })));
const Canva = lazy(() => import('./pages/Canva').then(module => ({ default: module.Canva })));
const Archives = lazy(() => import('./pages/Archives').then(module => ({ default: module.Archives })));
const Charts = lazy(() => import('./pages/Charts').then(module => ({ default: module.Charts })));
const Presentations = lazy(() => import('./pages/Presentations').then(module => ({ default: module.Presentations })));

const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const Profile = lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile })));
const Notes = lazy(() => import('./pages/Notes').then(module => ({ default: module.Notes })));
import { Login } from './pages/Login';
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

// ============ MAIN APP ============
function App() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [userPlan, setUserPlan] = useState<'free' | 'plus'>('free');
    const [tokensUsed, setTokensUsed] = useState(0);
    const [tokensLimit, setTokensLimit] = useState(10000);
    const [subscriptionId, setSubscriptionId] = useState<string | undefined>(undefined);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [profileUpdateKey, setProfileUpdateKey] = useState(0);
    const [showOnboarding, setShowOnboarding] = useState(false);

    const fetchUserData = async () => {
        if (!user) return;
        try {
            // Fetch Subscription Status
            const subResult: any = await checkSubscription();
            if (subResult.data) {
                setUserPlan(subResult.data.plan);
                setTokensLimit(subResult.data.tokensLimit);
                setSubscriptionId(subResult.data.subscriptionId);

            }

            // Fetch Token Usage
            const tokenResult: any = await getUserTokens();
            if (tokenResult.data) {
                setTokensUsed(tokenResult.data.tokensUsed || 0);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    };

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (u) {
                fetchUserData();
                const onboardingKey = `rovena-onboarding-completed-${u.uid}`;
                const hasCompletedOnboarding = localStorage.getItem(onboardingKey);
                if (!hasCompletedOnboarding) {
                    setShowOnboarding(true);
                }
            } else {
                setLoading(false);
            }
        });

        if ((window as any).electronAPI) {
            (window as any).electronAPI.onUpdateStatus((status: any) => {
                if (status && status.text === 'Update downloaded') {
                    setShowUpdateModal(true);
                    // On macOS, automatically open the DMG for manual install
                    (window as any).electronAPI.getPlatform().then((plat: string) => {
                        if (plat === 'darwin') {
                            (window as any).electronAPI.openManualUpdate();
                        }
                    });
                }
            });
        }

        return () => unsub();
    }, []);

    // Also fetch data when user is already set (e.g. after refresh)
    useEffect(() => {
        if (user) {
            fetchUserData().finally(() => setLoading(false));

            // Auto-refresh when window gains focus
            const onFocus = () => fetchUserData();
            window.addEventListener('focus', onFocus);

            return () => window.removeEventListener('focus', onFocus);
        }
    }, [user]);

    const handleProfileUpdate = () => {
        setProfileUpdateKey(prev => prev + 1);
    };

    const handleLogout = () => signOut(auth);

    const handleOnboardingComplete = () => {
        if (user) {
            const onboardingKey = `rovena-onboarding-completed-${user.uid}`;
            localStorage.setItem(onboardingKey, 'true');
        }
        setShowOnboarding(false);
    };

    const handleShowOnboarding = () => {
        setShowOnboarding(true);
    };

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
            </div>
        )
    }

    const displayName = user?.displayName || user?.email?.split('@')[0] || 'Usuário';
    const userPhotoURL = user?.photoURL || undefined;

    return (
        <HashRouter>
            <Routes>
                <Route path="/login" element={!user ? <Login onAuthSuccess={() => { }} /> : <Navigate to="/" />} />

                <Route path="/*" element={
                    user ? (
                        <div className="app-container">
                            <Sidebar
                                key={profileUpdateKey}
                                userEmail={displayName}
                                userPlan={userPlan}
                                userPhotoURL={userPhotoURL}
                                onLogout={handleLogout}
                            />
                            <main className="main-content">
                                <Suspense fallback={
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
                                        <div className="spinner" style={{ width: 30, height: 30, borderWidth: 2 }}></div>
                                    </div>
                                }>
                                    <Routes>
                                        <Route path="/" element={<Home tokensUsed={tokensUsed} tokensLimit={tokensLimit} />} />
                                        <Route path="/chats" element={<Chats />} />
                                        <Route path="/images" element={<Images />} />
                                        <Route path="/canva" element={<Canva />} />
                                        <Route path="/archives" element={<Archives />} />
                                        <Route path="/charts" element={<Charts />} />
                                        <Route path="/presentations" element={<Presentations />} />
                                        <Route path="/presentations-beta" element={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '16px' }}>
                                                <h2 style={{ color: '#888' }}>🚧 Em Desenvolvimento</h2>
                                                <p style={{ color: '#666' }}>Esta funcionalidade está sendo desenvolvida.</p>
                                            </div>
                                        } />
                                        <Route path="/browser" element={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '16px' }}>
                                                <h2 style={{ color: '#888' }}>🚧 Em Desenvolvimento</h2>
                                                <p style={{ color: '#666' }}>Esta funcionalidade está sendo desenvolvida.</p>
                                            </div>
                                        } />
                                        <Route path="/notes" element={<Notes />} />
                                        <Route path="/profile" element={<Profile onProfileUpdate={handleProfileUpdate} />} />
                                        <Route path="/settings" element={
                                            <Settings
                                                userEmail={user.email || ''}
                                                userPlan={userPlan}
                                                tokensUsed={tokensUsed}
                                                tokensLimit={tokensLimit}
                                                subscriptionId={subscriptionId}
                                                onLogout={handleLogout}
                                                onCancelPlan={fetchUserData}
                                                onShowOnboarding={handleShowOnboarding}
                                            />
                                        } />
                                        <Route path="*" element={<Navigate to="/" />} />
                                    </Routes>
                                </Suspense>
                            </main>
                        </div>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
            </Routes>

            {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}

            {/* Global Update Modal */}
            <Modal
                isOpen={showUpdateModal}
                onClose={() => setShowUpdateModal(false)}
                title="Nova Versão Disponível"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setShowUpdateModal(false)}>
                            Instalar Depois
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                if ((window as any).electronAPI) {
                                    (window as any).electronAPI.getPlatform().then((plat: string) => {
                                        if (plat === 'darwin') {
                                            (window as any).electronAPI.openManualUpdate();
                                        } else {
                                            (window as any).electronAPI.quitAndInstall();
                                        }
                                    });
                                }
                            }}
                        >
                            Reiniciar e Instalar
                        </button>
                    </>
                }
            >
                <p>Uma nova atualização foi baixada. Reinicie o aplicativo agora para aplicar as mudanças.</p>
            </Modal>
        </HashRouter>
    );
}

export default App;