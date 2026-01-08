import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Globe,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Home as HomeIcon,
} from 'lucide-react';
import './Browser.css';

const DEFAULT_URL = 'https://gamma.app';

declare global {
    interface Window {
        electron?: {
            browser: {
                attach: (bounds: { x: number; y: number; width: number; height: number }) => Promise<boolean>;
                updateBounds: (bounds: { x: number; y: number; width: number; height: number }) => Promise<boolean>;
                destroy: () => Promise<boolean>;
                navigate: (url: string) => Promise<boolean>;
                back: () => Promise<boolean>;
                forward: () => Promise<boolean>;
                refresh: () => Promise<boolean>;
                home: () => Promise<boolean>;
                getUrl: () => Promise<string>;
            };
        };
    }
}

export function Browser() {
    const [inputUrl, setInputUrl] = useState(DEFAULT_URL);
    const [currentUrl, setCurrentUrl] = useState('');
    const [isElectron] = useState(!!window.electron);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const getBounds = useCallback(() => {
        const container = containerRef.current;
        if (!container) return null;
        const rect = container.getBoundingClientRect();
        return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
        };
    }, []);

    const attachView = useCallback(async () => {
        if (!window.electron?.browser) return;
        const bounds = getBounds();
        if (!bounds) return;
        await window.electron.browser.attach(bounds);
    }, [getBounds]);

    const updateViewBounds = useCallback(async () => {
        if (!window.electron?.browser) return;
        const bounds = getBounds();
        if (!bounds) return;
        await window.electron.browser.updateBounds(bounds);
    }, [getBounds]);

    useEffect(() => {
        if (!isElectron || !window.electron?.browser) return;
        attachView().then(async () => {
            const url = await window.electron?.browser.getUrl();
            if (url) {
                setCurrentUrl(url);
                setInputUrl(url);
            }
        });

        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver(() => {
            updateViewBounds();
        });
        resizeObserver.observe(container);

        const handleWindowChange = () => {
            updateViewBounds();
        };

        window.addEventListener('resize', handleWindowChange);
        window.addEventListener('scroll', handleWindowChange, true);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleWindowChange);
            window.removeEventListener('scroll', handleWindowChange, true);
            window.electron?.browser.destroy();
        };
    }, [attachView, updateViewBounds, isElectron]);

    const handleNavigate = async () => {
        if (!window.electron?.browser) return;
        let newUrl = inputUrl.trim();
        if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
            newUrl = 'https://' + newUrl;
        }
        const success = await window.electron.browser.navigate(newUrl);
        if (success) {
            setCurrentUrl(newUrl);
            setInputUrl(newUrl);
        }
    };

    const handleRefresh = async () => {
        if (window.electron?.browser) {
            await window.electron.browser.refresh();
        }
    };

    const handleBack = async () => {
        if (window.electron?.browser) {
            await window.electron.browser.back();
            const url = await window.electron.browser.getUrl();
            if (url) {
                setCurrentUrl(url);
                setInputUrl(url);
            }
        }
    };

    const handleForward = async () => {
        if (window.electron?.browser) {
            await window.electron.browser.forward();
            const url = await window.electron.browser.getUrl();
            if (url) {
                setCurrentUrl(url);
                setInputUrl(url);
            }
        }
    };

    const handleHome = async () => {
        if (window.electron?.browser) {
            await window.electron.browser.home();
            setCurrentUrl(DEFAULT_URL);
            setInputUrl(DEFAULT_URL);
        }
    };

    if (!isElectron) {
        return (
            <div className="browser-page">
                <div className="browser-header">
                    <Globe size={24} />
                    <h1>Mini Browser</h1>
                    <span className="browser-subtitle">Available only in the Electron app</span>
                </div>
            </div>
        );
    }

    return (
        <div className="browser-page">
            <div className="browser-header">
                <Globe size={24} />
                <h1>Mini Browser</h1>
                <span className="browser-subtitle">Embedded in the main window via WebContentsView</span>
            </div>

            <div className="browser-main">
                <div className="browser-toolbar">
                    <button className="browser-nav-btn" onClick={handleBack} title="Back">
                        <ChevronLeft size={18} />
                    </button>
                    <button className="browser-nav-btn" onClick={handleForward} title="Forward">
                        <ChevronRight size={18} />
                    </button>
                    <button className="browser-nav-btn" onClick={handleRefresh} title="Reload">
                        <RefreshCw size={18} />
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
                            placeholder="Type a URL..."
                        />
                    </div>
                </div>

                <div className="browser-container" ref={containerRef}></div>

                {currentUrl && (
                    <div className="browser-current-url">
                        <span>Current URL: {currentUrl}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Browser;