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
            setNameError('Image must be at most 5MB');
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
            setNameError('Error sending photo. Please try again.');
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
            setNameError('Error updating name. Please try again.');
        } finally {
            setIsUpdatingName(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!user || !user.email) return;

        setPasswordError('');
        setPasswordSuccess(false);

        if (!currentPassword) {
            setPasswordError('Enter your current password');
            return;
        }
        if (!newPassword) {
            setPasswordError('Enter the new password');
            return;
        }
        if (newPassword.length < 6) {
            setPasswordError('The new password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match');
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
                setPasswordError('Incorrect current password');
            } else if (error.code === 'auth/requires-recent-login') {
                setPasswordError('Please log in again to change the password');
            } else {
                setPasswordError('Error changing password. Please try again.');
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
                <h1>My Profile</h1>
            </header>

            <div className="profile-content">
                <div className="profile-card">
                    <div className="profile-photo-section">
                        {nameSuccess && (
                            <div className="success-message profile-success-top">
                                <Check size={16} />
                                Profile updated
                            </div>
                        )}
                        <div className="profile-photo" onClick={handlePhotoClick}>
                            {photoURL ? (
                                <img src={photoURL} alt="Profile photo" />
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
                        <p className="profile-photo-hint">Click to change photo</p>
                    </div>

                    <div className="profile-form-section">
                        <h3>Information</h3>

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
                                Display Name
                            </label>
                            <div className="input-with-button">
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Your name"
                                    className="form-input"
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleUpdateName}
                                    disabled={isUpdatingName || !displayName.trim()}
                                >
                                    {isUpdatingName ? <div className="spinner-small"></div> : 'Save'}
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
                                Change Password
                            </h3>

                            <div className="form-group">
                                <label>Current password</label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showCurrentPassword ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder="Enter your current password"
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
                                <label>New password</label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter the new password"
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
                                <label>Confirm new password</label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Enter the new password again"
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
                                {isUpdatingPassword ? <div className="spinner-small"></div> : 'Change Password'}
                            </button>

                            {passwordSuccess && (
                                <div className="success-message">
                                    <Check size={16} />
                                    Password changed successfully!
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
                                <span>You are logged in with Google. The password is managed by your Google account.</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Profile;