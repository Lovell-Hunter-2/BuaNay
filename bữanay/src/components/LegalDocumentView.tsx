import { createPortal } from 'react-dom';
import { ArrowLeftIcon } from './Icons';

export type LegalDocType = 'privacy' | 'terms';

interface LegalSection {
  title: string;
  body: string;
}

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: '1. Dữ liệu chúng tôi xử lý',
    body: 'BữaNay chỉ thu thập các thông tin bạn chủ động cung cấp để cá nhân hóa trải nghiệm: tên hiển thị, độ tuổi, giới tính, chiều cao, cân nặng, mục tiêu dinh dưỡng, sở thích/dị ứng thực phẩm, nhật ký bữa ăn, lượng nước uống và hình ảnh món ăn bạn tải lên để phân tích.',
  },
  {
    title: '2. Cách sử dụng thông tin & AI',
    body: 'Thông số cơ thể được dùng để tính BMI, BMR, TDEE và nhu cầu dinh dưỡng khuyến nghị. Ảnh chụp hoặc mô tả món ăn chỉ được gửi qua kết nối bảo mật tới dịch vụ AI để ước tính calories và thành phần dinh dưỡng. BữaNay tuyệt đối không bán, cho thuê hoặc chia sẻ dữ liệu ăn uống/sức khỏe cho bên thứ ba để quảng cáo.',
  },
  {
    title: '3. Lưu trữ & Đăng nhập tài khoản',
    body: 'Khi chưa đăng nhập, dữ liệu xem thử được lưu cục bộ trên thiết bị của bạn. Khi đăng nhập bằng Email/Mật khẩu hoặc Google (qua Firebase Authentication), hồ sơ dinh dưỡng, bữa ăn, nước uống và cân nặng được lưu trữ riêng tư trên Cloud Firestore theo mã định danh tài khoản để đồng bộ an toàn giữa các thiết bị.',
  },
  {
    title: '4. Quyền kiểm soát & Xóa dữ liệu',
    body: 'Bạn có toàn quyền chỉnh sửa hồ sơ, xóa từng bữa ăn, đăng xuất hoặc xóa toàn bộ dữ liệu bất kỳ lúc nào ngay trong mục Hồ sơ của ứng dụng.',
  },
];

const TERMS_SECTIONS: LegalSection[] = [
  {
    title: '1. Phạm vi hỗ trợ & Miễn trừ y tế',
    body: 'BữaNay là ứng dụng hỗ trợ theo dõi thói quen ăn uống và gợi ý thực đơn tham khảo. Các chỉ số BMI, nhu cầu calo và báo cáo dinh dưỡng không thay thế tư vấn, chẩn đoán hoặc phác đồ điều trị từ bác sĩ hay chuyên gia dinh dưỡng.',
  },
  {
    title: '2. Tính chất ước tính của phân tích AI',
    body: 'Kết quả nhận diện món ăn, khẩu phần, calories và các nhóm chất từ hình ảnh là giá trị ước tính tham khảo. Bạn luôn có thể chỉnh sửa trực tiếp các thông số này trước khi lưu vào nhật ký.',
  },
  {
    title: '3. Trách nhiệm của người dùng',
    body: 'Người dùng từ 14 tuổi trở lên tự chịu trách nhiệm kiểm tra kỹ thông tin dị ứng thực phẩm, bệnh lý nền và điều chỉnh khẩu phần phù hợp với thể trạng thực tế của bản thân.',
  },
  {
    title: '4. Cập nhật điều khoản',
    body: 'Chính sách và điều khoản có thể được cập nhật theo từng giai đoạn nâng cấp tính năng và sẽ luôn được công khai minh bạch tại ứng dụng.',
  },
];

export function LegalContentBody({ docType }: { docType: LegalDocType }) {
  const sections = docType === 'privacy' ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  return (
    <div className="flex flex-col gap-[10px]">
      {sections.map((sec) => (
        <section
          key={sec.title}
          className="rounded-[14px] bg-[#FFF9ED] border border-[#DDD0B0] p-[12px]"
        >
          <h3 className="text-[13px] font-extrabold text-[#2D2416] m-0">
            {sec.title}
          </h3>
          <p className="text-[12px] font-medium text-[#6B5D47] m-0 mt-[4px] leading-relaxed">
            {sec.body}
          </p>
        </section>
      ))}
    </div>
  );
}

