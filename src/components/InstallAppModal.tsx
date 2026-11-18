import { createPortal } from 'react-dom';
import {
  AndroidMenuDotsIcon,
  CheckIcon,
  DownloadIcon,
  IOSAddHomeIcon,
  IOSMoreDotsIcon,
  IOSShareIcon,
} from './Icons';

export type InstallModalMode = 'installed' | 'ios_guide' | 'android_guide';

interface InstallAppModalProps {
  mode: InstallModalMode;
  onClose: () => void;
  onRetryNativeInstall?: () => void;
  canTriggerNative?: boolean;
}

export function InstallAppModal({
  mode,
  onClose,
  onRetryNativeInstall,
  canTriggerNative = false,
}: InstallAppModalProps) {
  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-modal-title"
      className="fixed inset-0 z-[140] flex items-center justify-center bg-[#2D2416]/50 p-[16px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-[22px] bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0] p-[18px] animate-screen-fade"
        style={{ boxShadow: '0 4px 0 var(--border-dark), 0 12px 32px rgba(45, 36, 22, 0.24)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'installed' && (
          <div className="text-center">
            <div
              className="w-[62px] h-[62px] mx-auto rounded-full bg-[#D4F7EE] border-[2px] border-[#06D6A0] flex items-center justify-center text-[#037A5B]"
              style={{ boxShadow: '0 3px 0 #037A5B' }}
            >
              <CheckIcon size={30} strokeWidth={2.8} />
            </div>

            <h2
              id="install-modal-title"
              className="text-[18px] font-extrabold text-[#2D2416] m-0 mt-[14px]"
            >
              BữaNay đã được tải về máy!
            </h2>
            <p className="text-[13px] font-medium text-[#6B5D47] m-0 mt-[6px] leading-relaxed">
              Ứng dụng đã sẵn sàng trên màn hình chính của bạn. Bạn có thể mở trực tiếp BữaNay như một app độc lập mà không cần mở trình duyệt.
            </p>

            <div className="mt-[14px] rounded-[14px] bg-[#FFF9ED] border border-[#DDD0B0] px-[12px] py-[10px] text-[12px] font-semibold text-[#2D2416] flex items-center justify-center gap-[6px]">
              <span className="text-[#037A5B] inline-flex">
                <CheckIcon size={15} strokeWidth={2.5} />
              </span>
              <span>Đã cài đặt thành công trên thiết bị này</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full mt-[16px] py-[12px] rounded-[16px] bg-[#FF8A3D] text-white text-[14px] font-bold neo-cta cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
        )}

        {mode === 'ios_guide' && (
          <div>
            <div className="flex items-start justify-between gap-[10px]">
              <div>
                <p className="text-[10px] font-bold tracking-[0.06em] text-[#CC5F1A] m-0">
                  HƯỚNG DẪN IPHONE · SAFARI
                </p>
                <h2
                  id="install-modal-title"
                  className="text-[17px] font-extrabold text-[#2D2416] m-0 mt-[2px]"
                >
                  Đưa BữaNay ra Màn hình chính
                </h2>
              </div>
              <span className="w-[34px] h-[34px] shrink-0 rounded-full bg-[#FFEEDD] border border-[#FF8A3D]/50 flex items-center justify-center text-[#CC5F1A]">
                <DownloadIcon size={16} />
              </span>
            </div>

            {/* Visual Safari Toolbar Outline Illustration */}
            <div className="mt-[12px] rounded-[14px] bg-[#F7F2E3] border-[1.5px] border-[#DDD0B0] p-[10px]">
              <p className="text-[10px] font-bold text-[#9E8E78] m-0 mb-[8px] text-center">
                MINH HỌA THANH CÔNG CỤ TRÊN IPHONE SAFARI
              </p>

              {/* Mock Safari bar outline */}
              <div className="rounded-[12px] bg-[#FFFDF5] border border-[#DDD0B0] px-[12px] py-[8px] flex items-center justify-between text-[#9E8E78]">
                <span className="text-[13px] font-bold">‹</span>
                <span className="text-[13px] font-bold">›</span>
                <span
                  aria-hidden="true"
                  className="w-[34px] h-[34px] rounded-[10px] bg-[#FF8A3D] text-white border-[1.5px] border-[#CC5F1A] flex items-center justify-center"
                  style={{ boxShadow: '0 2px 0 #CC5F1A' }}
                >
                  <IOSShareIcon size={17} />
                </span>
                <span className="inline-flex text-[#6B5D47]" aria-hidden="true">
                  <IOSMoreDotsIcon size={17} />
                </span>
                <span className="text-[11px] font-bold text-[#9E8E78]">❐</span>
              </div>

              {/* Action row highlight */}
              <div className="mt-[8px] rounded-[10px] bg-[#FFFDF5] border border-[#06D6A0] px-[10px] py-[7px] flex items-center justify-between">
                <span className="text-[12px] font-bold text-[#2D2416]">
                  Thêm vào Màn hình chính
                </span>
                <span className="text-[#037A5B] inline-flex" aria-hidden="true">
                  <IOSAddHomeIcon size={18} />
                </span>
              </div>
            </div>

            <ol className="m-0 mt-[12px] pl-0 list-none flex flex-col gap-[8px]">
              <li className="rounded-[12px] bg-[#FFF9ED] border border-[#DDD0B0] p-[10px] flex items-start gap-[10px]">
                <span className="w-[28px] h-[28px] shrink-0 rounded-[8px] bg-[#FFEEDD] border border-[#FF8A3D]/40 text-[#CC5F1A] flex items-center justify-center">
                  <IOSShareIcon size={15} />
                </span>
                <div className="text-[12px] text-[#2D2416] leading-snug">
                  <strong className="block font-extrabold">
                    1. Bấm biểu tượng Chia sẻ (Share)
                  </strong>
                  <span className="text-[#6B5D47] font-medium">
                    Ở thanh dưới cùng Safari (hoặc bấm{' '}
                    <strong className="text-[#2D2416]">•••</strong> ở iOS mới rồi chọn{' '}
                    <strong className="text-[#2D2416]">Chia sẻ</strong>).
                  </span>
                </div>
              </li>

              <li className="rounded-[12px] bg-[#FFF9ED] border border-[#DDD0B0] p-[10px] flex items-start gap-[10px]">
                <span className="w-[28px] h-[28px] shrink-0 rounded-[8px] bg-[#D4F7EE] border border-[#06D6A0]/50 text-[#037A5B] flex items-center justify-center">
                  <IOSAddHomeIcon size={15} />
                </span>
                <div className="text-[12px] text-[#2D2416] leading-snug">
                  <strong className="block font-extrabold">
                    2. Chọn “Thêm vào Màn hình chính”
                  </strong>
                  <span className="text-[#6B5D47] font-medium">
                    Vuốt lên trong menu chia sẻ để thấy mục có dấu{' '}
                    <strong className="text-[#2D2416]">+</strong> (hoặc bấm{' '}
                    <strong className="text-[#2D2416]">Xem thêm</strong> nếu ẩn).
                  </span>
                </div>
              </li>

              <li className="rounded-[12px] bg-[#FFF9ED] border border-[#DDD0B0] p-[10px] flex items-start gap-[10px]">
                <span className="w-[28px] h-[28px] shrink-0 rounded-[8px] bg-[#D4F7EE] border border-[#06D6A0]/50 text-[#037A5B] flex items-center justify-center font-extrabold text-[12px]">
                  3
                </span>
                <div className="text-[12px] text-[#2D2416] leading-snug">
                  <strong className="block font-extrabold">
                    3. Bấm “Thêm” (Add) ở góc trên phải
                  </strong>
                  <span className="text-[#6B5D47] font-medium">
                    Biểu tượng BữaNay sẽ xuất hiện ngay trên Màn hình chính!
                  </span>
                </div>
              </li>
            </ol>

            <button
              type="button"
              onClick={onClose}
              className="w-full mt-[14px] py-[12px] rounded-[16px] bg-[#FF8A3D] text-white text-[14px] font-bold neo-cta cursor-pointer"
            >
              Đã hiểu, để mình thử ngay
            </button>
          </div>
        )}

        {mode === 'android_guide' && (
          <div>
            <div className="flex items-start justify-between gap-[10px]">
              <div>
                <p className="text-[10px] font-bold tracking-[0.06em] text-[#CC5F1A] m-0">
                  TẢI VỀ MÁY · ANDROID / CHROME
                </p>
                <h2
                  id="install-modal-title"
                  className="text-[17px] font-extrabold text-[#2D2416] m-0 mt-[2px]"
                >
                  Cài đặt BữaNay lên điện thoại
                </h2>
              </div>
              <span className="w-[34px] h-[34px] shrink-0 rounded-full bg-[#FFEEDD] border border-[#FF8A3D]/50 flex items-center justify-center text-[#CC5F1A]">
                <DownloadIcon size={16} />
              </span>
            </div>

            <div className="mt-[12px] flex flex-col gap-[8px]">
              <div className="rounded-[12px] bg-[#FFF9ED] border border-[#DDD0B0] p-[10px] flex items-start gap-[10px]">
                <span className="w-[28px] h-[28px] shrink-0 rounded-[8px] bg-[#FFEEDD] border border-[#FF8A3D]/40 text-[#CC5F1A] flex items-center justify-center">
                  <AndroidMenuDotsIcon size={16} />
                </span>
                <div className="text-[12px] text-[#2D2416] leading-snug">
                  <strong className="block font-extrabold">
                    1. Bấm dấu ba chấm (⋮) trên Chrome
                  </strong>
                  <span className="text-[#6B5D47] font-medium">
                    Ở góc trên bên phải thanh địa chỉ trình duyệt.
                  </span>
                </div>
              </div>

              <div className="rounded-[12px] bg-[#FFF9ED] border border-[#DDD0B0] p-[10px] flex items-start gap-[10px]">
                <span className="w-[28px] h-[28px] shrink-0 rounded-[8px] bg-[#D4F7EE] border border-[#06D6A0]/50 text-[#037A5B] flex items-center justify-center">
                  <DownloadIcon size={15} />
                </span>
                <div className="text-[12px] text-[#2D2416] leading-snug">
                  <strong className="block font-extrabold">
                    2. Chọn “Cài đặt ứng dụng” hoặc “Thêm vào Màn hình chính”
                  </strong>
                  <span className="text-[#6B5D47] font-medium">
                    Xác nhận Cài đặt để dùng BữaNay mượt mà toàn màn hình.
                  </span>
                </div>
              </div>
            </div>

            {canTriggerNative && onRetryNativeInstall && (
              <button
                type="button"
                onClick={onRetryNativeInstall}
                className="w-full mt-[12px] py-[11px] rounded-[14px] bg-[#06D6A0] text-[#033F2E] text-[13px] font-extrabold border-[1.5px] border-[#037A5B] cursor-pointer"
                style={{ boxShadow: '0 3px 0 #037A5B' }}
              >
                Cài đặt ngay
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full mt-[10px] py-[11px] rounded-[14px] bg-[#F2EBD8] border-[1.5px] border-[#DDD0B0] text-[13px] font-bold text-[#2D2416] cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}
