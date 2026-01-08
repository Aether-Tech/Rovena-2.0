import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Archive,
    MessageSquare,
    Image as ImageIcon,
    MonitorPlay,
    BarChart3,
    Settings as SettingsIcon,
    Trash2,
    Clock,
    Download,
    ExternalLink,
    Search,
    Presentation,
} from 'lucide-react';
import { LocalStorageService } from '../services/localStorage';
import type {
    ArchivedItem,
    ArchivedChat,
    ArchivedImage,
    ArchivedChart,
    ArchivedPresentation,
    ArchiveSettings
} from '../services/localStorage';
import { Modal } from '../components/Modal/Modal';
import './Archives.css';

type Tab = 'all' | 'chat' | 'image' | 'presentation' | 'chart' | 'settings';

export function Archives() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('all');
    const [items, setItems] = useState<ArchivedItem[]>([]);
    const [settings, setSettings] = useState<ArchiveSettings>(LocalStorageService.getSettings());
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedImage, setSelectedImage] = useState<ArchivedImage | null>(null);
    const [selectedChart, setSelectedChart] = useState<ArchivedChart | null>(null);

    const loadItems = useCallback(() => {
        LocalStorageService.runCleanup();

        const allItems = LocalStorageService.getItems();
        let filtered = allItems;

        if (activeTab !== 'all' && activeTab !== 'settings') {
            filtered = allItems.filter(item => item.type === activeTab);
        }

        setItems(filtered);
    }, [activeTab]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadItems();
    }, [loadItems]);

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this item?')) {
            LocalStorageService.deleteItem(id);
            loadItems();
        }
    };

    const handleOpenChat = (chat: ArchivedChat) => {
        navigate('/chats', { state: { restoredChat: chat } });
    };

    const handleDownloadImage = (image: ArchivedImage, e: React.MouseEvent) => {
        e.stopPropagation();
        const link = document.createElement('a');
        link.href = image.url;
        link.download = `rovena-image-${image.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadChart = (chart: ArchivedChart, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!chart.svgData) return;
        
        // Parse the SVG data to a DOM element so we can inject styles if they are missing
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(chart.svgData, 'image/svg+xml');
        const svgElement = svgDoc.documentElement as unknown as SVGElement;

        // Check if it already has a style tag, if not add it
        if (!svgElement.querySelector('style')) {
            const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
            style.textContent = `
                .chart-title { fill: #ffffff; font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 600; }
                .chart-value { fill: #ffffff; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; }
                .chart-label { fill: #a1a1aa; font-family: 'Inter', sans-serif; font-size: 11px; }
                .chart-axis { stroke: #27272a; stroke-width: 1; }
                .chart-line { stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
            `;
            svgElement.prepend(style);
        }

        const updatedSvgData = new XMLSerializer().serializeToString(svgElement);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        // High resolution
        const scale = 2;
        canvas.width = 800 * scale;
        canvas.height = 500 * scale;

        img.onload = () => {
            if (ctx) {
                // Background
                ctx.fillStyle = '#0a0a0a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw the SVG
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const link = document.createElement('a');
                link.download = `grafico-${chart.id}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(updatedSvgData)));
    };

    const handleUpdateSettings = (type: keyof ArchiveSettings['retentionDays'], days: number) => {
        const newSettings = {
            ...settings,
            retentionDays: {
                ...settings.retentionDays,
                [type]: days
            }
        };
        setSettings(newSettings);
        LocalStorageService.saveSettings(newSettings);
    };

    const filteredItems = items.filter(item => {
        const searchLower = searchTerm.toLowerCase();
        if (item.title?.toLowerCase().includes(searchLower)) return true;
        if (item.type === 'image' && (item as ArchivedImage).prompt?.toLowerCase().includes(searchLower)) return true;
        if (item.type === 'chart' && (item as ArchivedChart).interpretation?.toLowerCase().includes(searchLower)) return true;
        return false;
    });

    const renderItemIcon = (type: string) => {
        switch (type) {
            case 'chat': return <MessageSquare size={20} className="item-icon-chat" />;
            case 'image': return <ImageIcon size={20} className="item-icon-image" />;
            case 'presentation': return <MonitorPlay size={20} className="item-icon-pres" />;
            case 'chart': return <BarChart3 size={20} className="item-icon-chart" />;
            default: return <Archive size={20} />;
        }
    };

    const renderSettings = () => (
        <div className="archives-settings">
            <h2 className="settings-title">Retention Settings</h2>
            <p className="settings-desc">Define how long your archived items will be kept locally.</p>

            <div className="retention-controls">
                <div className="retention-control">
                    <div className="control-header">
                        <span className="control-label"><MessageSquare size={16} /> Chats</span>
                        <span className="control-value">{settings.retentionDays.chat} days</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="365"
                        value={settings.retentionDays.chat}
                        onChange={(e) => handleUpdateSettings('chat', parseInt(e.target.value))}
                        className="retention-slider"
                    />
                </div>

                <div className="retention-control">
                    <div className="control-header">
                        <span className="control-label"><ImageIcon size={16} /> Images</span>
                        <span className="control-value">{settings.retentionDays.image} days</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="365"
                        value={settings.retentionDays.image}
                        onChange={(e) => handleUpdateSettings('image', parseInt(e.target.value))}
                        className="retention-slider"
                    />
                </div>

                <div className="retention-control">
                    <div className="control-header">
                        <span className="control-label"><MonitorPlay size={16} /> Presentations</span>
                        <span className="control-value">{settings.retentionDays.presentation} days</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="365"
                        value={settings.retentionDays.presentation}
                        onChange={(e) => handleUpdateSettings('presentation', parseInt(e.target.value))}
                        className="retention-slider"
                    />
                </div>

                <div className="retention-control">
                    <div className="control-header">
                        <span className="control-label"><BarChart3 size={16} /> Charts</span>
                        <span className="control-value">{settings.retentionDays.chart} days</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="365"
                        value={settings.retentionDays.chart}
                        onChange={(e) => handleUpdateSettings('chart', parseInt(e.target.value))}
                        className="retention-slider"
                    />
                </div>
            </div>
            <p className="cleanup-note"><Clock size={14} /> Automatic cleanup occurs whenever you visit this page.</p>
        </div>
    );

    return (
        <div className="archives-page page-content">
            <header className="page-header">
                <h1 className="page-title">Archives</h1>
                <p className="page-subtitle">Manage your history and creations saved locally</p>
            </header>

            <div className="archives-controls">
                <div className="archives-tabs">
                    <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All</button>
                    <button className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>Chats</button>
                    <button className={`tab-btn ${activeTab === 'image' ? 'active' : ''}`} onClick={() => setActiveTab('image')}>Images</button>
                    <button className={`tab-btn ${activeTab === 'chart' ? 'active' : ''}`} onClick={() => setActiveTab('chart')}>Charts</button>
                    <button className={`tab-btn ${activeTab === 'presentation' ? 'active' : ''}`} onClick={() => setActiveTab('presentation')}>Presentations</button>
                    <button className={`tab-btn settings ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                        <SettingsIcon size={16} /> Configure
                    </button>
                </div>

                {activeTab !== 'settings' && (
                    <div className="search-bar">
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search in archives..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}
            </div>

            <div className="archives-content">
                {activeTab === 'settings' ? (
                    renderSettings()
                ) : filteredItems.length === 0 ? (
                    <div className="empty-archives">
                        <Archive size={48} />
                        <h3>No archives found</h3>
                        <p>Your saved chats, images, charts, and presentations will appear here.</p>
                    </div>
                ) : (
                    <div className="archives-grid">
                        {filteredItems.map(item => (
                            <div key={item.id} className="archive-card" onClick={() => {
                                if (item.type === 'chat') handleOpenChat(item as ArchivedChat);
                                if (item.type === 'image') setSelectedImage(item as ArchivedImage);
                                if (item.type === 'chart') setSelectedChart(item as ArchivedChart);
                                if (item.type === 'presentation') navigate('/presentations', { state: { restoredPresentation: item } });
                            }}>
                                <div className="card-header">
                                    <div className="card-type">
                                        {renderItemIcon(item.type)}
                                        <span className="card-date">
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <button className="delete-btn" onClick={(e) => handleDelete(item.id, e)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {item.type === 'image' && (
                                    <div className="card-image-preview">
                                        <img src={(item as ArchivedImage).url} alt="Thumbnail" />
                                    </div>
                                )}

                                {item.type === 'chart' && (item as ArchivedChart).svgData && (
                                    <div className="card-chart-preview" dangerouslySetInnerHTML={{ __html: (item as ArchivedChart).svgData || '' }} />
                                )}

                                {item.type === 'presentation' && (
                                    <div className="card-pres-preview">
                                        <Presentation size={32} />
                                        <span>{(item as ArchivedPresentation).slideCount || 0} slides</span>
                                    </div>
                                )}

                                <div className="card-body">
                                    <h3 className="card-title">
                                        {item.title || (item.type === 'image' ? (item as ArchivedImage).prompt : item.type === 'chart' ? (item as ArchivedChart).chartType : 'Untitled')}
                                    </h3>
                                    {item.type === 'chat' && (
                                        <p className="card-preview">
                                            {(item as ArchivedChat).messages.length} messages
                                        </p>
                                    )}
                                    {item.type === 'chart' && (item as ArchivedChart).interpretation && (
                                        <p className="card-preview">
                                            {(item as ArchivedChart).interpretation?.slice(0, 80)}...
                                        </p>
                                    )}
                                    {item.type === 'presentation' && (
                                        <p className="card-preview">
                                            {(item as ArchivedPresentation).slideCount || 0} slides
                                        </p>
                                    )}
                                </div>

                                <div className="card-footer">
                                    {item.type === 'chat' && (
                                        <span className="action-link">Open Conversation <ExternalLink size={14} /></span>
                                    )}
                                    {item.type === 'image' && (
                                        <button className="download-btn" onClick={(e) => handleDownloadImage(item as ArchivedImage, e)}>
                                            <Download size={14} /> Download
                                        </button>
                                    )}
                                    {item.type === 'chart' && (
                                        <button className="download-btn" onClick={(e) => handleDownloadChart(item as ArchivedChart, e)}>
                                            <Download size={14} /> Download
                                        </button>
                                    )}
                                    {item.type === 'presentation' && (
                                        <span className="action-link">Open Editor <ExternalLink size={14} /></span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Image Modal */}
            <Modal
                isOpen={!!selectedImage}
                onClose={() => setSelectedImage(null)}
                title="View Image"
                footer={
                    <button className="btn btn-primary" onClick={(e) => selectedImage && handleDownloadImage(selectedImage, e)}>
                        <Download size={16} /> Download Image
                    </button>
                }
            >
                {selectedImage && (
                    <div className="image-modal-content">
                        <img src={selectedImage.url} alt={selectedImage.prompt} className="full-image" />
                        <p className="image-prompt">{selectedImage.prompt}</p>
                    </div>
                )}
            </Modal>

            {/* Chart Modal */}
            <Modal
                isOpen={!!selectedChart}
                onClose={() => setSelectedChart(null)}
                title="View Chart"
                footer={
                    <button className="btn btn-primary" onClick={(e) => selectedChart && handleDownloadChart(selectedChart, e)}>
                        <Download size={16} /> Download Chart
                    </button>
                }
            >
                {selectedChart && (
                    <div className="chart-modal-content">
                        {selectedChart.svgData && (
                            <div className="chart-modal-svg" dangerouslySetInnerHTML={{ __html: selectedChart.svgData }} />
                        )}
                        {selectedChart.interpretation && (
                            <p className="chart-interpretation">{selectedChart.interpretation}</p>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default Archives;