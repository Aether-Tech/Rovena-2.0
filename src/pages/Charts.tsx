import { BarChart3 } from 'lucide-react';
import './Placeholder.css';

export function Charts() {
    return (
        <div className="placeholder-page page-content">
            <div className="placeholder-icon">
                <BarChart3 size={36} />
            </div>
            <h1 className="placeholder-title">Charts</h1>
            <p className="placeholder-subtitle">
                Crie gráficos e visualizações de dados com IA.
            </p>
            <span className="placeholder-badge">Em breve</span>
        </div>
    );
}

export default Charts;
