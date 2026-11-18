# 🌱 BữaNay — Trợ lý dinh dưỡng Mầm

> **Ứng dụng theo dõi dinh dưỡng, ghi nhận bữa ăn và gợi ý thực đơn thông minh dành cho người Việt trẻ** — kết hợp linh vật 3D tương tác, kho 270+ món Việt "0 token", kiến trúc AI đa tầng tự chuyển mạch khi hết quota và hệ thống điều hành `/admin` phân quyền chặt chẽ trên Firebase.

---

## ✨ Điểm nổi bật của BữaNay

### 1. Giao diện Soft Neo-Brutalism riêng cho Desktop & Mobile
- **Hai bố cục tối ưu theo thiết bị**:
  - **Máy tính (`DesktopTopNav`)**: Thanh điều hướng dạng viên nang đặt nổi bật phía trên giữa màn hình, lưới thông tin đa cột thoáng mắt, xem tổng quan calo, macro, streak và nhật ký trong một tầm nhìn.
  - **Điện thoại (`BottomNav`)**: Tối ưu thao tác một tay với thanh điều hướng dưới và nút **Chụp / Ghi bữa** ở vị trí trung tâm.
- **Mở app dùng ngay không ép đăng nhập**: Người dùng mới vào thẳng màn hình chính với mức tham khảo khoa học; khi sẵn sàng có thể đăng nhập Google / Email để đồng bộ tức thì hồ sơ và nhật ký lên Cloud.
- **Linh vật 3D "Mầm" (`Three.js`)**: Render mô hình 3D trực tiếp trong trình duyệt (`mascot_mam.glb`), ánh mắt dõi theo con trỏ, biểu cảm thay đổi theo tiến độ dinh dưỡng trong ngày, kèm widget kéo thả ghim cạnh màn hình để hỏi đáp nhanh.

### 2. Thời tiết & Nhịp sinh học thời gian thực (Open-Meteo)
- Tích hợp **Open-Meteo API** (múi giờ `Asia/Bangkok`) qua proxy `GET /api/weather` (cache 10 phút trên server) và tự fallback gọi trực tiếp trình duyệt khi chạy bản build tĩnh (như Vercel).
- Tự động hiển thị biểu tượng ngày/đêm (`☀️` / `🌙`), thứ ngày, **nhiệt độ thời gian thực (`°C`)** và lời chào thông minh theo buổi (`Chào buổi sáng / trưa / chiều / tối`).

### 3. Ghi nhận bữa ăn AI & Kho 270+ món Việt "0 Token"
- **Ghi bữa bằng chữ hoặc chụp ảnh món ăn**: Phân tích đủ **Calories, Đạm, Tinh bột, Chất xơ, Chất béo**, cùng chỉ số vi chất **Natri (mg)** và **Đường thêm (g)**.
- **Tinh chỉnh theo ngữ cảnh ăn thực tế**: Hỗ trợ ngữ cảnh nhanh (`Ít cơm`, `Nhiều cơm`, `Ăn một nửa`, `Tự nấu ít dầu`) và thanh điều chỉnh khẩu phần trực tiếp.
- **Tối ưu chi phí & tốc độ**:
  - Kho **270+ món Việt Nam** được tách batch JSON cục bộ (`src/data/dishes/`) giúp tra cứu, gợi ý và đổi món phổ biến với **0 token API** và phản hồi gần như tức thì.
  - Chỉ gọi Vision / LLM khi nhận diện ảnh thật hoặc món ăn kết hợp phức tạp.

### 4. Gợi ý món ăn thông minh theo ngân sách VNĐ & Đổi món dinh dưỡng
- **Chế độ Ăn ngoài / Đặt món**: Chọn nhanh theo 4 khoảng ngân sách quen thuộc (**Dưới 50k**, **50k–80k**, **85k–150k**, **Trên 150k**) hoặc tự nhập ngân sách mong muốn.
- **Chế độ Tự nấu tại nhà**: Gợi ý món tận dụng nguyên liệu đang có trong tủ lạnh, khớp với dụng cụ bếp, trình độ nấu và quỹ thời gian, kèm định lượng nguyên liệu & các bước nấu.
- **Đổi món & Mẹo dinh dưỡng**: Tập trung vào cân bằng dưỡng chất và gợi ý thay thế thực tế, cô đọng, tránh lặp lại các món người dùng đã đánh dấu không hợp hoặc dị ứng.

