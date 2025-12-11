import { useState, useRef, useEffect } from 'react';
import {
    Presentation,
    Sparkles,
    ExternalLink,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Home as HomeIcon,
    FlaskConical,
    Loader2,
    Wand2,
    Download,
    Check,
    AlertCircle,
} from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import './PresentationsBeta.css';

const GAMMA_URL = 'https://gamma.app';

type ViewMode = 'input' | 'editor' | 'result';

interface GammaResult {
    status: string;
    generationId: string;
    gammaUrl: string;
    downloadUrl?: string;
    credits?: { deducted: number; remaining: number };
}

const LANGUAGES = [
    { value: 'pt-BR', label: 'Português (Brasil)' },
    { value: 'en-US', label: 'English (US)' },
    { value: 'es-ES', label: 'Español' },
    { value: 'fr-FR', label: 'Français' },
    { value: 'de-DE', label: 'Deutsch' },
];

const IMAGE_STYLES = [
    { value: 'minimal', label: 'Minimalista' },
    { value: 'professional', label: 'Profissional' },
    { value: 'creative', label: 'Criativo' },
    { value: 'modern', label: 'Moderno' },
    { value: 'classic', label: 'Clássico' },
];

const WRITING_STYLES = [
    { value: 'formal', label: 'Formal' },
    { value: 'dynamic', label: 'Dinâmico' },
    { value: 'casual', label: 'Descontraído' },
    { value: 'academic', label: 'Acadêmico' },
    { value: 'persuasive', label: 'Persuasivo' },
];

