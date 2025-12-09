import { MessageSquare } from 'lucide-react';
import './Placeholder.css';

export function Chats() {
    return (
        <div className="placeholder-page page-content">
            <div className="placeholder-icon">
                <MessageSquare size={36} />
            </div>
            <h1 className="placeholder-title">Chats</h1>
            <p className="placeholder-subtitle">
                Converse com a IA e explore possibilidades infinitas de interação.
            </p>
            <span className="placeholder-badge">Em breve</span>
        </div>
    );
}

export default Chats;
