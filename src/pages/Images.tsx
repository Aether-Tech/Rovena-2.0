import { useState, useRef, useEffect } from 'react';
import { Mountain, Brush, Pencil, Camera, Sparkles, ImageIcon, Download, RefreshCw, AlertCircle, ChevronDown, Palette, RatioIcon, RotateCcw } from 'lucide-react';
import { generateImage } from '../services/imageGeneration';
import './Images.css';

// Types
type ImageStyle = 'realistic' | 'digital-art' | 'sketch' | 'photography';
type AspectRatio = '1:1' | '16:9' | '4:3' | '9:16';

interface StyleOption {
    id: ImageStyle;
    label: string;
    icon: React.ReactNode;
}

interface RatioOption {
    id: AspectRatio;
    label: string;
    boxClass: string;
}

// Style options
const styleOptions: StyleOption[] = [
    { id: 'realistic', label: 'Realista', icon: <Mountain size={16} className="icon" /> },
    { id: 'digital-art', label: 'Arte Digital', icon: <Brush size={16} className="icon" /> },
    { id: 'sketch', label: 'Esboço', icon: <Pencil size={16} className="icon" /> },
    { id: 'photography', label: 'Fotografia', icon: <Camera size={16} className="icon" /> },
];

// Ratio options
const ratioOptions: RatioOption[] = [
    { id: '1:1', label: '1:1', boxClass: 'ratio-1-1' },
    { id: '16:9', label: '16:9', boxClass: 'ratio-16-9' },
    { id: '4:3', label: '4:3', boxClass: 'ratio-4-3' },
    { id: '9:16', label: '9:16', boxClass: 'ratio-9-16' },
];