export function PresentationsBeta() {
    const [viewMode, setViewMode] = useState<ViewMode>('input');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [generationProgress, setGenerationProgress] = useState('');
    const [gammaResult, setGammaResult] = useState<GammaResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [topic, setTopic] = useState('');
    const [language, setLanguage] = useState('pt-BR');
    const [imageStyle, setImageStyle] = useState('professional');
    const [writingStyle, setWritingStyle] = useState('formal');
    const [slideCount, setSlideCount] = useState(5);
    const [stylization, setStylization] = useState(50);

    const [url, setUrl] = useState(GAMMA_URL);
    const [inputUrl, setInputUrl] = useState(GAMMA_URL);
    const [isLoading, setIsLoading] = useState(true);
    const webviewRef = useRef<HTMLWebViewElement>(null);

    useEffect(() => {
        const webview = webviewRef.current as any;
        if (!webview) return;

        const handleLoadStart = () => setIsLoading(true);
        const handleLoadStop = () => setIsLoading(false);
        const handleDomReady = () => setIsLoading(false);

        webview.addEventListener('did-start-loading', handleLoadStart);
        webview.addEventListener('did-stop-loading', handleLoadStop);
        webview.addEventListener('dom-ready', handleDomReady);

        return () => {
            webview.removeEventListener('did-start-loading', handleLoadStart);
            webview.removeEventListener('did-stop-loading', handleLoadStop);
            webview.removeEventListener('dom-ready', handleDomReady);
        };
    }, [viewMode]);

    const enhanceUserPrompt = async () => {
        if (!topic.trim()) return;
        
        setIsEnhancing(true);
        try {
            const functions = getFunctions();
            const enhance = httpsCallable(functions, 'enhancePrompt');
            const result = await enhance({ prompt: topic, language });
            const data = result.data as { enhancedPrompt: string };
            setTopic(data.enhancedPrompt);
        } catch (error) {
            console.error('Error enhancing prompt:', error);
        } finally {
            setIsEnhancing(false);
        }
    };

    const generatePresentation = async () => {
        if (!topic.trim()) return;

        setIsGenerating(true);
        setError(null);
        setGenerationProgress('Conectando com Gamma.app...');

        try {
            const functions = getFunctions();
            const generateGamma = httpsCallable(functions, 'generateGammaPresentation');
            
            setGenerationProgress('Gerando apresentação via API...');
            
            const result = await generateGamma({
                topic,
                language,
                writingStyle,
                imageStyle,
                slideCount,
                stylization,
            });

            const data = result.data as GammaResult;
            setGammaResult(data);
            
            if (data.gammaUrl) {
                setUrl(data.gammaUrl);
                setInputUrl(data.gammaUrl);
                setViewMode('result');
            }

        } catch (err: any) {
            console.error('Error generating presentation:', err);
            setError(err.message || 'Erro ao gerar apresentação');
        } finally {
            setIsGenerating(false);
            setGenerationProgress('');
        }
    };

    const handleNavigate = () => {
        if (inputUrl.trim()) {
            setUrl(inputUrl.trim());
            setIsLoading(true);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleNavigate();
        }
    };

    const goBack = () => {
        if (webviewRef.current) {
            (webviewRef.current as any).goBack?.();
        }
    };

    const goForward = () => {
        if (webviewRef.current) {
            (webviewRef.current as any).goForward?.();
        }
    };

    const reload = () => {
        if (webviewRef.current) {
            (webviewRef.current as any).reload?.();
        }
        setIsLoading(true);
    };

    const goHome = () => {
        setUrl(GAMMA_URL);
        setInputUrl(GAMMA_URL);
        setIsLoading(true);
    };

    const openExternal = () => {
        window.open(url, '_blank');
    };

    const backToInput = () => {
        setViewMode('input');
        setGammaResult(null);
        setError(null);
    };

    const openInGamma = () => {
        if (gammaResult?.gammaUrl) {
            setUrl(gammaResult.gammaUrl);
            setInputUrl(gammaResult.gammaUrl);
            setIsLoading(true);
            setViewMode('editor');
        }
    };

    const downloadPptx = () => {
        if (gammaResult?.downloadUrl) {
            window.open(gammaResult.downloadUrl, '_blank');
        }
    };

    if (viewMode === 'input') {
        return (
            <div className="presentations-beta-page">
                <div className="presentations-beta-input">
                    <div className="presentations-header">
                        <div className="header-icon beta-gradient">
                            <Presentation size={32} />
                            <FlaskConical size={16} className="flask-overlay" />
                        </div>
                        <h1>Presentations <span className="beta-tag">Beta</span></h1>
                        <p>Gere apresentações profissionais com Gamma.app API</p>
                    </div>

                    {error && (
                        <div className="error-banner">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="presentations-form">
                        <div className="form-group">
                            <label>Tema da Apresentação</label>
                            <div className="textarea-with-enhance">
                                <textarea
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="Descreva o tema da sua apresentação..."
                                    rows={3}
                                />
                                <button 
                                    className="enhance-btn"
                                    onClick={enhanceUserPrompt}
                                    disabled={!topic.trim() || isEnhancing}
                                    title="Aprimorar prompt com IA"
                                >
                                    {isEnhancing ? (
                                        <Loader2 size={18} className="spinning" />
                                    ) : (
                                        <Wand2 size={18} />
                                    )}
                                    Aprimorar
                                </button>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Idioma</label>
                                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                                    {LANGUAGES.map(lang => (
                                        <option key={lang.value} value={lang.value}>{lang.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Estilo Visual</label>
                                <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)}>
                                    {IMAGE_STYLES.map(style => (
                                        <option key={style.value} value={style.value}>{style.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Estilo de Escrita</label>
                                <select value={writingStyle} onChange={(e) => setWritingStyle(e.target.value)}>
                                    {WRITING_STYLES.map(style => (
                                        <option key={style.value} value={style.value}>{style.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Número de Slides</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={slideCount}
                                    onChange={(e) => setSlideCount(Math.min(30, Math.max(1, Number(e.target.value))))}
                                    className="slide-count-input"
                                />
                            </div>
                        </div>

                        <div className="form-group stylization-group">
                            <label>
                                <span>Estilização</span>
                                <div className="stylization-input-wrapper">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={stylization}
                                        onChange={(e) => setStylization(Math.min(100, Math.max(0, Number(e.target.value))))}
                                        className="stylization-number"
                                    />
                                    <span>%</span>
                                </div>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={stylization}
                                onChange={(e) => setStylization(Number(e.target.value))}
                                className="stylization-slider"
                            />
                            <div className="stylization-labels">
                                <span>Simples</span>
                                <span>Elaborado</span>
                            </div>
                        </div>

                        <button
                            className="generate-btn"
                            onClick={generatePresentation}
                            disabled={!topic.trim() || isGenerating}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 size={20} className="spinning" />
                                    {generationProgress || 'Gerando...'}
                                </>
                            ) : (
                                <>
                                    <Sparkles size={20} />
                                    Gerar Apresentação
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (viewMode === 'result' && gammaResult) {
        return (
            <div className="presentations-beta-page result-mode">
                <div className="result-container">
                    <div className="result-header">
                        <button className="back-btn" onClick={backToInput}>
                            <ChevronLeft size={18} />
                            Nova Apresentação
                        </button>
                    </div>

                    <div className="result-content">
                        <div className="success-icon">
                            <Check size={48} />
                        </div>
                        <h2>Apresentação Gerada!</h2>
                        <p>Sua apresentação foi criada com sucesso via Gamma.app</p>

                        {gammaResult.credits && (
                            <div className="credits-info">
                                <span>Créditos usados: {gammaResult.credits.deducted}</span>
                                <span>Restantes: {gammaResult.credits.remaining}</span>
                            </div>
                        )}

                        <div className="result-actions">
                            <button className="primary-btn" onClick={openInGamma}>
                                <ExternalLink size={18} />
                                Abrir no Gamma.app
                            </button>
                            {gammaResult.downloadUrl && (
                                <button className="secondary-btn" onClick={downloadPptx}>
                                    <Download size={18} />
                                    Baixar PPTX
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="webview-preview">
                        <webview
                            ref={webviewRef as any}
                            src={gammaResult.gammaUrl}
                            style={{ width: '100%', height: '100%' }}
                            allowpopups="true"
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="presentations-beta-page editor-mode">
            <div className="browser-container">
                <div className="browser-toolbar">
                    <button className="back-to-input-btn" onClick={backToInput}>
                        <ChevronLeft size={18} />
                        Nova Apresentação
                    </button>

                    <div className="nav-buttons">
                        <button onClick={goBack} title="Voltar">
                            <ChevronLeft size={18} />
                        </button>
                        <button onClick={goForward} title="Avançar">
                            <ChevronRight size={18} />
                        </button>
                        <button onClick={reload} title="Recarregar">
                            <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
                        </button>
                        <button onClick={goHome} title="Ir para Gamma.app">
                            <HomeIcon size={16} />
                        </button>
                    </div>

                    <div className="url-bar">
                        <Sparkles size={14} className="url-icon" />
                        <input
                            type="text"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Digite a URL..."
                        />
                    </div>

                    <button className="external-btn" onClick={openExternal} title="Abrir no navegador">
                        <ExternalLink size={16} />
                    </button>
                </div>

                <div className="webview-container">
                    {isLoading && (
                        <div className="loading-overlay">
                            <div className="loading-spinner"></div>
                            <span>Carregando Gamma.app...</span>
                        </div>
                    )}
                    <webview
                        ref={webviewRef as any}
                        src={url}
                        style={{ width: '100%', height: '100%' }}
                        allowpopups="true"
                    />
                </div>
            </div>
        </div>
    );
}

export default PresentationsBeta;