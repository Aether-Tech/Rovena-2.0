import { Image } from 'lucide-react';
import './Placeholder.css';

export function Images() {
    return (
        <div className="placeholder-page page-content">
            <div className="placeholder-icon">
                <Image size={36} />
            </div>
            <h1 className="placeholder-title">Images</h1>
            <p className="placeholder-subtitle">
                Gere imagens incríveis usando inteligência artificial.
            </p>
            <span className="placeholder-badge">Em breve</span>
        </div>
    );
}

export default Images;
