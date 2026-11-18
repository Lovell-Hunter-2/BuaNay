import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { mapFirebaseAuthError } from '../utils/firestorePayload';
import { LegalModal, type LegalDocType } from './LegalDocumentView';

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  defaultDisplayName?: string;
  onSuccess: (info: {
    isNewSignup: boolean;
    needsEmailVerification: boolean;
    email: string;
  }) => void;
  onClose: () => void;
}

export function AuthModal({
  initialMode = 'login',
  defaultDisplayName = '',
  onSuccess,
  onClose,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Mật khẩu cần có ít nhất 6 ký tự.');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setErrorMsg('Mật khẩu nhập lại chưa khớp.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );
        const cleanName = displayName.trim();
        if (cleanName) {
          await updateProfile(cred.user, { displayName: cleanName }).catch(
            () => undefined
          );
        }
        await sendEmailVerification(cred.user).catch(() => undefined);
        onSuccess({
          isNewSignup: true,
          needsEmailVerification: !cred.user.emailVerified,
          email: cred.user.email ?? trimmedEmail,
        });
      } else {
        const cred = await signInWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );
        onSuccess({
          isNewSignup: false,
          needsEmailVerification: !cred.user.emailVerified,
          email: cred.user.email ?? trimmedEmail,
        });
      }
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      onSuccess({
        isNewSignup: false,
        needsEmailVerification: false,
        email: cred.user.email ?? '',
      });
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg('Nhập email của bạn ở ô bên trên trước rồi bấm Quên mật khẩu nhé.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setInfoMsg(
        `Đã gửi email đặt lại mật khẩu tới ${trimmedEmail}. Hãy kiểm tra cả hộp thư rác nhé.`
      );
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-[#2D2416]/55 p-[16px]"
      onClick={onClose}
    >
      <div
        data-testid="auth-modal"
        className="w-full max-w-[365px] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-[24px] bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0] p-[18px] animate-screen-fade"
        style={{
          boxShadow:
            '0 4px 0 var(--border-dark), 0 16px 38px rgba(45, 36, 22, 0.28)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-[8px]">
          <h2
            id="auth-modal-title"
            className="text-[18px] font-extrabold text-[#2D2416] m-0"
          >
            {mode === 'login' ? 'Đăng nhập BữaNay' : 'Đăng ký tài khoản'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-[10px] py-[4px] rounded-full bg-[#F2EBD8] border border-[#DDD0B0] text-[11px] font-bold text-[#6B5D47] cursor-pointer hover:text-[#2D2416]"
          >
            Đóng
          </button>
        </div>

        {/* 2D Mascot image directly above email & password fields */}
        <div className="mt-[8px] mb-[10px] flex flex-col items-center">
          <img
            src="/assets/mascot.png"
            alt="Linh vật Mầm 2D của BữaNay"
            className="w-[84px] h-[84px] object-contain"
          />
          <p className="text-[11px] font-semibold text-[#6B5D47] m-0 mt-[4px] text-center">
            {mode === 'login'
              ? 'Đăng nhập để đồng bộ nhật ký ăn uống cùng Mầm'
              : 'Tạo tài khoản bằng email & tự đặt mật khẩu riêng'}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[9px]">
          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-display-name"
                className="block text-[11px] font-bold text-[#6B5D47] mb-[4px]"
              >
                Tên gọi hiển thị (tùy chọn)
              </label>
              <input
                id="auth-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ví dụ: Ánh, Minh..."
                maxLength={60}
                className="w-full px-[12px] py-[9px] rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFF9ED] text-[13px] font-semibold text-[#2D2416] focus:outline-none focus:border-[#FF8A3D]"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-[11px] font-bold text-[#6B5D47] mb-[4px]"
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="name@example.com"
              className="w-full px-[12px] py-[9px] rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFF9ED] text-[13px] font-semibold text-[#2D2416] focus:outline-none focus:border-[#FF8A3D]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-[4px]">
              <label
                htmlFor="auth-password"
                className="text-[11px] font-bold text-[#6B5D47]"
              >
                Mật khẩu
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-[11px] font-bold text-[#CC5F1A] hover:underline cursor-pointer"
                >
                  Quên mật khẩu?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder={
                  mode === 'login' ? 'Nhập mật khẩu' : 'Tự đặt mật khẩu (tối thiểu 6 ký tự)'
                }
                className="w-full px-[12px] py-[9px] pr-[52px] rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFF9ED] text-[13px] font-semibold text-[#2D2416] focus:outline-none focus:border-[#FF8A3D]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#6B5D47] hover:text-[#2D2416] cursor-pointer"
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-confirm-password"
                className="block text-[11px] font-bold text-[#6B5D47] mb-[4px]"
              >
                Nhập lại mật khẩu
              </label>
              <input
                id="auth-confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Nhập lại mật khẩu vừa đặt"
                className="w-full px-[12px] py-[9px] rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFF9ED] text-[13px] font-semibold text-[#2D2416] focus:outline-none focus:border-[#FF8A3D]"
              />
            </div>
          )}

          {errorMsg && (
            <p
              role="alert"
              className="text-[11px] font-semibold text-[#C94A4A] bg-[#FFE8E8] border border-[#FF6B6B]/40 rounded-[10px] px-[10px] py-[8px] m-0 leading-snug"
            >
              {errorMsg}
            </p>
          )}

          {infoMsg && (
            <p
              role="status"
              className="text-[11px] font-semibold text-[#037A5B] bg-[#D4F7EE] border border-[#06D6A0]/50 rounded-[10px] px-[10px] py-[8px] m-0 leading-snug"
            >
              {infoMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-[2px] py-[11px] rounded-[14px] bg-[#FF8A3D] text-white text-[14px] font-extrabold neo-cta cursor-pointer disabled:opacity-60"
          >
            {loading
              ? 'Đang xử lý...'
              : mode === 'login'
              ? 'Đăng nhập'
              : 'Đăng ký tài khoản'}
          </button>
        </form>

        {/* - hoặc - divider */}
        <div className="my-[12px] flex items-center gap-[10px]">
          <div className="h-[1px] flex-1 bg-[#E5DEC9]" />
          <span className="text-[11px] font-bold text-[#9E8E78]">hoặc</span>
          <div className="h-[1px] flex-1 bg-[#E5DEC9]" />
        </div>

        {/* Google Sign-In button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-[10px] px-[12px] rounded-[14px] bg-white border-[1.5px] border-[#DDD0B0] hover:border-[#FF8A3D] text-[13px] font-extrabold text-[#2D2416] flex items-center justify-center gap-[9px] cursor-pointer transition-colors disabled:opacity-60"
          style={{ boxShadow: '0 2px 0 var(--border-dark)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.4c-.24 1.25-.96 2.31-2.05 3.02l3.31 2.57c1.93-1.78 3.04-4.4 3.04-7.49 0-.72-.06-1.41-.19-2.08H12z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.31-2.57c-.92.62-2.1.99-3.31.99-2.54 0-4.7-1.72-5.47-4.03H3.11v2.65C4.76 19.89 8.12 22 12 22z"
            />
            <path
              fill="#4A90E2"
              d="M6.53 13.96A5.98 5.98 0 0 1 6.2 12c0-.68.12-1.34.33-1.96V7.39H3.11A9.97 9.97 0 0 0 2 12c0 1.61.38 3.13 1.11 4.61l3.42-2.65z"
            />
            <path
              fill="#FBBC05"
              d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.87-2.87C16.95 3.01 14.69 2 12 2 8.12 2 4.76 4.11 3.11 7.39l3.42 2.65C7.3 7.73 9.46 6.01 12 6.01z"
            />
          </svg>
          <span>Đăng nhập bằng Google</span>
        </button>

        {/* Register / Switch mode action */}
        <button
          type="button"
          onClick={() => {
            setMode((prev) => (prev === 'login' ? 'register' : 'login'));
            setErrorMsg(null);
            setInfoMsg(null);
          }}
          className="w-full mt-[9px] py-[9px] rounded-[13px] bg-[#FFF9ED] border border-[#DDD0B0] hover:border-[#FF8A3D] text-[12px] font-extrabold text-[#CC5F1A] cursor-pointer transition-colors"
        >
          {mode === 'login'
            ? 'Chưa có tài khoản? Đăng ký ngay'
            : 'Đã có tài khoản? Quay lại đăng nhập'}
        </button>

        {/* Bottom 1-row Terms of Service & Privacy Policy on left and right */}
        <div className="mt-[14px] pt-[10px] border-t border-[#EDE5CC] flex items-center justify-between gap-[10px]">
          <button
            type="button"
            onClick={() => setLegalDoc('terms')}
            className="text-[11px] font-bold text-[#6B5D47] hover:text-[#CC5F1A] underline underline-offset-2 cursor-pointer"
          >
            Điều khoản dịch vụ
          </button>
          <button
            type="button"
            onClick={() => setLegalDoc('privacy')}
            className="text-[11px] font-bold text-[#6B5D47] hover:text-[#CC5F1A] underline underline-offset-2 cursor-pointer"
          >
            Chính sách bảo mật
          </button>
        </div>
      </div>

      {legalDoc && (
        <LegalModal docType={legalDoc} onClose={() => setLegalDoc(null)} />
      )}
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
