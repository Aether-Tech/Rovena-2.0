import {
    Home,
    MessageSquare,
    Image,
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
    page: string;
}

const mainNavItems: NavItem[] = [
    { icon: Home, label: 'Home', page: 'home' },
    { icon: MessageSquare, label: 'Chats', page: 'chats' },
    { icon: Image, label: 'Images', page: 'images' },
    { icon: Archive, label: 'Archives', page: 'archives' },
    { icon: BarChart3, label: 'Charts', page: 'charts' },
    { icon: Presentation, label: 'Presentations', page: 'presentations' },
];

const bottomNavItems: NavItem[] = [
    { icon: Settings, label: 'Settings', page: 'settings' },
];

interface SidebarProps {
    userEmail?: string;
    userPlan?: 'free' | 'plus';
    onLogout?: () => void;
    currentPage?: string;
    onNavigate?: (page: string) => void;
}

export function Sidebar({
    userEmail,
    userPlan = 'free',
    onLogout,
    currentPage = 'home',
    onNavigate,
}: SidebarProps) {
    const getInitials = (email: string) => {
        return email.charAt(0).toUpperCase();
    };

    const handleNav = (page: string) => {
        if (onNavigate) {
            onNavigate(page);
        }
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header drag-region">
                <div className="sidebar-logo no-drag">R</div>
                <span className="sidebar-title no-drag">Rovena</span>
            </div>

            <nav className="sidebar-nav">
                <span className="nav-section">Menu</span>
                {mainNavItems.map((item) => (
                    <button
                        key={item.page}
                        onClick={() => handleNav(item.page)}
                        className={`nav-item ${currentPage === item.page ? 'active' : ''}`}
                    >
                        <item.icon className="nav-icon" />
                        <span>{item.label}</span>
                    </button>
                ))}

                <span className="nav-section">System</span>
                {bottomNavItems.map((item) => (
                    <button
                        key={item.page}
                        onClick={() => handleNav(item.page)}
                        className={`nav-item ${currentPage === item.page ? 'active' : ''}`}
                    >
                        <item.icon className="nav-icon" />
                        <span>{item.label}</span>
                    </button>
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
