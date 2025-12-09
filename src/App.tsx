import { useState, useEffect } from 'react';
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
import { Sidebar } from './components/Sidebar/Sidebar';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
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

// ============ MAIN APP ============
function App() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [userPlan, setUserPlan] = useState<'free' | 'plus'>('free');
    const [tokensUsed, setTokensUsed] = useState(0);
    const [tokensLimit, setTokensLimit] = useState(10000);
    const [subscriptionId, setSubscriptionId] = useState<string | undefined>(undefined);

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
                // Initial fetch when user logs in
                fetchUserData();
            } else {
                setLoading(false);
            }
        });
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
        <HashRouter>
            <Routes>
                <Route path="/login" element={!user ? <Login onAuthSuccess={() => { }} /> : <Navigate to="/" />} />

                <Route path="/*" element={
                    user ? (
                        <div className="app-container">
                            <Sidebar
                                userEmail={displayName}
                                userPlan={userPlan}
                                onLogout={handleLogout}
                            />
                            <main className="main-content">
                                <Routes>
                                    <Route path="/" element={<Home tokensUsed={tokensUsed} tokensLimit={tokensLimit} />} />
                                    <Route path="/chats" element={<Chats />} />
                                    <Route path="/images" element={<Images />} />
                                    <Route path="/canva" element={<Canva />} />
                                    <Route path="/archives" element={<Archives />} />
                                    <Route path="/charts" element={<Charts />} />
                                    <Route path="/presentations" element={<Presentations />} />
                                    <Route path="/settings" element={
                                        <Settings
                                            userEmail={user.email || ''}
                                            userPlan={userPlan}
                                            tokensUsed={tokensUsed}
                                            tokensLimit={tokensLimit}
                                            subscriptionId={subscriptionId}
                                            onLogout={handleLogout}
                                            onCancelPlan={fetchUserData}
                                        />
                                    } />
                                    <Route path="*" element={<Navigate to="/" />} />
                                </Routes>
                            </main>
                        </div>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
            </Routes>
        </HashRouter>
    );
}

export default App;
