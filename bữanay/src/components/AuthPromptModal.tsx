import { createPortal } from 'react-dom';

interface AuthPromptModalProps {
  actionLabel?: string;
  onOpenAuth: () => void;
  onClose: () => void;
}

export function AuthPromptModal({
  actionLabel,
  onOpenAuth,
  onClose,
}: AuthPromptModalProps) {
  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-prompt-title"
      className="fixed inset-0 z-[145] flex items-center justify-center bg-[#2D2416]/50 p-[16px]"
      onClick={onClose}
    >
      <div
        data-testid="auth-prompt-modal"
        className="w-full max-w-[350px] rounded-[24px] bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0] p-[20px] text-center animate-screen-fade"
        style={{
          boxShadow:
            '0 4px 0 var(--border-dark), 0 14px 36px rgba(45, 36, 22, 0.24)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src="/assets/mascot.png"
          alt="Linh vật Mầm 2D"
          className="w-[82px] h-[82px] object-contain mx-auto"
        />

        <p className="text-[10px] font-extrabold tracking-[0.06em] text-[#CC5F1A] m-0 mt-[8px] uppercase">
          BẠN CHƯA ĐĂNG NHẬP
        </p>
        <h2
          id="auth-prompt-title"
          className="text-[19px] font-extrabold text-[#2D2416] m-0 mt-[4px]"
        >
          Đăng nhập để dùng tính năng này
        </h2>
        <p className="text-[12px] font-medium text-[#6B5D47] m-0 mt-[8px] leading-relaxed">
          {actionLabel
            ? `Bạn cần đăng nhập tài khoản để ${actionLabel} và đồng bộ dữ liệu dinh dưỡng an toàn trên đám mây.`
            : 'Bạn cần đăng nhập tài khoản để lưu nhật ký bữa ăn, đồng bộ Firestore và sử dụng đầy đủ các tính năng cá nhân hóa.'}
        </p>

        <button
          type="button"
          onClick={onOpenAuth}
          className="w-full mt-[16px] py-[12px] rounded-[15px] bg-[#FF8A3D] text-white text-[14px] font-extrabold neo-cta cursor-pointer"
        >
          Đăng nhập / Đăng ký ngay
        </button>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-[8px] py-[10px] rounded-[14px] bg-[#F2EBD8] border border-[#DDD0B0] text-[12px] font-bold text-[#6B5D47] hover:text-[#2D2416] cursor-pointer"
        >
          Để sau, tôi chỉ xem trước
        </button>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
}
