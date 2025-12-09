import { Archive } from 'lucide-react';
import './Placeholder.css';

export function Archives() {
    return (
        <div className="placeholder-page page-content">
            <div className="placeholder-icon">
                <Archive size={36} />
            </div>
            <h1 className="placeholder-title">Archives</h1>
            <p className="placeholder-subtitle">
                Acesse seu histórico de conversas e criações salvas.
            </p>
            <span className="placeholder-badge">Em breve</span>
        </div>
    );
}

export default Archives;