export function LegalModal({
  docType,
  onClose,
}: {
  docType: LegalDocType;
  onClose: () => void;
}) {
  const isPrivacy = docType === 'privacy';
  const title = isPrivacy ? 'Chính sách bảo mật' : 'Điều khoản sử dụng';
  const routePath = isPrivacy ? '/privacy' : '/terms';

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#2D2416]/50 p-[16px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-[22px] bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0] p-[18px] animate-screen-fade"
        style={{
          boxShadow:
            '0 4px 0 var(--border-dark), 0 12px 32px rgba(45, 36, 22, 0.24)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-[10px] mb-[12px]">
          <div>
            <p className="text-[10px] font-bold tracking-[0.06em] text-[#037A5B] m-0 uppercase">
              BỮANAY · MINH BẠCH DỮ LIỆU
            </p>
            <h2
              id="legal-modal-title"
              className="text-[18px] font-extrabold text-[#2D2416] m-0 mt-[2px]"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-[10px] py-[5px] rounded-full bg-[#F2EBD8] border border-[#DDD0B0] text-[11px] font-bold text-[#6B5D47] cursor-pointer"
          >
            Đóng
          </button>
        </div>

        <LegalContentBody docType={docType} />

        <div className="mt-[12px] flex items-center justify-between gap-[8px]">
          <a
            href={routePath}
            className="text-[11px] font-bold text-[#037A5B] underline underline-offset-2"
          >
            Mở liên kết công khai ({routePath})
          </a>
          <span className="text-[10px] font-semibold text-[#9E8E78]">
            Cập nhật 11/2026
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-[12px] py-[11px] rounded-[14px] bg-[#FF8A3D] text-white text-[13px] font-bold neo-cta cursor-pointer"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}

export function LegalStandalonePage({
  docType,
  onBackToApp,
}: {
  docType: LegalDocType;
  onBackToApp: () => void;
}) {
  const isPrivacy = docType === 'privacy';
  const title = isPrivacy ? 'Chính sách bảo mật' : 'Điều khoản sử dụng';

  return (
    <div className="min-h-dvh w-full bg-[#F7F2E3] flex justify-center">
      <main className="w-full max-w-[460px] md:max-w-[760px] px-[20px] md:px-[28px] py-[24px] md:py-[36px]">
        <div className="flex items-center justify-between gap-[10px] mb-[16px]">
          <button
            type="button"
            onClick={onBackToApp}
            className="px-[12px] py-[8px] rounded-full bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0] text-[12px] font-bold text-[#2D2416] flex items-center gap-[6px] cursor-pointer"
            style={{ boxShadow: '0 2px 0 var(--border-dark)' }}
          >
            <ArrowLeftIcon size={15} />
            <span>Về BữaNay</span>
          </button>

          <div className="flex items-center gap-[10px] text-[11px] font-bold">
            <a
              href="/privacy"
              className={
                isPrivacy
                  ? 'text-[#CC5F1A] underline underline-offset-2'
                  : 'text-[#6B5D47]'
              }
            >
              Chính sách bảo mật
            </a>
            <span className="text-[#DDD0B0]">·</span>
            <a
              href="/terms"
              className={
                !isPrivacy
                  ? 'text-[#CC5F1A] underline underline-offset-2'
                  : 'text-[#6B5D47]'
              }
            >
              Điều khoản sử dụng
            </a>
          </div>
        </div>

        <article className="neo-card p-[18px]">
          <p className="text-[11px] font-bold tracking-[0.06em] text-[#037A5B] m-0">
            BỮANAY · TRỢ LÝ DINH DƯỠNG CÁ NHÂN
          </p>
          <h1 className="text-[22px] font-extrabold text-[#2D2416] m-0 mt-[4px] mb-[14px]">
            {title}
          </h1>
          <LegalContentBody docType={docType} />
          <p className="text-[11px] font-semibold text-[#9E8E78] m-0 mt-[14px]">
            Cập nhật lần cuối: 11/2026 · Mọi thắc mắc hoặc yêu cầu xóa dữ liệu có thể thực hiện trực tiếp tại mục Hồ sơ trong ứng dụng.
          </p>
        </article>
      </main>
    </div>
  );
}
