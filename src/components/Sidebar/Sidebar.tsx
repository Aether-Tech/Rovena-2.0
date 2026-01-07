import { Link, useLocation, useNavigate } from 'react-router-dom';
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
    FileText,
} from 'lucide-react';
import './Sidebar.css';

interface NavItem {
    icon: React.ElementType;
    label: string;
    path: string;
    badge?: string;
    disabled?: boolean;
}

const mainNavItems: NavItem[] = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: MessageSquare, label: 'Chats', path: '/chats' },
    { icon: Image, label: 'Images', path: '/images' },
    { icon: PenTool, label: 'Canva', path: '/canva' },
    { icon: FileText, label: 'Notes', path: '/notes', badge: 'Beta' },
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
    userPhotoURL?: string;
    onLogout?: () => void;
}

export function Sidebar({
    userEmail,
    userPlan = 'free',
    userPhotoURL,
    onLogout
}: SidebarProps) {
    const location = useLocation();
    const navigate = useNavigate();

    const getInitials = (email: string) => {
        return email.charAt(0).toUpperCase();
    };

    const handleProfileClick = () => {
        navigate('/profile');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header drag-region">
                <img src="./logo.png?v=2" alt="Rovena" className="sidebar-logo-img no-drag" />
                <span className="sidebar-title no-drag">Rovena</span>
            </div>

            <nav className="sidebar-nav">
                <span className="nav-section">Menu</span>
                {mainNavItems.map((item) => (
                    item.disabled ? (
                        <div
                            key={item.path}
                            className="nav-item disabled"
                        >
                            <item.icon className="nav-icon" />
                            <span>{item.label}</span>
                            {item.badge && <span className="nav-badge">{item.badge}</span>}
                        </div>
                    ) : (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                        >
                            <item.icon className="nav-icon" />
                            <span>{item.label}</span>
                            {item.badge && <span className="nav-badge">{item.badge}</span>}
                        </Link>
                    )
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
                <div className="user-profile" onClick={handleProfileClick} title="Ver perfil">
                    <div className="user-avatar">
                        {userPhotoURL ? (
                            <img src={userPhotoURL} alt="Foto de perfil" className="user-avatar-img" />
                        ) : (
                            userEmail ? getInitials(userEmail) : 'U'
                        )}
                    </div>
                    <div className="user-info">
                        <div className="user-name">{userEmail || 'User'}</div>
                        <div className="user-plan">{userPlan === 'plus' ? 'Plus' : 'Free'} Plan</div>
                    </div>
                    {onLogout && (
                        <button
                            className="btn btn-ghost"
                            onClick={(e) => {
                                e.stopPropagation();
                                onLogout();
                            }}
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