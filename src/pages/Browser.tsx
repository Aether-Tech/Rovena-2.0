import { useState, useRef, useEffect } from 'react';
import {
    Globe,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Home as HomeIcon,
    Loader2,
} from 'lucide-react';
import './Browser.css';

const DEFAULT_URL = 'https://gamma.app';

export function Browser() {
    const [url, setUrl] = useState(DEFAULT_URL);
    const [inputUrl, setInputUrl] = useState(DEFAULT_URL);
    const [isLoading, setIsLoading] = useState(true);
    const webviewRef = useRef<HTMLWebViewElement>(null);

    useEffect(() => {
        const webview = webviewRef.current as any;
        if (!webview) return;

        const handleLoadStart = () => setIsLoading(true);
        const handleLoadStop = () => setIsLoading(false);
        const handleDomReady = () => setIsLoading(false);
        const handleNavigate = (e: any) => {
            setInputUrl(e.url);
            setUrl(e.url);
        };

        webview.addEventListener('did-start-loading', handleLoadStart);
        webview.addEventListener('did-stop-loading', handleLoadStop);
        webview.addEventListener('dom-ready', handleDomReady);
        webview.addEventListener('did-navigate', handleNavigate);
        webview.addEventListener('did-navigate-in-page', handleNavigate);

        return () => {
            webview.removeEventListener('did-start-loading', handleLoadStart);
            webview.removeEventListener('did-stop-loading', handleLoadStop);
            webview.removeEventListener('dom-ready', handleDomReady);
            webview.removeEventListener('did-navigate', handleNavigate);
            webview.removeEventListener('did-navigate-in-page', handleNavigate);
        };
    }, []);

    const handleNavigate = () => {
        let newUrl = inputUrl.trim();
        if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
            newUrl = 'https://' + newUrl;
        }
        setUrl(newUrl);
        setInputUrl(newUrl);
    };

    const handleRefresh = () => {
        const webview = webviewRef.current as any;
        if (webview) webview.reload();
    };

    const handleBack = () => {
        const webview = webviewRef.current as any;
        if (webview && webview.canGoBack()) webview.goBack();
    };

    const handleForward = () => {
        const webview = webviewRef.current as any;
        if (webview && webview.canGoForward()) webview.goForward();
    };

    const handleHome = () => {
        setUrl(DEFAULT_URL);
        setInputUrl(DEFAULT_URL);
    };

    return (
        <div className="browser-page">
            <div className="browser-header">
                <Globe size={24} />
                <h1>Mini Browser</h1>
                <span className="browser-subtitle">Teste sites sem gastar tokens</span>
            </div>

            <div className="browser-main">
                <div className="browser-toolbar">
                    <button className="browser-nav-btn" onClick={handleBack} title="Voltar">
                        <ChevronLeft size={18} />
                    </button>
                    <button className="browser-nav-btn" onClick={handleForward} title="Avançar">
                        <ChevronRight size={18} />
                    </button>
                    <button className="browser-nav-btn" onClick={handleRefresh} title="Recarregar">
                        <RefreshCw size={18} className={isLoading ? 'spinning' : ''} />
                    </button>
                    <button className="browser-nav-btn" onClick={handleHome} title="Home">
                        <HomeIcon size={18} />
                    </button>
                    <div className="browser-url-bar">
                        <input
                            type="text"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
                            placeholder="Digite uma URL..."
                        />
                        {isLoading && <Loader2 size={16} className="url-loader spinning" />}
                    </div>
                </div>

                <div className="browser-content">
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

export default Browser;