### 5. Chỉ số cơ thể chuẩn châu Á, Nước uống & Báo cáo Tuần / Tháng
- Tự động tính **BMI theo chuẩn WHO châu Á**, **TDEE**, mức calo mục tiêu và tỷ lệ Macro khuyến nghị theo **Mifflin-St Jeor**.
- Theo dõi **lượng nước uống (+200ml)**, lịch sử **cân nặng**, **chuỗi ngày streak thật** (chỉ tính ngày có ghi bữa thật) và tổng kết trực quan **7 ngày / 30 ngày**.
- Hỗ trợ cài đặt **PWA (Progressive Web App)** lên màn hình chính điện thoại và máy tính.

### 6. Kiến trúc AI đa tầng tự chuyển mạch & Cooldown (Circuit Breaker)
Toàn bộ API Key AI được bảo vệ tuyệt đối ở **server (`server.ts`)**, không bao giờ lộ ra client. Khi một nhà cung cấp chạm giới hạn hoặc gặp sự cố, hệ thống tự chuyển mạch mượt mà trong **cùng một request**:

```text
1. Google Gemini (gemini-4-hydrogen ──[429/503]──▶ gemini-3.1-flash-lite)
        │ [hết quota / lỗi]
        ▼
2. Groq Cloud (llama-3.3-70b-versatile · Vision: llama-4-scout-17b)
        │ [lỗi / chưa cấu hình]
        ▼
3. OpenRouter (openrouter/free)
        │ [lỗi / chưa cấu hình]
        ▼
4. Cloudflare Workers AI (llama-3.3-70b-instruct · Vision: llama-3.2-11b-vision)
        │ [tất cả đều tạm gián đoạn]
        ▼
5. Kho dinh dưỡng cục bộ (0 Token Fallback ở client)
```

- **Smart Cooldown (Circuit Breaker)**: Provider nào trả `429 / RESOURCE_EXHAUSTED` được tạm nghỉ **60 giây** (hoặc **5 phút** nếu lỗi auth `401/403`), giúp các lượt gọi kế tiếp nhảy thẳng sang provider dự phòng trong `~0ms` thay vì chờ lỗi lặp lại.

### 7. Hệ thống Điều hành & Kiểm duyệt `/admin` (RBAC theo Email)
Dashboard `/admin` được thiết kế đồng bộ hoàn toàn theo phong cách Soft Neo-Brutalism của BữaNay và bảo vệ kép từ UI tới **Firebase Security Rules (`firestore.rules`)**:

| Quyền hạn | Quản trị viên (`admin`) | Kiểm duyệt viên (`moderator`) |
| :--- | :---: | :---: |
| Xem tổng quan, biểu đồ mục tiêu, AI telemetry & nhật ký hoạt động | ✅ | ✅ |
| Xem danh sách & tra cứu thông tin thành viên | ✅ | ✅ |
| Đề xuất món mới vào kho cộng đồng | ✅ Đăng ngay (`approved`) | ⏳ Bắt buộc **Chờ duyệt (`pending`)** |
| Duyệt / từ chối món chờ duyệt, bật/tắt hoặc xóa món | ✅ | ❌ |
| **Kick / Gỡ chặn** thành viên hoặc nhân sự vi phạm | ✅ | ❌ |
| Bổ nhiệm Quản trị viên / Kiểm duyệt viên chỉ bằng **Email** | ✅ | ❌ |
| Thay đổi cấu hình hệ thống (`/appConfig/runtime`, banner, chế độ AI) | ✅ | ❌ |

---

## 🛠️ Công nghệ sử dụng

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Motion, Lucide Icons, `three` (3D Mascot), `vite-plugin-pwa`.
- **Backend / Proxy**: Node.js + Express (`server.ts`) xử lý AI multi-provider fallback, Open-Meteo proxy (`/api/weather`) và telemetry (`/api/admin/telemetry`).
- **Database & Auth**: Firebase Authentication + Cloud Firestore với Security Rules kiểm tra bởi `@firebase/eslint-plugin-security-rules`.
- **Unit Testing**: Node native test runner qua `tsx --test`.

---

## 📁 Cấu trúc thư mục chính

