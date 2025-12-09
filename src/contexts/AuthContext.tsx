import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, checkSubscription, getUserTokens } from '../services/firebase';

interface UserData {
    email: string;
    plan: 'free' | 'plus';
    tokensUsed: number;
    tokensLimit: number;
    messagesCount: number;
    interactionsCount: number;
    subscriptionId?: string;
}

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    loading: boolean;
    logout: () => Promise<void>;
    refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUserData = async (currentUser: User) => {
        try {
            // Get subscription status from Stripe
            const subscriptionResult = await checkSubscription();
            const subscriptionData = subscriptionResult.data as any;

            // Get token usage from Firestore
            const tokensResult = await getUserTokens();
            const tokensData = tokensResult.data as any;

            setUserData({
                email: currentUser.email || '',
                plan: subscriptionData.plan || 'free',
                tokensLimit: subscriptionData.tokensLimit || 10000,
                tokensUsed: tokensData.tokensUsed || 0,
                messagesCount: tokensData.messagesCount || 0,
                interactionsCount: tokensData.interactionsCount || 0,
                subscriptionId: subscriptionData.subscriptionId,
            });
        } catch (error) {
            console.error('Error fetching user data:', error);
            // Fallback to free plan defaults
            setUserData({
                email: currentUser.email || '',
                plan: 'free',
                tokensLimit: 10000,
                tokensUsed: 0,
                messagesCount: 0,
                interactionsCount: 0,
            });
        }
    };

    const refreshUserData = async () => {
        if (user) {
            await fetchUserData(user);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                await fetchUserData(currentUser);
            } else {
                setUserData(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        try {
            await signOut(auth);
            setUser(null);
            setUserData(null);
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, logout, refreshUserData }}>
            {children}
        </AuthContext.Provider>
    );
}
