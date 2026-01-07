import { useState, useEffect } from 'react';
import {
    CreditCard,
    Zap,
    Key,
    LogOut,
    ExternalLink,
    RefreshCw,
    Download,
    BookOpen,
} from 'lucide-react';
import { cancelSubscription } from '../services/firebase';
import { Modal } from '../components/Modal/Modal';
import './Settings.css';

interface SettingsProps {
    userEmail: string;
    userPlan: 'free' | 'plus';
    tokensUsed: number;
    tokensLimit: number;
    subscriptionId?: string;
    onLogout: () => void;
    onCancelPlan: () => void;
    onShowOnboarding?: () => void;
}

export function Settings({ userEmail, userPlan, tokensUsed, tokensLimit, subscriptionId, onLogout, onCancelPlan, onShowOnboarding }: SettingsProps) {
    const [useCustomAPI, setUseCustomAPI] = useState(false);
    const [customOpenAIKey, setCustomOpenAIKey] = useState('');
    const [isCanceling, setIsCanceling] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [appVersion, setAppVersion] = useState<string>('');
    const [platform, setPlatform] = useState<string>('');
    const [updateStatus, setUpdateStatus] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<any>(null);
    const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
    const [updateAvailableInfo, setUpdateAvailableInfo] = useState<any>(null);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [fallbackReleaseInfo, setFallbackReleaseInfo] = useState<any>(null);

    useEffect(() => {
        // Get App Version and Platform
        if ((window as any).electronAPI) {
            (window as any).electronAPI.getAppVersion().then((ver: string) => {
                setAppVersion(ver);
            });

            if ((window as any).electronAPI.getPlatform) {
                (window as any).electronAPI.getPlatform().then((p: string) => {
                    setPlatform(p);
                });
            }

            // Listen for Update Status
            (window as any).electronAPI.onUpdateStatus((status: any) => {
                console.log('Update Status:', status);
                setUpdateError(null);
                if (status.text === 'download-progress') {
                    setDownloadProgress(status.data);
                    setUpdateStatus(`Baixando atualização: ${Math.round(status.data.percent)}%`);
                } else if (status.text === 'update-available') {
                    const info = status.data;
                    setUpdateStatus('Nova versão disponível!');
                    setUpdateAvailableInfo(info);

                    if (status.data && status.data.releaseNotes) {
                        const notes = Array.isArray(status.data.releaseNotes)
                            ? status.data.releaseNotes.map((n: any) => n.note).join('\n')
                            : status.data.releaseNotes;
                        setReleaseNotes(notes);
                    }
                } else if (status.text === 'update-downloaded') {
                    setUpdateStatus('Atualização pronta! Reinicie o app para instalar.');
                    setDownloadProgress(null);
                } else if (status.text === 'update-not-available') {
                    setUpdateStatus('Você já está na versão mais recente.');
                    setDownloadProgress(null);
                    setUpdateAvailableInfo(null);
                    setReleaseNotes(null);
                } else {
                    if (status.text) setUpdateStatus(status.text);
                }
            });

            if ((window as any).electronAPI.onUpdateError) {
                (window as any).electronAPI.onUpdateError(async (error: string) => {
                    console.error("Update Error received:", error);
                    setUpdateError(error);
                    setDownloadProgress(null);
                    
                    if (error.includes('command') || error.includes('bundle') || error.includes('ENOENT') || error.includes('spawn') || error.includes('code signature')) {
                        setUpdateStatus('Atualização automática indisponível. Use o download manual.');
                        try {
                            const releaseInfo = await (window as any).electronAPI.getLatestReleaseUrl();
                            if (releaseInfo) {
                                setFallbackReleaseInfo(releaseInfo);
                            }
                        } catch (e) {
                            console.error('Error fetching fallback release:', e);
                        }
                    } else {
                        setUpdateStatus('Erro na atualização: ' + error);
                    }
                });
            }
        }
    }, []);

    const handleCheckUpdates = async () => {
        if ((window as any).electronAPI) {
            setUpdateStatus('Verificando atualizações...');
            setReleaseNotes(null);
            setUpdateAvailableInfo(null);
            setUpdateError(null);
            setFallbackReleaseInfo(null);

            // Proactively check GitHub API on macOS
            if (platform === 'darwin') {
                try {
                    const latest = await (window as any).electronAPI.getLatestReleaseUrl();
                    if (latest && latest.version !== `v${appVersion}` && latest.version !== appVersion) {
                        setFallbackReleaseInfo(latest);
                        setUpdateStatus('Nova versão detectada (Manual)');
                    }
                } catch (e) {
                    console.error('Manual update check failed:', e);
                }
            }

            (window as any).electronAPI.checkForUpdates();
        } else {
            alert('Atualizações automáticas disponíveis apenas na versão Desktop.');
        }
    };

    // Modals state
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const tokensRemaining = tokensLimit - tokensUsed;
    const tokenPercentage = tokensLimit > 0 ? Math.round((tokensRemaining / tokensLimit) * 100) : 0;

    const formatNumber = (num: number) => {
        return num.toLocaleString('pt-BR');
    };

    const handleCancelPlan = async () => {
        if (!subscriptionId) {
            // Should theoretically not happen if button is shown only when subsId exists, but safe check
            return;
        }

        setIsCanceling(true);
        try {
            await cancelSubscription({ subscriptionId });
            setShowCancelModal(false);
            setSuccessMessage('Plano cancelado com sucesso. Você manterá acesso até o fim do período atual.');
            setShowSuccessModal(true);

            if (onCancelPlan) {
                await onCancelPlan();
            }
        } catch (error) {
            console.error('Error canceling plan:', error);
            alert('Erro ao cancelar plano. Tente novamente.'); // Keeping alert for explicit error for now
        } finally {
            setIsCanceling(false);
        }
    };

    const handleRefresh = async () => {
        if (onCancelPlan) await onCancelPlan();
        setSuccessMessage('Dados atualizados com sucesso!');
        setShowSuccessModal(true);
    };

    const handleSaveCustomAPI = async () => {
        if (!customOpenAIKey.startsWith('sk-')) {
            alert('A chave da API deve começar com "sk-"');
            return;
        }

        setIsSaving(true);
        try {
            localStorage.setItem('rovena-custom-openai-key', customOpenAIKey);
            setSuccessMessage('Configurações salvas com sucesso!');
            setShowSuccessModal(true);
        } catch (error) {
            console.error('Error saving API key:', error);
            alert('Erro ao salvar configurações.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        if (onLogout) {
            onLogout();
        }
    };

    return (
        <div className="settings-page page-content">
            <header className="page-header">
                <h1 className="page-title">Configurações</h1>
                <p className="page-subtitle">Gerencie sua conta e preferências</p>
            </header>

            <div className="settings-sections">
                {/* Plan Section */}
                <section className="settings-section">
                    <div className="settings-section-header">
                        <div className="settings-section-icon green">
                            <CreditCard size={20} />
                        </div>
                        <div>
                            <h2 className="settings-section-title">Plano e Assinatura</h2>
                            <p className="settings-section-subtitle">
                                Gerencie seu plano de assinatura
                            </p>
                        </div>
                    </div>

                    <div className="plan-info">
                        <div className="plan-item">
                            <p className="plan-item-label">Plano Atual</p>
                            <p className={`plan-item-value ${userPlan}`}>
                                {userPlan === 'plus' ? 'Plus' : 'Free'}
                            </p>
                        </div>
                        <div className="plan-item">
                            <p className="plan-item-label">Email</p>
                            <p className="plan-item-value">{userEmail || 'Não disponível'}</p>
                        </div>
                    </div>

                    <div className="plan-actions">
                        {userPlan === 'plus' && subscriptionId ? (
                            <button
                                className="btn btn-danger"
                                onClick={() => setShowCancelModal(true)}
                                disabled={isCanceling}
                            >
                                {isCanceling ? 'Cancelando...' : 'Cancelar Plano'}
                            </button>
                        ) : userPlan !== 'plus' ? (
                            <a
                                href="https://rovena.vercel.app/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary"
                            >
                                <Zap size={18} />
                                Fazer Upgrade para Plus
                                <ExternalLink size={14} />
                            </a>
                        ) : null}
                        <button
                            className="btn btn-secondary"
                            onClick={handleRefresh}
                            title="Atualizar dados da assinatura"
                        >
                            <RefreshCw size={18} />
                            Atualizar
                        </button>
                    </div>
                </section>

                {/* Tokens Section */}
                <section className="settings-section">
                    <div className="settings-section-header">
                        <div className="settings-section-icon yellow">
                            <Zap size={20} />
                        </div>
                        <div>
                            <h2 className="settings-section-title">Uso de Tokens</h2>
                            <p className="settings-section-subtitle">
                                Monitore seu consumo de tokens
                            </p>
                        </div>
                    </div>

                    <div className="token-info">
                        <div className="token-info-header">
                            <span className="token-info-label">Tokens Restantes</span>
                            <span className="token-info-value">{tokenPercentage}%</span>
                        </div>
                        <div className="token-info-progress">
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${Math.max(0, Math.min(100, tokenPercentage))}%` }}
                                />
                            </div>
                        </div>
                        <div className="token-info-details">
                            <span>{formatNumber(tokensRemaining)} disponíveis</span>
                            <span>{formatNumber(tokensLimit)} total</span>
                        </div>
                    </div>

                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        Os tokens são renovados mensalmente. Plano Plus: 3M tokens/mês. Plano Free: 10K tokens/mês.
                    </p>
                </section>

                {/* API Section */}
                <section className="settings-section">
                    <div className="settings-section-header">
                        <div className="settings-section-icon blue">
                            <Key size={20} />
                        </div>
                        <div>
                            <h2 className="settings-section-title">APIs Customizadas</h2>
                            <p className="settings-section-subtitle">
                                Use suas próprias chaves de API
                            </p>
                        </div>
                    </div>

                    <div className="api-toggle">
                        <div className="api-toggle-info">
                            <div>
                                <p className="api-toggle-label">Usar API própria</p>
                                <p className="api-toggle-description">
                                    Substitua nossa API pela sua chave OpenAI
                                </p>
                            </div>
                        </div>
                        <div
                            className={`toggle-switch ${useCustomAPI ? 'active' : ''}`}
                            onClick={() => setUseCustomAPI(!useCustomAPI)}
                        />
                    </div>

                    {useCustomAPI && (
                        <div className="api-fields">
                            <div className="api-field">
                                <label className="api-field-label">Chave da API OpenAI</label>
                                <input
                                    type="password"
                                    className="api-field-input"
                                    placeholder="sk-..."
                                    value={customOpenAIKey}
                                    onChange={(e) => setCustomOpenAIKey(e.target.value)}
                                />
                            </div>
                            <button
                                className="btn btn-secondary"
                                style={{ alignSelf: 'flex-start' }}
                                onClick={handleSaveCustomAPI}
                                disabled={isSaving || !customOpenAIKey}
                            >
                                {isSaving ? 'Salvando...' : 'Salvar Configurações'}
                            </button>
                        </div>
                    )}
                </section>

                {/* === ATUALIZAÇÕES === */}
                <section className="settings-section">
                    <div className="settings-section-header">
                        <div className="settings-section-icon blue">
                            <RefreshCw size={20} />
                        </div>
                        <div>
                            <h2 className="settings-section-title">Atualizações</h2>
                            <p className="settings-section-subtitle">
                                Verifique novas versões e notas de lançamento
                            </p>
                        </div>
                    </div>

                    <div className="settings-card" style={{ marginTop: 16 }}>
                        <div className="setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="setting-info">
                                <span className="setting-label" style={{ display: 'block', fontWeight: 600 }}>Versão Atual</span>
                                <span className="setting-description" style={{ color: 'var(--text-secondary)' }}>
                                    Rovena v{appVersion || '...'}
                                </span>
                            </div>
                            <button
                                className="btn btn-secondary"
                                onClick={handleCheckUpdates}
                                disabled={updateStatus === 'Checking for updates...' || (typeof updateStatus === 'string' && updateStatus.includes('Baixando'))}
                            >
                                {updateStatus === 'Checking for updates...' ? 'Verificando...' : 'Verificar atualizações'}
                            </button>
                        </div>

                        {updateStatus && (
                            <div className="setting-item" style={{ marginTop: 16, display: 'block', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                                <div className="status-message" style={{ color: 'var(--accent-blue)', marginBottom: 8, fontWeight: 500 }}>
                                    {updateStatus}
                                </div>

                                {/* Actions: Download / Skip / Restart */}
                                {updateAvailableInfo && !downloadProgress && updateStatus !== 'Atualização pronta! Reinicie o app para instalar.' && (
                                    <div style={{ display: 'flex', gap: '10px', marginTop: 10 }}>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => {
                                                if ((window as any).electronAPI) {
                                                    (window as any).electronAPI.startDownload();
                                                }
                                            }}
                                        >
                                            Baixar Atualização (v{updateAvailableInfo.version})
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => {
                                                // Skip logic
                                                localStorage.setItem('skipped-version', updateAvailableInfo.version);
                                                setUpdateStatus('Versão ignorada.');
                                                setUpdateAvailableInfo(null);
                                                setReleaseNotes(null);
                                            }}
                                        >
                                            Pular esta versão
                                        </button>
                                    </div>
                                )}

                                {updateStatus === 'Atualização pronta! Reinicie o app para instalar.' && (
                                    <button
                                        className="btn btn-primary"
                                        style={{ marginTop: 10 }}
                                        onClick={() => {
                                            if ((window as any).electronAPI) {
                                                (window as any).electronAPI.quitAndInstall();
                                            }
                                        }}
                                    >
                                        Reiniciar e Instalar
                                    </button>
                                )}

                                {/* Download Progress Bar */}
                                {downloadProgress && (
                                    <div className="progress-bar-container" style={{ width: '100%', height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
                                        <div
                                            className="progress-bar-fill"
                                            style={{
                                                width: `${downloadProgress.percent}%`,
                                                height: '100%',
                                                background: 'var(--accent-blue)',
                                                transition: 'width 0.2s ease'
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Fallback Download quando auto-update falha ou no macOS manual */}
                                {(updateStatus === 'Nova versão detectada (Manual)' || (updateError && fallbackReleaseInfo)) && (
                                    <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--accent-blue)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                            <Download size={18} style={{ color: 'var(--accent-blue)' }} />
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Download Manual (Recomendado para macOS)</span>
                                        </div>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                                            {platform === 'darwin' 
                                                ? "Como o app ainda não possui certificado assinado no macOS, você deve baixar o novo .dmg, abrir e arrastar para sua pasta de Aplicativos, substituindo a versão atual."
                                                : "O atualizador automático encontrou um problema. Você pode baixar a nova versão manualmente abaixo."}
                                        </p>
                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                            {fallbackReleaseInfo && fallbackReleaseInfo.dmgUrl && (
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={() => {
                                                        (window as any).electronAPI.openExternalUrl(fallbackReleaseInfo.dmgUrl);
                                                    }}
                                                >
                                                    <Download size={16} />
                                                    Baixar Rovena {fallbackReleaseInfo.version} (.dmg)
                                                </button>
                                            )}
                                            {fallbackReleaseInfo && fallbackReleaseInfo.releaseUrl && (
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => {
                                                        (window as any).electronAPI.openExternalUrl(fallbackReleaseInfo.releaseUrl);
                                                    }}
                                                >
                                                    <ExternalLink size={16} />
                                                    Ver Notas da Versão
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Release Notes */}
                                {releaseNotes && (
                                    <div className="release-notes" style={{ marginTop: 16, background: 'var(--bg-secondary)', padding: 12, borderRadius: 8 }}>
                                        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Novidades da versão v{updateAvailableInfo?.version}:</h4>
                                        <div
                                            style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
                                            dangerouslySetInnerHTML={{ __html: releaseNotes }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* Account Section */}
                <section className="settings-section">
                    <div className="settings-section-header">
                        <div className="settings-section-icon red">
                            <LogOut size={20} />
                        </div>
                        <div>
                            <h2 className="settings-section-title">Conta</h2>
                            <p className="settings-section-subtitle">
                                Gerenciar sua sessão
                            </p>
                        </div>
                    </div>

                    <div className="account-actions">
                        <div className="account-action">
                            <div className="account-action-info">
                                <span className="account-action-label">Ver tour do aplicativo</span>
                                <span className="account-action-description">
                                    Reveja o tutorial inicial
                                </span>
                            </div>
                            <button className="btn btn-secondary" onClick={onShowOnboarding}>
                                <BookOpen size={18} />
                                Ver Tour
                            </button>
                        </div>
                        <div className="account-action">
                            <div className="account-action-info">
                                <span className="account-action-label">Sair da conta</span>
                                <span className="account-action-description">
                                    Encerrar sua sessão atual
                                </span>
                            </div>
                            <button className="btn btn-secondary" onClick={handleLogout}>
                                <LogOut size={18} />
                                Logout
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            {/* Cancel Confirm Modal */}
            <Modal
                isOpen={showCancelModal}
                onClose={() => setShowCancelModal(false)}
                title="Cancelar Assinatura"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setShowCancelModal(false)}>
                            Voltar
                        </button>
                        <button className="btn btn-danger" onClick={handleCancelPlan} disabled={isCanceling}>
                            {isCanceling ? 'Cancelando...' : 'Sim, Cancelar'}
                        </button>
                    </>
                }
            >
                <p>Tem certeza que deseja cancelar seu plano? Você manterá o acesso aos recursos Plus até o final do período atual, mas sua assinatura não será renovada.</p>
            </Modal>

            {/* Success Info Modal */}
            <Modal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                title="Sucesso"
                footer={
                    <button className="btn btn-primary" onClick={() => setShowSuccessModal(false)}>
                        OK
                    </button>
                }
            >
                <p>{successMessage}</p>
            </Modal>
        </div>
    );
}

export default Settings;