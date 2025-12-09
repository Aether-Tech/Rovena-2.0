import { Presentation } from 'lucide-react';
import './Placeholder.css';

export function Presentations() {
    return (
        <div className="placeholder-page page-content">
            <div className="placeholder-icon">
                <Presentation size={36} />
            </div>
            <h1 className="placeholder-title">Presentations</h1>
            <p className="placeholder-subtitle">
                Gere apresentações profissionais automaticamente.
            </p>
            <span className="placeholder-badge">Em breve</span>
        </div>
    );
}

export default Presentations;
