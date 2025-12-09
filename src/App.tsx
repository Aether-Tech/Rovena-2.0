import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Home } from './pages/Home';
import { Chats } from './pages/Chats';
import { Images } from './pages/Images';
import { Archives } from './pages/Archives';
import { Charts } from './pages/Charts';
import { Presentations } from './pages/Presentations';
import { Settings } from './pages/Settings';
import './index.css';

// Mock data - will be replaced with Firebase data
const mockUserData = {
  email: 'usuario@email.com',
  plan: 'plus' as const,
  tokensUsed: 1000000,
  tokensLimit: 3000000,
  messagesLast30Days: 127,
  interactionsLast30Days: 342,
};

function App() {
  const [userData, setUserData] = useState(mockUserData);

  // TODO: Replace with Firebase Auth
  const handleLogout = () => {
    console.log('Logout');
    // Clear local storage
    localStorage.removeItem('rovena-todos');
    // Navigate to login (when implemented)
  };

  // TODO: Replace with Stripe API call
  const handleCancelPlan = async () => {
    console.log('Cancel plan');
    // Call Firebase Function to cancel Stripe subscription
  };

  return (
    <BrowserRouter>
      <div className="app-container">
        <Sidebar
          userEmail={userData.email}
          userPlan={userData.plan}
          onLogout={handleLogout}
        />
        <main className="main-content">
          <Routes>
            <Route
              path="/"
              element={
                <Home
                  tokensUsed={userData.tokensUsed}
                  tokensLimit={userData.tokensLimit}
                  messagesLast30Days={userData.messagesLast30Days}
                  interactionsLast30Days={userData.interactionsLast30Days}
                />
              }
            />
            <Route path="/chats" element={<Chats />} />
            <Route path="/images" element={<Images />} />
            <Route path="/archives" element={<Archives />} />
            <Route path="/charts" element={<Charts />} />
            <Route path="/presentations" element={<Presentations />} />
            <Route
              path="/settings"
              element={
                <Settings
                  userEmail={userData.email}
                  userPlan={userData.plan}
                  tokensUsed={userData.tokensUsed}
                  tokensLimit={userData.tokensLimit}
                  onLogout={handleLogout}
                  onCancelPlan={handleCancelPlan}
                />
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