```text
├── api/                         # Vercel Serverless Functions (/api/analyze-meal, suggest-meals, weather, health, admin/telemetry)
├── server/
│   └── apiApp.ts                # Core Express API, AI multi-provider failover & Open-Meteo proxy
├── server.ts                    # Node/Express entrypoint gắn Vite (dev) hoặc dist/ (prod)
├── firestore.rules              # Security Rules kiểm soát RBAC admin/moderator & kickedUsers
├── firebase-blueprint.json      # Schema chuẩn hóa các collection trên Firestore
├── vercel.json                  # Rewrite SPA cho /admin, /privacy, /terms
├── public/
│   └── assets/                  # Mascot 2D/3D (mascot.png, mascot_mam.glb) & tài nguyên PWA
└── src/
    ├── App.tsx                  # Điều phối trạng thái đồng bộ Cloud/Local, routing /admin & PWA
    ├── data/dishes/             # Kho 270+ món Việt Nam chia batch JSON (0 token)
    ├── hooks/                   # Custom hooks (Open-Meteo weather, PWA install prompt...)
    ├── services/                # Kết nối Firestore người dùng & quản trị, fallback phân tích
    ├── utils/                   # Công thức dinh dưỡng, parser thời tiết, payload builders & unit tests
    └── components/
        ├── DesktopTopNav.tsx    # Header & thanh điều hướng phía trên cho máy tính
        ├── DashboardScreen.tsx  # Màn hình chính Mobile/Desktop + widget nước, streak, Mầm 3D
        ├── LogMealScreen.tsx    # Chụp ảnh / nhập chữ phân tích món ăn + ngữ cảnh
        ├── MealSuggestionsScreen.tsx # Gợi ý ăn ngoài (khoảng giá VNĐ), tự nấu & đổi món
        ├── ReportsScreen.tsx    # Báo cáo tuần/tháng, cân nặng & nhận xét dinh dưỡng
        ├── GuideHandbookScreen.tsx   # Cẩm nang dinh dưỡng & HDSD
        ├── MamMascot3D.tsx      # Renderer Three.js cho linh vật Mầm
        └── AdminDashboardPage.tsx    # Giao diện điều hành /admin 5 phân hệ
```

---

## 🚀 Cài đặt & Chạy cục bộ

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Cấu hình biến môi trường
Sao chép file `.env.example` thành `.env` và điền các biến cần thiết:

```bash
cp .env.example .env
```

Các biến môi trường hỗ trợ (cấu hình phía server):
- `GEMINI_API_KEY`: API key chính (Google Gemini).
- `GROQ_API_KEY` *(tùy chọn dự phòng 1)*: Key miễn phí tại [console.groq.com](https://console.groq.com).
- `OPENROUTER_API_KEY` *(tùy chọn dự phòng 2)*: Key miễn phí tại [openrouter.ai](https://openrouter.ai).
- `CLOUDFLARE_API_TOKEN` & `CLOUDFLARE_ACCOUNT_ID` *(tùy chọn dự phòng 3)*: Workers AI tại [dash.cloudflare.com](https://dash.cloudflare.com).
- `OPEN_METEO_API_URL`: Mặc định trỏ sẵn tọa độ Hà Nội (`21.0285, 105.8542`, `Asia/Bangkok`), không bắt buộc API key.

### 3. Các lệnh phát triển & kiểm thử

| Lệnh | Chức năng |
| :--- | :--- |
| `npm run dev` | Chạy Express + Vite dev server trên cổng `3000` |
| `npm run build` | Đóng gói bản production với Vite |
| `npm run lint` | Kiểm tra toàn bộ kiểu TypeScript (`tsc --noEmit`) |
| `npx tsx --test src/utils/*.test.ts` | Chạy bộ unit tests (dinh dưỡng, thời tiết, phân quyền, kho món) |
| `npx eslint firestore.rules` | Kiểm tra cú pháp & bảo mật của `firestore.rules` |
| `npm start` | Chạy server production (`node server.ts`) |

---

## 🌐 Triển khai (Deployment)

- **Vercel (Vite + Serverless Functions)**: Đẩy toàn bộ repo (bao gồm thư mục `api/`, `server/`, `vercel.json`) lên GitHub, khai báo các biến môi trường ở phần **Production** trong Vercel Project Settings và Redeploy; cả frontend lẫn toàn bộ route `/api/*` sẽ tự động chạy đầy đủ.
- **Node.js Full-stack (Cloud Run / Render / Railway)**: Dùng `npm run build` rồi chạy `npm start` (`node server.ts`).
