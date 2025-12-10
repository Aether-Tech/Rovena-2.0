import { useState, useRef } from 'react';
import { getAuth, updatePassword, updateProfile, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ArrowLeft, User, Mail, Lock, Camera, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

interface ProfileProps {
    onProfileUpdate?: () => void;
}

export function Profile({ onProfileUpdate }: ProfileProps) {
    const auth = getAuth();
    const user = auth.currentUser;
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
    const [isUploading, setIsUploading] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [nameSuccess, setNameSuccess] = useState(false);
    const [nameError, setNameError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [isUpdatingName, setIsUpdatingName] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    const handlePhotoClick = () => {
        fileInputRef.current?.click();
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            setNameError('A imagem deve ter no máximo 5MB');
            return;
        }

        setIsUploading(true);
        setNameError('');

        try {
            const storage = getStorage();
            const storageRef = ref(storage, `profile-photos/${user.uid}/${Date.now()}-${file.name}`);
            
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            
            await updateProfile(user, { photoURL: downloadURL });
            setPhotoURL(downloadURL);
            setNameSuccess(true);
            setTimeout(() => setNameSuccess(false), 3000);
            onProfileUpdate?.();
        } catch (error: any) {
            console.error('Error uploading photo:', error);
            setNameError('Erro ao enviar foto. Tente novamente.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleUpdateName = async () => {
        if (!user || !displayName.trim()) return;

        setIsUpdatingName(true);
        setNameError('');
        setNameSuccess(false);

        try {
            await updateProfile(user, { displayName: displayName.trim() });
            setNameSuccess(true);
            setTimeout(() => setNameSuccess(false), 3000);
            onProfileUpdate?.();
        } catch (error: any) {
            console.error('Error updating name:', error);
            setNameError('Erro ao atualizar nome. Tente novamente.');
        } finally {
            setIsUpdatingName(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!user || !user.email) return;

        setPasswordError('');
        setPasswordSuccess(false);

        if (!currentPassword) {
            setPasswordError('Digite sua senha atual');
            return;
        }
        if (!newPassword) {
            setPasswordError('Digite a nova senha');
            return;
        }
        if (newPassword.length < 6) {
            setPasswordError('A nova senha deve ter pelo menos 6 caracteres');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('As senhas não coincidem');
            return;
        }

        setIsUpdatingPassword(true);

        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            
            setPasswordSuccess(true);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPasswordSuccess(false), 3000);
        } catch (error: any) {
            console.error('Error updating password:', error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                setPasswordError('Senha atual incorreta');
            } else if (error.code === 'auth/requires-recent-login') {
                setPasswordError('Faça login novamente para alterar a senha');
            } else {
                setPasswordError('Erro ao alterar senha. Tente novamente.');
            }
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const isGoogleUser = user?.providerData?.some(p => p.providerId === 'google.com');

    return (
        <div className="profile-page">
            <header className="profile-header">
                <button className="btn btn-ghost" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                </button>
                <h1>Meu Perfil</h1>
            </header>

            <div className="profile-content">
                <div className="profile-card">
                    <div className="profile-photo-section">
                        {nameSuccess && (
                            <div className="success-message profile-success-top">
                                <Check size={16} />
                                Perfil atualizado
                            </div>
                        )}
                        <div className="profile-photo" onClick={handlePhotoClick}>
                            {photoURL ? (
                                <img src={photoURL} alt="Foto de perfil" />
                            ) : (
                                <div className="profile-photo-placeholder">
                                    {displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                                </div>
                            )}
                            <div className="profile-photo-overlay">
                                {isUploading ? (
                                    <div className="spinner-small"></div>
                                ) : (
                                    <Camera size={24} />
                                )}
                            </div>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            style={{ display: 'none' }}
                        />
                        <p className="profile-photo-hint">Clique para alterar a foto</p>
                    </div>

                    <div className="profile-form-section">
                        <h3>Informações</h3>

                        <div className="form-group">
                            <label>
                                <Mail size={16} />
                                Email
                            </label>
                            <input
                                type="email"
                                value={user?.email || ''}
                                disabled
                                className="form-input disabled"
                            />
                        </div>

                        <div className="form-group">
                            <label>
                                <User size={16} />
                                Nome de exibição
                            </label>
                            <div className="input-with-button">
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Seu nome"
                                    className="form-input"
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleUpdateName}
                                    disabled={isUpdatingName || !displayName.trim()}
                                >
                                    {isUpdatingName ? <div className="spinner-small"></div> : 'Salvar'}
                                </button>
                            </div>
                        </div>

                        {nameError && (
                            <div className="error-message">
                                <AlertCircle size={16} />
                                {nameError}
                            </div>
                        )}
                    </div>
                </div>

                {!isGoogleUser && (
                    <div className="profile-card">
                        <div className="profile-form-section">
                            <h3>
                                <Lock size={18} />
                                Alterar Senha
                            </h3>

                            <div className="form-group">
                                <label>Senha atual</label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showCurrentPassword ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder="Digite sua senha atual"
                                        className="form-input"
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    >
                                        {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Nova senha</label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Digite a nova senha"
                                        className="form-input"
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                    >
                                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Confirmar nova senha</label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Digite novamente a nova senha"
                                        className="form-input"
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                className="btn btn-primary full-width"
                                onClick={handleUpdatePassword}
                                disabled={isUpdatingPassword}
                            >
                                {isUpdatingPassword ? <div className="spinner-small"></div> : 'Alterar Senha'}
                            </button>

                            {passwordSuccess && (
                                <div className="success-message">
                                    <Check size={16} />
                                    Senha alterada com sucesso!
                                </div>
                            )}
                            {passwordError && (
                                <div className="error-message">
                                    <AlertCircle size={16} />
                                    {passwordError}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isGoogleUser && (
                    <div className="profile-card">
                        <div className="profile-form-section">
                            <div className="google-notice">
                                <AlertCircle size={18} />
                                <span>Você está logado com o Google. A senha é gerenciada pela sua conta Google.</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Profile;