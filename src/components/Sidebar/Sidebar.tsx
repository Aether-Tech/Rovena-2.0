import { Link, useLocation } from 'react-router-dom';
import {
    Home,
    MessageSquare,
    Image,
    PenTool,
    Archive,
    BarChart3,
    Presentation,
    Settings,
    LogOut,
} from 'lucide-react';
import './Sidebar.css';

interface NavItem {
    icon: React.ElementType;
    label: string;
    path: string;
}

const mainNavItems: NavItem[] = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: MessageSquare, label: 'Chats', path: '/chats' },
    { icon: Image, label: 'Images', path: '/images' },
    { icon: PenTool, label: 'Canva', path: '/canva' },
    { icon: Archive, label: 'Archives', path: '/archives' },
    { icon: BarChart3, label: 'Charts', path: '/charts' },
    { icon: Presentation, label: 'Presentations', path: '/presentations' },
];

const bottomNavItems: NavItem[] = [
    { icon: Settings, label: 'Settings', path: '/settings' },
];

interface SidebarProps {
    userEmail?: string;
    userPlan?: 'free' | 'plus';
    onLogout?: () => void;
}

export function Sidebar({
    userEmail,
    userPlan = 'free',
    onLogout
}: SidebarProps) {
    const location = useLocation();

    const getInitials = (email: string) => {
        return email.charAt(0).toUpperCase();
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header drag-region">
                <img src="./logo.png" alt="Rovena" className="sidebar-logo-img no-drag" />
                <span className="sidebar-title no-drag">Rovena</span>
            </div>

            <nav className="sidebar-nav">
                <span className="nav-section">Menu</span>
                {mainNavItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                    >
                        <item.icon className="nav-icon" />
                        <span>{item.label}</span>
                    </Link>
                ))}

                <span className="nav-section">System</span>
                {bottomNavItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                    >
                        <item.icon className="nav-icon" />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="user-profile">
                    <div className="user-avatar">
                        {userEmail ? getInitials(userEmail) : 'U'}
                    </div>
                    <div className="user-info">
                        <div className="user-name">{userEmail || 'User'}</div>
                        <div className="user-plan">{userPlan === 'plus' ? 'Plus' : 'Free'} Plan</div>
                    </div>
                    {onLogout && (
                        <button
                            className="btn btn-ghost"
                            onClick={onLogout}
                            title="Logout"
                        >
                            <LogOut size={18} />
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;
