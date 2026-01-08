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
                    setUpdateStatus(`Downloading update: ${Math.round(status.data.percent)}%`);
                } else if (status.text === 'update-available') {
                    const info = status.data;
                    setUpdateStatus('New version available!');
                    setUpdateAvailableInfo(info);

                    if (status.data && status.data.releaseNotes) {
                        const notes = Array.isArray(status.data.releaseNotes)
                            ? status.data.releaseNotes.map((n: any) => n.note).join('\n')
                            : status.data.releaseNotes;
                        setReleaseNotes(notes);
                    }
                } else if (status.text === 'update-downloaded') {
                    setUpdateStatus('Update ready! Restart the app to install.');
                    setDownloadProgress(null);
                } else if (status.text === 'update-not-available') {
                    setUpdateStatus('You are already on the latest version.');
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
                        setUpdateStatus('Automatic update unavailable. Use manual download.');
                        try {
                            const releaseInfo = await (window as any).electronAPI.getLatestReleaseUrl();
                            if (releaseInfo) {
                                setFallbackReleaseInfo(releaseInfo);
                            }
                        } catch (e) {
                            console.error('Error fetching fallback release:', e);
                        }
                    } else {
                        setUpdateStatus('Update error: ' + error);
                    }
                });
            }
        }
    }, []);

    const handleCheckUpdates = async () => {
        if ((window as any).electronAPI) {
            setUpdateStatus('Checking for updates...');
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
                        setUpdateStatus('New version detected (Manual)');
                    }
                } catch (e) {
                    console.error('Manual update check failed:', e);
                }
            }

            (window as any).electronAPI.checkForUpdates();
        } else {
            alert('Automatic updates available only in the Desktop version.');
        }
    };

    // Modals state
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const tokensRemaining = tokensLimit - tokensUsed;
    const tokenPercentage = tokensLimit > 0 ? Math.round((tokensRemaining / tokensLimit) * 100) : 0;

    const formatNumber = (num: number) => {
        return num.toLocaleString('en-US');
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
            setSuccessMessage('Plan canceled successfully. You will keep access until the end of the current period.');
            setShowSuccessModal(true);

            if (onCancelPlan) {
                await onCancelPlan();
            }
        } catch (error) {
            console.error('Error canceling plan:', error);
            alert('Error canceling plan. Please try again.'); // Keeping alert for explicit error for now
        } finally {
            setIsCanceling(false);
        }
    };

    const handleRefresh = async () => {
        if (onCancelPlan) await onCancelPlan();
        setSuccessMessage('Data updated successfully!');
        setShowSuccessModal(true);
    };

    const handleSaveCustomAPI = async () => {
        if (!customOpenAIKey.startsWith('sk-')) {
            alert('The API key must start with "sk-"');
            return;
        }

        setIsSaving(true);
        try {
            localStorage.setItem('rovena-custom-openai-key', customOpenAIKey);
            setSuccessMessage('Settings saved successfully!');
            setShowSuccessModal(true);
        } catch (error) {
            console.error('Error saving API key:', error);
            alert('Error saving settings.');
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
                <h1 className="page-title">Settings</h1>
                <p className="page-subtitle">Manage your account and preferences</p>
            </header>

            <div className="settings-sections">
                {/* Plan Section */}
                <section className="settings-section">
                    <div className="settings-section-header">
                        <div className="settings-section-icon green">
                            <CreditCard size={20} />
                        </div>
                        <div>
                            <h2 className="settings-section-title">Plan and Subscription</h2>
                            <p className="settings-section-subtitle">
                                Manage your subscription plan
                            </p>
                        </div>
                    </div>

                    <div className="plan-info">
                        <div className="plan-item">
                            <p className="plan-item-label">Current Plan</p>
                            <p className={`plan-item-value ${userPlan}`}>
                                {userPlan === 'plus' ? 'Plus' : 'Free'}
                            </p>
                        </div>
                        <div className="plan-item">
                            <p className="plan-item-label">Email</p>
                            <p className="plan-item-value">{userEmail || 'Not available'}</p>
                        </div>
                    </div>

                    <div className="plan-actions">
                        {userPlan === 'plus' && subscriptionId ? (
                            <button
                                className="btn btn-danger"
                                onClick={() => setShowCancelModal(true)}
                                disabled={isCanceling}
                            >
                                {isCanceling ? 'Canceling...' : 'Cancel Plan'}
                            </button>
                        ) : userPlan !== 'plus' ? (
                            <a
                                href="https://rovena.vercel.app/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary"
                            >
                                <Zap size={18} />
                                Upgrade to Plus
                                <ExternalLink size={14} />
                            </a>
                        ) : null}
                        <button
                            className="btn btn-secondary"
                            onClick={handleRefresh}
                            title="Update subscription data"
                        >
                            <RefreshCw size={18} />
                            Update
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
                            <h2 className="settings-section-title">Token Usage</h2>
                            <p className="settings-section-subtitle">
                                Monitor your token consumption
                            </p>
                        </div>
                    </div>

                    <div className="token-info">
                        <div className="token-info-header">
                            <span className="token-info-label">Remaining Tokens</span>
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
                            <span>{formatNumber(tokensRemaining)} available</span>
                            <span>{formatNumber(tokensLimit)} total</span>
                        </div>
                    </div>

                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        Tokens are renewed monthly. Plus Plan: 3M tokens/month. Free Plan: 10K tokens/month.
                    </p>
                </section>

                {/* API Section */}
                <section className="settings-section">
                    <div className="settings-section-header">
                        <div className="settings-section-icon blue">
                            <Key size={20} />
                        </div>
                        <div>
                            <h2 className="settings-section-title">Custom APIs</h2>
                            <p className="settings-section-subtitle">
                                Use your own API keys
                            </p>
                        </div>
                    </div>

                    <div className="api-toggle">
                        <div className="api-toggle-info">
                            <div>
                                <p className="api-toggle-label">Use own API</p>
                                <p className="api-toggle-description">
                                    Replace our API with your OpenAI key
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
                                <label className="api-field-label">OpenAI API Key</label>
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
                                {isSaving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    )}
                </section>

                {/* === UPDATES === */}
                <section className="settings-section">
                    <div className="settings-section-header">
                        <div className="settings-section-icon blue">
                            <RefreshCw size={20} />
                        </div>
                        <div>
                            <h2 className="settings-section-title">Updates</h2>
                            <p className="settings-section-subtitle">
                                Check for new versions and release notes
                            </p>
                        </div>
                    </div>

                    <div className="settings-card" style={{ marginTop: 16 }}>
                        <div className="setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="setting-info">
                                <span className="setting-label" style={{ display: 'block', fontWeight: 600 }}>Current Version</span>
                                <span className="setting-description" style={{ color: 'var(--text-secondary)' }}>
                                    Rovena v{appVersion || '...'}
                                </span>
                            </div>
                            <button
                                className="btn btn-secondary"
                                onClick={handleCheckUpdates}
                                disabled={updateStatus === 'Checking for updates...' || (typeof updateStatus === 'string' && updateStatus.includes('Downloading'))}
                            >
                                {updateStatus === 'Checking for updates...' ? 'Checking...' : 'Check for updates'}
                            </button>
                        </div>

                        {updateStatus && (
                            <div className="setting-item" style={{ marginTop: 16, display: 'block', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                                <div className="status-message" style={{ color: 'var(--accent-blue)', marginBottom: 8, fontWeight: 500 }}>
                                    {updateStatus}
                                </div>

                                {/* Actions: Download / Skip / Restart */}
                                {updateAvailableInfo && !downloadProgress && updateStatus !== 'Update ready! Restart the app to install.' && (
                                    <div style={{ display: 'flex', gap: '10px', marginTop: 10 }}>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => {
                                                if ((window as any).electronAPI) {
                                                    (window as any).electronAPI.startDownload();
                                                }
                                            }}
                                        >
                                            Download Update (v{updateAvailableInfo.version})
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => {
                                                // Skip logic
                                                localStorage.setItem('skipped-version', updateAvailableInfo.version);
                                                setUpdateStatus('Version skipped.');
                                                setUpdateAvailableInfo(null);
                                                setReleaseNotes(null);
                                            }}
                                        >
                                            Skip this version
                                        </button>
                                    </div>
                                )}

                                {updateStatus === 'Update ready! Restart the app to install.' && (
                                    <button
                                        className="btn btn-primary"
                                        style={{ marginTop: 10 }}
                                        onClick={() => {
                                            if ((window as any).electronAPI) {
                                                (window as any).electronAPI.quitAndInstall();
                                            }
                                        }}
                                    >
                                        Restart and Install
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

                                {/* Fallback Download when auto-update fails or on manual macOS */}
                                {(updateStatus === 'New version detected (Manual)' || (updateError && fallbackReleaseInfo)) && (
                                    <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--accent-blue)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                            <Download size={18} style={{ color: 'var(--accent-blue)' }} />
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Manual Download (Recommended for macOS)</span>
                                        </div>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                                            {platform === 'darwin' 
                                                ? "Since the app doesn't have a signed certificate on macOS yet, you should download the new .dmg, open it and drag it to your Applications folder, replacing the current version."
                                                : "The automatic updater encountered an issue. You can download the new version manually below."}
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
                                                    Download Rovena {fallbackReleaseInfo.version} (.dmg)
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
                                                    View Release Notes
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Release Notes */}
                                {releaseNotes && (
                                    <div className="release-notes" style={{ marginTop: 16, background: 'var(--bg-secondary)', padding: 12, borderRadius: 8 }}>
                                        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>What's new in version v{updateAvailableInfo?.version}:</h4>
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
                            <h2 className="settings-section-title">Account</h2>
                            <p className="settings-section-subtitle">
                                Manage your session
                            </p>
                        </div>
                    </div>

                    <div className="account-actions">
                        <div className="account-action">
                            <div className="account-action-info">
                                <span className="account-action-label">View app tour</span>
                                <span className="account-action-description">
                                    Review the initial tutorial
                                </span>
                            </div>
                            <button className="btn btn-secondary" onClick={onShowOnboarding}>
                                <BookOpen size={18} />
                                View Tour
                            </button>
                        </div>
                        <div className="account-action">
                            <div className="account-action-info">
                                <span className="account-action-label">Log out</span>
                                <span className="account-action-description">
                                    End your current session
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
                title="Cancel Subscription"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setShowCancelModal(false)}>
                            Back
                        </button>
                        <button className="btn btn-danger" onClick={handleCancelPlan} disabled={isCanceling}>
                            {isCanceling ? 'Canceling...' : 'Yes, Cancel'}
                        </button>
                    </>
                }
            >
                <p>Are you sure you want to cancel your plan? You will maintain access to Plus features until the end of the current period, but your subscription will not be renewed.</p>
            </Modal>

            {/* Success Info Modal */}
            <Modal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                title="Success"
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