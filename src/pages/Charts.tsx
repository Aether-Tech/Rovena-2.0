import { useState, useRef } from 'react';
import { Send, BarChart3, PieChart, LineChart, TrendingUp, Palette, Download, AlertCircle, Sparkles, Save, Check } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { LocalStorageService } from '../services/localStorage';
import type { ArchivedChart } from '../services/localStorage';
import './Charts.css';

type ChartType = 'bar' | 'line' | 'pie' | 'area';
type ColorTheme = 'green' | 'blue' | 'purple' | 'orange' | 'rainbow';

interface ChartData {
    labels: string[];
    values: number[];
    title?: string;
}

interface ParsedChartResponse {
    error?: string;
    labels: string[];
    values: number[];
    title?: string;
    interpretation?: string;
}

const COLOR_THEMES: Record<ColorTheme, string[]> = {
    green: ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'],
    blue: ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'],
    purple: ['#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87'],
    orange: ['#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12'],
    rainbow: ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'],
};

export function Charts() {
    const [inputValue, setInputValue] = useState('');
    const [chartType, setChartType] = useState<ChartType>('bar');
    const [colorTheme, setColorTheme] = useState<ColorTheme>('green');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [aiInterpretation, setAiInterpretation] = useState<string>('');
    const [saved, setSaved] = useState(false);
    
    const chartRef = useRef<HTMLDivElement>(null);

    const handleGenerateChart = async () => {
        if (!inputValue.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);

        try {
            const functions = getFunctions();
            const parseChartData = httpsCallable<unknown, ParsedChartResponse>(functions, 'parseChartData');
            
            const result = await parseChartData({
                rawData: inputValue,
                chartType
            });

            const data = result.data;
            
            if (data.error) {
                setError(data.error);
                return;
            }

            setChartData({
                labels: data.labels,
                values: data.values,
                title: data.title
            });
            setAiInterpretation(data.interpretation || '');

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Erro ao processar os dados. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleGenerateChart();
        }
    };

    const getSvgData = (): string | undefined => {
        if (!chartRef.current) return undefined;
        const svg = chartRef.current.querySelector('svg');
        if (!svg) return undefined;
        return new XMLSerializer().serializeToString(svg);
    };

    const saveChart = () => {
        if (!chartData) return;
        
        const archivedChart: ArchivedChart = {
            id: `chart-${Date.now()}`,
            type: 'chart',
            createdAt: Date.now(),
            title: chartData.title || `Gráfico de ${chartType}`,
            chartType,
            colorTheme,
            labels: chartData.labels,
            values: chartData.values,
            interpretation: aiInterpretation,
            svgData: getSvgData(),
        };
        
        LocalStorageService.saveItem(archivedChart);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const downloadChart = () => {
        if (!chartRef.current) return;
        
        const svg = chartRef.current.querySelector('svg');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        canvas.width = 800;
        canvas.height = 500;

        img.onload = () => {
            ctx?.fillRect(0, 0, canvas.width, canvas.height);
            ctx?.drawImage(img, 0, 0);
            
            const link = document.createElement('a');
            link.download = `grafico-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    const colors = COLOR_THEMES[colorTheme];

    const renderChart = () => {
        if (!chartData) return null;

        const { labels, values, title } = chartData;
        const maxValue = Math.max(...values);
        const padding = 60;
        const width = 700;
        const height = 400;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        switch (chartType) {
            case 'bar':
                return (
                    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
                        {title && (
                            <text x={width / 2} y={25} textAnchor="middle" className="chart-title">
                                {title}
                            </text>
                        )}
                        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-axis" />
                        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="chart-axis" />
                        
                        {values.map((value, index) => {
                            const barWidth = chartWidth / values.length - 20;
                            const barHeight = (value / maxValue) * chartHeight;
                            const x = padding + index * (chartWidth / values.length) + 10;
                            const y = height - padding - barHeight;
                            
                            return (
                                <g key={index}>
                                    <rect
                                        x={x}
                                        y={y}
                                        width={barWidth}
                                        height={barHeight}
                                        fill={colors[index % colors.length]}
                                        rx={4}
                                        className="chart-bar"
                                    />
                                    <text
                                        x={x + barWidth / 2}
                                        y={y - 8}
                                        textAnchor="middle"
                                        className="chart-value"
                                    >
                                        {value}
                                    </text>
                                    <text
                                        x={x + barWidth / 2}
                                        y={height - padding + 20}
                                        textAnchor="middle"
                                        className="chart-label"
                                    >
                                        {labels[index]}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                );

            case 'line': {
                const points = values.map((value, index) => {
                    const x = padding + index * (chartWidth / (values.length - 1));
                    const y = height - padding - (value / maxValue) * chartHeight;
                    return `${x},${y}`;
                }).join(' ');

                return (
                    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
                        {title && (
                            <text x={width / 2} y={25} textAnchor="middle" className="chart-title">
                                {title}
                            </text>
                        )}
                        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-axis" />
                        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="chart-axis" />
                        
                        <polyline
                            points={points}
                            fill="none"
                            stroke={colors[0]}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="chart-line"
                        />
                        
                        {values.map((value, index) => {
                            const x = padding + index * (chartWidth / (values.length - 1));
                            const y = height - padding - (value / maxValue) * chartHeight;
                            
                            return (
                                <g key={index}>
                                    <circle cx={x} cy={y} r={6} fill={colors[0]} className="chart-point" />
                                    <text x={x} y={y - 15} textAnchor="middle" className="chart-value">
                                        {value}
                                    </text>
                                    <text x={x} y={height - padding + 20} textAnchor="middle" className="chart-label">
                                        {labels[index]}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                );
            }

            case 'area': {
                const areaPoints = values.map((value, index) => {
                    const x = padding + index * (chartWidth / (values.length - 1));
                    const y = height - padding - (value / maxValue) * chartHeight;
                    return `${x},${y}`;
                });
                
                const areaPath = `M${padding},${height - padding} L${areaPoints.join(' L')} L${width - padding},${height - padding} Z`;

                return (
                    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
                        <defs>
                            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor={colors[0]} stopOpacity="0.6" />
                                <stop offset="100%" stopColor={colors[0]} stopOpacity="0.1" />
                            </linearGradient>
                        </defs>
                        {title && (
                            <text x={width / 2} y={25} textAnchor="middle" className="chart-title">
                                {title}
                            </text>
                        )}
                        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-axis" />
                        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="chart-axis" />
                        
                        <path d={areaPath} fill="url(#areaGradient)" className="chart-area" />
                        <polyline
                            points={areaPoints.join(' ')}
                            fill="none"
                            stroke={colors[0]}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        
                        {values.map((value, index) => {
                            const x = padding + index * (chartWidth / (values.length - 1));
                            const y = height - padding - (value / maxValue) * chartHeight;
                            
                            return (
                                <g key={index}>
                                    <circle cx={x} cy={y} r={5} fill={colors[0]} />
                                    <text x={x} y={y - 15} textAnchor="middle" className="chart-value">
                                        {value}
                                    </text>
                                    <text x={x} y={height - padding + 20} textAnchor="middle" className="chart-label">
                                        {labels[index]}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                );
            }

            case 'pie': {
                const total = values.reduce((a, b) => a + b, 0);
                const centerX = width / 2;
                const centerY = height / 2;
                const radius = 140;
                let startAngle = -90;

                return (
                    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
                        {title && (
                            <text x={width / 2} y={25} textAnchor="middle" className="chart-title">
                                {title}
                            </text>
                        )}
                        {values.map((value, index) => {
                            const percentage = value / total;
                            const angle = percentage * 360;
                            const endAngle = startAngle + angle;
                            
                            const startRad = (startAngle * Math.PI) / 180;
                            const endRad = (endAngle * Math.PI) / 180;
                            
                            const x1 = centerX + radius * Math.cos(startRad);
                            const y1 = centerY + radius * Math.sin(startRad);
                            const x2 = centerX + radius * Math.cos(endRad);
                            const y2 = centerY + radius * Math.sin(endRad);
                            
                            const largeArc = angle > 180 ? 1 : 0;
                            
                            const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                            
                            const midAngle = ((startAngle + endAngle) / 2 * Math.PI) / 180;
                            const labelX = centerX + (radius + 30) * Math.cos(midAngle);
                            const labelY = centerY + (radius + 30) * Math.sin(midAngle);
                            
                            startAngle = endAngle;
                            
                            return (
                                <g key={index}>
                                    <path
                                        d={pathData}
                                        fill={colors[index % colors.length]}
                                        className="chart-pie-slice"
                                    />
                                    <text x={labelX} y={labelY} textAnchor="middle" className="chart-label">
                                        {labels[index]} ({(percentage * 100).toFixed(1)}%)
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                );
            }

            default:
                return null;
        }
    };

    return (
        <div className="charts-page">
            <header className="charts-header">
                <div className="charts-header-title">
                    <BarChart3 size={24} />
                    Criar Gráficos
                </div>
                <p className="charts-header-subtitle">
                    Insira seus dados e deixe a IA interpretar e gerar visualizações
                </p>
            </header>

            <div className="charts-content">
                <div className="charts-controls">
                    <div className="control-group">
                        <label className="control-label">
                            <span>Tipo de Gráfico</span>
                        </label>
                        <div className="chart-type-options">
                            <button 
                                className={`type-option ${chartType === 'bar' ? 'active' : ''}`}
                                onClick={() => setChartType('bar')}
                            >
                                <BarChart3 size={18} />
                                Barras
                            </button>
                            <button 
                                className={`type-option ${chartType === 'line' ? 'active' : ''}`}
                                onClick={() => setChartType('line')}
                            >
                                <LineChart size={18} />
                                Linhas
                            </button>
                            <button 
                                className={`type-option ${chartType === 'area' ? 'active' : ''}`}
                                onClick={() => setChartType('area')}
                            >
                                <TrendingUp size={18} />
                                Área
                            </button>
                            <button 
                                className={`type-option ${chartType === 'pie' ? 'active' : ''}`}
                                onClick={() => setChartType('pie')}
                            >
                                <PieChart size={18} />
                                Pizza
                            </button>
                        </div>
                    </div>

                    <div className="control-group">
                        <label className="control-label">
                            <Palette size={16} />
                            <span>Tema de Cores</span>
                        </label>
                        <div className="color-theme-options">
                            {(Object.keys(COLOR_THEMES) as ColorTheme[]).map((theme) => (
                                <button
                                    key={theme}
                                    className={`color-option ${colorTheme === theme ? 'active' : ''}`}
                                    onClick={() => setColorTheme(theme)}
                                    title={theme.charAt(0).toUpperCase() + theme.slice(1)}
                                >
                                    <div className="color-preview">
                                        {COLOR_THEMES[theme].slice(0, 3).map((color, i) => (
                                            <div key={i} style={{ backgroundColor: color }} />
                                        ))}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="control-group input-group">
                        <label className="control-label">
                            <Sparkles size={16} />
                            <span>Dados (a IA vai interpretar)</span>
                        </label>
                        <textarea
                            className="data-input"
                            placeholder="Ex: Vendas de janeiro foram 1500, fevereiro 2300, março 1800, abril 2100..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={4}
                            disabled={isLoading}
                        />
                        <span className="input-hint">Pressione Ctrl+Enter para gerar</span>
                    </div>

                    <button
                        className="btn btn-primary generate-btn"
                        onClick={handleGenerateChart}
                        disabled={!inputValue.trim() || isLoading}
                    >
                        {isLoading ? (
                            <div className="spinner-small"></div>
                        ) : (
                            <>
                                <Send size={18} />
                                Gerar Gráfico
                            </>
                        )}
                    </button>

                    {error && (
                        <div className="error-message">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                </div>

                <div className="charts-preview">
                    {chartData ? (
                        <>
                            <div className="chart-container" ref={chartRef}>
                                {renderChart()}
                            </div>
                            
                            {aiInterpretation && (
                                <div className="ai-interpretation">
                                    <Sparkles size={16} />
                                    <p>{aiInterpretation}</p>
                                </div>
                            )}

                            <div className="chart-actions">
                                <button className="btn btn-secondary" onClick={saveChart} disabled={saved}>
                                    {saved ? <><Check size={18} /> Salvo</> : <><Save size={18} /> Salvar</>}
                                </button>
                                <button className="btn btn-secondary" onClick={downloadChart}>
                                    <Download size={18} />
                                    Baixar
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="empty-preview">
                            <BarChart3 size={48} />
                            <h3>Pré-visualização do Gráfico</h3>
                            <p>Insira seus dados e clique em "Gerar Gráfico" para visualizar</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Charts;