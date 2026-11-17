import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Đã xảy ra lỗi không mong muốn.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh w-full bg-[#F7F2E3] flex items-center justify-center p-[20px]">
          <div className="w-full max-w-[360px] neo-card p-[20px] text-center">
            <img
              src="/assets/mascot.png"
              alt="Linh vật Mầm"
              className="w-[74px] h-[74px] object-contain mx-auto"
            />
            <h1 className="text-[18px] font-extrabold text-[#2D2416] m-0 mt-[10px]">
              Rất tiếc, BữaNay vừa gặp sự cố nhỏ
            </h1>
            <p className="text-[12px] font-medium text-[#6B5D47] m-0 mt-[6px] leading-relaxed">
              Dữ liệu cục bộ của bạn vẫn an toàn. Bạn thử tải lại trang để tiếp tục nhé.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full mt-[14px] py-[11px] rounded-[14px] bg-[#FF8A3D] text-white text-[13px] font-bold neo-cta cursor-pointer"
            >
              Tải lại ứng dụng
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