export function Images() {
    const [prompt, setPrompt] = useState('');
    const [selectedStyle, setSelectedStyle] = useState<ImageStyle>('realistic');
    const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('1:1');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Dropdown states
    const [showStyleDropdown, setShowStyleDropdown] = useState(false);
    const [showRatioDropdown, setShowRatioDropdown] = useState(false);

    const styleDropdownRef = useRef<HTMLDivElement>(null);
    const ratioDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (styleDropdownRef.current && !styleDropdownRef.current.contains(event.target as Node)) {
                setShowStyleDropdown(false);
            }
            if (ratioDropdownRef.current && !ratioDropdownRef.current.contains(event.target as Node)) {
                setShowRatioDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        setError(null);

        try {
            const imageUrl = await generateImage({
                prompt,
                style: selectedStyle,
                ratio: selectedRatio,
            });

            setGeneratedImage(imageUrl);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao gerar imagem');
            console.error('Image generation error:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = async () => {
        if (!generatedImage) return;

        try {
            const response = await fetch(generatedImage);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `rovena-image-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download error:', err);
            window.open(generatedImage, '_blank');
        }
    };

    const handleRegenerate = () => {
        handleGenerate();
    };

    const currentStyle = styleOptions.find(s => s.id === selectedStyle);
    const currentRatio = ratioOptions.find(r => r.id === selectedRatio);

    return (
        <div className="images-page page-content">
            <div className="images-container">
                {/* Header */}
                <header className="images-header">
                    <h1 className="images-title">Gerador de Imagens</h1>
                    <p className="images-subtitle">
                        Transforme suas ideias em arte com inteligência artificial
                    </p>
                </header>

                {/* Prompt Input Box */}
                <div className="prompt-box">
                    <textarea
                        className="prompt-textarea"
                        placeholder="Torne sua ideia realidade..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={4}
                        disabled={isGenerating}
                    />

                    {/* Toolbar inside prompt box */}
                    <div className="prompt-toolbar">
                        <div className="prompt-options">
                            {/* Style Dropdown */}
                            <div className="dropdown-container" ref={styleDropdownRef}>
                                <button
                                    className={`dropdown-trigger ${showStyleDropdown ? 'open' : ''}`}
                                    onClick={() => {
                                        setShowStyleDropdown(!showStyleDropdown);
                                        setShowRatioDropdown(false);
                                    }}
                                    disabled={isGenerating}
                                    type="button"
                                >
                                    <Palette size={16} />
                                    <span>{currentStyle?.label}</span>
                                    <ChevronDown size={14} className="chevron" />
                                </button>

                                <div className={`dropdown-menu ${showStyleDropdown ? 'show' : ''}`}>
                                    {styleOptions.map((style) => (
                                        <button
                                            key={style.id}
                                            className={`dropdown-item ${selectedStyle === style.id ? 'active' : ''}`}
                                            onClick={() => {
                                                setSelectedStyle(style.id);
                                                setShowStyleDropdown(false);
                                            }}
                                            type="button"
                                        >
                                            {style.icon}
                                            <span>{style.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Ratio Dropdown */}
                            <div className="dropdown-container" ref={ratioDropdownRef}>
                                <button
                                    className={`dropdown-trigger ${showRatioDropdown ? 'open' : ''}`}
                                    onClick={() => {
                                        setShowRatioDropdown(!showRatioDropdown);
                                        setShowStyleDropdown(false);
                                    }}
                                    disabled={isGenerating}
                                    type="button"
                                >
                                    <RatioIcon size={16} />
                                    <span>{currentRatio?.label}</span>
                                    <ChevronDown size={14} className="chevron" />
                                </button>

                                <div className={`dropdown-menu ${showRatioDropdown ? 'show' : ''}`}>
                                    {ratioOptions.map((ratio) => (
                                        <button
                                            key={ratio.id}
                                            className={`dropdown-item ${selectedRatio === ratio.id ? 'active' : ''}`}
                                            onClick={() => {
                                                setSelectedRatio(ratio.id);
                                                setShowRatioDropdown(false);
                                            }}
                                            type="button"
                                        >
                                            <div className={`ratio-box-mini ${ratio.boxClass}`} />
                                            <span>{ratio.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Reset Button */}
                            <button
                                className="reset-btn"
                                onClick={() => {
                                    setPrompt('');
                                    setGeneratedImage(null);
                                    setError(null);
                                }}
                                disabled={isGenerating || (!prompt.trim() && !generatedImage)}
                                type="button"
                                title="Limpar prompt e imagem"
                            >
                                <RotateCcw size={16} />
                            </button>
                        </div>

                        {/* Generate Button */}
                        <button
                            className={`generate-btn ${isGenerating ? 'loading' : ''}`}
                            onClick={handleGenerate}
                            disabled={!prompt.trim() || isGenerating}
                            type="button"
                        >
                            <Sparkles size={18} className="sparkle-icon" />
                            {isGenerating ? 'Gerando...' : 'Gerar'}
                        </button>
                    </div>
                </div>

                {/* Result Preview Area */}
                <div className={`result-preview ${generatedImage ? 'has-image' : ''} ${isGenerating ? 'generating' : ''}`}>
                    {isGenerating ? (
                        <div className="generating-state">
                            <div className="generating-spinner"></div>
                            <span>Gerando sua imagem...</span>
                            <span className="generating-hint">Isso pode levar alguns segundos</span>
                        </div>
                    ) : error ? (
                        <div className="error-state">
                            <AlertCircle size={48} strokeWidth={1} />
                            <span>{error}</span>
                            <button className="retry-btn" onClick={handleRegenerate}>
                                <RefreshCw size={16} />
                                Tentar novamente
                            </button>
                        </div>
                    ) : generatedImage ? (
                        <div className="image-result">
                            <img
                                src={generatedImage}
                                alt="Imagem gerada por IA"
                                className="generated-image"
                            />
                            <div className="image-actions">
                                <button className="action-btn" onClick={handleDownload} title="Baixar imagem">
                                    <Download size={18} />
                                    Baixar
                                </button>
                                <button className="action-btn" onClick={handleRegenerate} title="Gerar nova variação">
                                    <RefreshCw size={18} />
                                    Regenerar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="result-preview-hint">
                            <ImageIcon size={48} strokeWidth={1} />
                            <span>Sua imagem aparecerá aqui</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Images;
