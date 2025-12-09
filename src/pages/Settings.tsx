import { useState } from 'react';
import {
    CreditCard,
    Zap,
    Key,
    LogOut,
    ExternalLink,
} from 'lucide-react';
import { cancelSubscription } from '../services/firebase';
import './Settings.css';

interface SettingsProps {
    userEmail?: string;
    userPlan?: 'free' | 'plus';
    tokensUsed?: number;
    tokensLimit?: number;
    subscriptionId?: string;
    onLogout?: () => void;
    onCancelPlan?: () => Promise<void>;
}

export function Settings({
    userEmail,
    userPlan,
    tokensUsed = 0,
    tokensLimit = 10000,
    subscriptionId,
    onLogout,
    onCancelPlan,
}: SettingsProps) {
    const [useCustomAPI, setUseCustomAPI] = useState(false);
    const [customOpenAIKey, setCustomOpenAIKey] = useState('');
    const [isCanceling, setIsCanceling] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const tokensRemaining = tokensLimit - tokensUsed;
    const tokenPercentage = tokensLimit > 0 ? Math.round((tokensRemaining / tokensLimit) * 100) : 0;

    const formatNumber = (num: number) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(0) + 'K';
        }
        return num.toString();
    };

    const handleCancelPlan = async () => {
        if (!subscriptionId) {
            alert('Nenhuma assinatura ativa encontrada.');
            return;
        }

        if (!window.confirm('Tem certeza que deseja cancelar seu plano? Você perderá acesso aos recursos Plus.')) {
            return;
        }

        setIsCanceling(true);
        try {
            // Call Stripe cancellation via Firebase Function
            await cancelSubscription({ subscriptionId });
            alert('Plano cancelado com sucesso. Você manterá acesso até o fim do período atual.');
            if (onCancelPlan) {
                await onCancelPlan();
            }
        } catch (error) {
            console.error('Error canceling plan:', error);
            alert('Erro ao cancelar plano. Tente novamente.');
        } finally {
            setIsCanceling(false);
        }
    };

    const handleSaveCustomAPI = async () => {
        if (!customOpenAIKey.startsWith('sk-')) {
            alert('A chave da API deve começar com "sk-"');
            return;
        }

        setIsSaving(true);
        try {
            // Save to localStorage for now (in production, save to Firestore)
            localStorage.setItem('rovena-custom-openai-key', customOpenAIKey);
            alert('Configurações salvas com sucesso!');
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
                                onClick={handleCancelPlan}
                                disabled={isCanceling}
                            >
                                {isCanceling ? 'Cancelando...' : 'Cancelar Plano'}
                            </button>
                        ) : userPlan !== 'plus' ? (
                            <a
                                href="https://buy.stripe.com/your-link"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary"
                            >
                                <Zap size={18} />
                                Fazer Upgrade para Plus
                                <ExternalLink size={14} />
                            </a>
                        ) : null}
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
        </div>
    );
}

export default Settings;
