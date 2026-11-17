import { useRef, useState, type ChangeEvent } from 'react';
import { loadDishBank } from '../data/dishes';
import type {
  AnalyzedMealResult,
  ContextOption,
  MealEntry,
  MealSlot,
} from '../types/nutrition';
import { matchMealAnalysisFromBank } from '../utils/dishMatcher';
import { compressImageFileToDataUrl } from '../utils/image';
import {
  CONTEXT_OPTIONS,
  MEAL_SLOTS,
  normalizeAnalysisPayload,
  parseApiJson,
  scaleAnalyzedMeal,
} from '../utils/nutrition';
import { ArrowLeftIcon, CameraIcon, CheckIcon } from './Icons';

interface LogMealScreenProps {
  defaultSlot: MealSlot;
  onBack: () => void;
  onOpenSuggestions: () => void;
  onSaveMeal: (meal: Omit<MealEntry, 'id'>) => void;
}

const PORTION_MULTIPLIERS = [
  { label: '0.5×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '1.5×', value: 1.5 },
];

export function LogMealScreen({
  defaultSlot,
  onBack,
  onOpenSuggestions,
  onSaveMeal,
}: LogMealScreenProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resultSectionRef = useRef<HTMLElement | null>(null);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedContexts, setSelectedContexts] = useState<ContextOption[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>(defaultSlot);
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [baseAnalysis, setBaseAnalysis] = useState<AnalyzedMealResult | null>(
    null
  );
  const [portionScale, setPortionScale] = useState<number>(1);
  const [contextDirty, setContextDirty] = useState(false);
  const [isEditingResult, setIsEditingResult] = useState(false);
  const [analysisSource, setAnalysisSource] = useState<
    'local_bank' | 'gemini_ai' | null
  >(null);

  const displayedResult = baseAnalysis
    ? scaleAnalyzedMeal(baseAnalysis, portionScale)
    : null;

  const updateEditableField = (
    field:
      | 'name'
      | 'portionEstimate'
      | 'calories'
      | 'protein'
      | 'carbs'
      | 'fiber'
      | 'fat'
      | 'sodiumMg'
      | 'sugarG',
    rawValue: string
  ) => {
    if (!baseAnalysis) return;
    if (field === 'name' || field === 'portionEstimate') {
      setBaseAnalysis({ ...baseAnalysis, [field]: rawValue });
      return;
    }
    const parsed = Math.max(0, Math.round(Number(rawValue) || 0));
    const safeScale = portionScale > 0 ? portionScale : 1;
    setBaseAnalysis({
      ...baseAnalysis,
      [field]: Math.round(parsed / safeScale),
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageFileToDataUrl(file);
      setPhotoPreview(compressedDataUrl);
      setErrorMessage(null);
      setBaseAnalysis(null);
      setAnalysisSource(null);
      setPortionScale(1);
      setContextDirty(false);
    } catch {
      setErrorMessage('Không thể đọc ảnh này. Vui lòng chọn ảnh JPEG hoặc PNG khác.');
    }
  };

  const toggleContext = (option: ContextOption) => {
    setSelectedContexts((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
    if (baseAnalysis) {
      setContextDirty(true);
    }
  };

  const handleAnalyze = async (forceAi = false) => {
    const trimmedDesc = description.trim();
    if (!photoPreview && !trimmedDesc) {
      setErrorMessage(
        'Vui lòng chụp/tải ảnh món ăn hoặc mô tả bữa ăn bằng chữ trước nhé!'
      );
      return;
    }

    setErrorMessage(null);
    setIsAnalyzing(true);
    setContextDirty(false);

    try {
      if (!photoPreview && !forceAi) {
        const dishes = await loadDishBank();
        const localHit = matchMealAnalysisFromBank(
          trimmedDesc,
          selectedContexts,
          dishes
        );
        if (localHit) {
          setBaseAnalysis(localHit.analysis);
          setAnalysisSource('local_bank');
          setPortionScale(1);
          setIsEditingResult(false);
          window.requestAnimationFrame(() => {
            resultSectionRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
            });
          });
          return;
        }
      }

      const response = await fetch('/api/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: trimmedDesc,
          contexts: selectedContexts,
          slot: selectedSlot,
          imageDataUrl: photoPreview ?? undefined,
        }),
      });

      const payload = await parseApiJson<{
        analysis?: Partial<AnalyzedMealResult>;
        error?: string;
      }>(response);

      if (!response.ok || !payload.analysis) {
        throw new Error(
          payload.error || 'Không thể phân tích món ăn. Vui lòng thử lại.'
        );
      }

      const normalized = normalizeAnalysisPayload(
        payload.analysis,
        selectedContexts
      );
      setBaseAnalysis(normalized);
      setAnalysisSource('gemini_ai');
      setPortionScale(1);
      setIsEditingResult(false);

      window.requestAnimationFrame(() => {
        resultSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể kết nối tới dịch vụ AI phân tích bữa ăn.';
      setErrorMessage(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = () => {
    if (!displayedResult) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    onSaveMeal({
      slot: selectedSlot,
      name: displayedResult.name,
      time: `${hh}:${mm}`,
      calories: displayedResult.calories,
      protein: displayedResult.protein,
      carbs: displayedResult.carbs,
      fiber: displayedResult.fiber,
      fat: displayedResult.fat,
      sodiumMg: displayedResult.sodiumMg,
      sugarG: displayedResult.sugarG,
      contexts: displayedResult.contexts,
      imageUrl: photoPreview ?? undefined,
      isHealthy: displayedResult.isHealthy,
      portionEstimate: displayedResult.portionEstimate,
      summaryNote: displayedResult.summaryNote,
    });
  };

  return (
    <div className="animate-screen-fade px-[20px] md:px-0 pt-[20px] md:pt-[4px] pb-[110px] md:pb-[48px]">
      {/* Header */}
      <header className="flex items-center justify-between gap-[10px] mb-[18px]">
        <div className="flex items-center gap-[12px]">
          <button
            type="button"
            onClick={onBack}
            aria-label="Quay lại trang chủ"
            className="md:hidden w-[40px] h-[40px] rounded-full bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0] flex items-center justify-center text-[#2D2416] cursor-pointer hover:border-[#C5B890] transition-colors"
            style={{ boxShadow: '0 2px 0 var(--border-dark)' }}
          >
            <ArrowLeftIcon size={20} />
          </button>
          <h1 className="text-[20px] md:text-[24px] font-extrabold text-[#2D2416] m-0">
            Ghi nhận bữa ăn
          </h1>
        </div>

        <button
          type="button"
          onClick={onOpenSuggestions}
          className="px-[11px] md:px-[14px] py-[6px] md:py-[8px] rounded-full md:rounded-[12px] bg-[#D4F7EE] border border-[#06D6A0] text-[#037A5B] text-[11px] md:text-[12px] font-bold cursor-pointer whitespace-nowrap shrink-0"
        >
          Gợi ý món
        </button>
      </header>

      <div className="md:grid md:grid-cols-12 md:gap-[20px] md:items-start">
        <div className="md:col-span-6">
      {/* Upload Zone */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        aria-label="Chọn ảnh bữa ăn"
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full min-h-[200px] rounded-[20px] border-2 border-dashed border-[#C5B890] bg-[#F2EBD8] hover:border-[#FF8A3D] hover:bg-[#FFEEDD] transition-all duration-200 flex flex-col items-center justify-center gap-[10px] p-[16px] cursor-pointer overflow-hidden"
      >
        {photoPreview ? (
          <div className="w-full flex flex-col items-center gap-[10px]">
            <img
              src={photoPreview}
              alt="Ảnh bữa ăn đã chọn"
              className="w-full max-h-[180px] object-cover rounded-[12px] border-[1.5px] border-[#DDD0B0]"
            />
            <span className="text-[12px] font-bold text-[#FF8A3D]">
              Chạm để đổi ảnh khác
            </span>
          </div>
        ) : (
          <>
            <span className="text-[#9E8E78] inline-flex">
              <CameraIcon size={48} strokeWidth={1.75} />
            </span>
            <span className="text-[14px] font-semibold text-[#6B5D47]">
              Chụp ảnh hoặc tải lên
            </span>
          </>
        )}
      </button>

      {/* Context Buttons */}
      <div className="mt-[14px]">
        <p className="text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] m-0 mb-[8px]">
          BỐI CẢNH BỮA ĂN
        </p>
        <div className="flex items-center gap-[8px] overflow-x-auto no-scrollbar pb-[4px]">
          {CONTEXT_OPTIONS.map((option) => {
            const selected = selectedContexts.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggleContext(option)}
                aria-pressed={selected}
                className={`shrink-0 px-[14px] py-[8px] rounded-full text-[12px] border-[1.5px] cursor-pointer transition-all duration-200 whitespace-nowrap active:scale-95 ${
                  selected
                    ? 'bg-[#D4F7EE] border-[#06D6A0] text-[#037A5B] font-bold'
                    : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-medium hover:border-[#C5B890]'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {/* Meal Slot Selector */}
      <div className="mt-[14px]">
        <p className="text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] m-0 mb-[8px]">
          CHỌN BUỔI ĂN
        </p>
        <div className="grid grid-cols-4 gap-[8px]">
          {MEAL_SLOTS.map((slot) => {
            const active = selectedSlot === slot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedSlot(slot)}
                aria-pressed={active}
                className={`py-[8px] rounded-[12px] text-[12px] border-[1.5px] cursor-pointer transition-all duration-150 ${
                  active
                    ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A] font-bold'
                    : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
                }`}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </div>

      {/* Text Input */}
      <div className="mt-[14px]">
        <label htmlFor="meal-description-input" className="sr-only">
          Mô tả bữa ăn bằng chữ
        </label>
        <input
          id="meal-description-input"
          type="text"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setErrorMessage(null);
          }}
          placeholder="Hoặc mô tả bằng chữ..."
          className="w-full px-[14px] py-[13px] rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[#2D2416] placeholder:text-[#9E8E78] text-[14px] font-medium focus:outline-none focus:border-[#FF8A3D]"
        />
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="mt-[10px] text-[12px] font-semibold text-[#C94A4A] bg-[#FFE8E8] border border-[#FF6B6B]/40 rounded-[12px] px-[12px] py-[9px] m-0"
        >
          {errorMessage}
        </p>
      )}

      {contextDirty && (
        <p className="mt-[10px] text-[12px] font-semibold text-[#CC5F1A] bg-[#FFEEDD] border border-[#FF8A3D]/40 rounded-[12px] px-[12px] py-[8px] m-0">
          Bạn vừa đổi bối cảnh — bấm “Phân tích lại” để AI ước lượng lại theo ngữ cảnh mới nhé.
        </p>
      )}

      {/* Primary CTA */}
      <button
        type="button"
        onClick={() => void handleAnalyze(false)}
        disabled={isAnalyzing}
        className="w-full mt-[16px] py-[14px] rounded-[20px] bg-[#FF8A3D] text-white text-[16px] font-bold neo-cta cursor-pointer disabled:opacity-70"
      >
        {isAnalyzing
          ? 'AI đang nhận diện & phân tích...'
          : baseAnalysis
          ? 'Phân tích lại'
          : 'Phân tích ngay'}
      </button>
        </div>

        <div className="md:col-span-6">
      {!displayedResult && (
        <section
          aria-label="Hướng dẫn phân tích nhanh"
          className="hidden md:flex neo-card p-[24px] flex-col gap-[12px]"
        >
          <p className="text-[11px] font-extrabold tracking-[0.05em] text-[#037A5B] m-0 uppercase">
            Phân tích dinh dưỡng thông minh
          </p>
          <h2 className="text-[18px] font-extrabold text-[#2D2416] m-0 leading-snug">
            Chụp ảnh hoặc mô tả bữa ăn bên trái để xem kết quả chi tiết
          </h2>
          <p className="text-[13px] font-medium text-[#6B5D47] m-0 leading-relaxed">
            BữaNay ước tính Calories, Đạm, Tinh bột, Chất xơ, Chất béo cùng Natri và Đường tự do. Sau khi phân tích, bạn có thể nhân khẩu phần (0.5×, 1×, 1.5×) hoặc chỉnh sửa trực tiếp từng chỉ số trước khi lưu.
          </p>
          <div className="pt-[8px] border-t border-[#EDE5CC]">
            <p className="text-[11px] font-bold text-[#9E8E78] m-0 mb-[8px]">
              Bấm nhanh ví dụ phổ biến:
            </p>
            <div className="flex flex-wrap gap-[8px]">
              {[
                'Phở bò tái chín 1 tô vừa',
                'Cơm tấm sườn trứng ốp la',
                'Bún thịt nướng chả giò',
                '1 ly trà sữa ít đường',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    setDescription(sample);
                    setErrorMessage(null);
                  }}
                  className="px-[11px] py-[6px] rounded-full bg-[#FFF9ED] border border-[#DDD0B0] hover:border-[#FF8A3D] text-[12px] font-semibold text-[#2D2416] cursor-pointer transition-colors"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Analysis Result Card */}
      {displayedResult && (
        <section
          ref={resultSectionRef}
          aria-label="Kết quả phân tích dinh dưỡng"
          className="mt-[18px] md:mt-0 neo-card p-[16px] animate-card-enter scroll-mb-[96px]"
        >
          <div className="flex items-start justify-between gap-[10px]">
            <div>
              <div className="flex items-center gap-[6px] flex-wrap">
                <span
                  className={`inline-block rounded-full px-[8px] py-[2px] text-[10px] font-extrabold whitespace-nowrap ${
                    analysisSource === 'local_bank'
                      ? 'bg-[#D4F7EE] text-[#037A5B]'
                      : 'bg-[#FFEEDD] text-[#CC5F1A]'
                  }`}
                >
                  {analysisSource === 'local_bank'
                    ? 'Ước tính dinh dưỡng chuẩn'
                    : 'Phân tích chi tiết'}
                </span>
                <span className="text-[10px] font-bold tracking-[0.06em] text-[#9E8E78]">
                  {selectedSlot.toUpperCase()}
                </span>
              </div>
              <h2 className="text-[17px] font-extrabold text-[#2D2416] m-0 mt-[4px]">
                {displayedResult.name}
              </h2>
              <p className="text-[12px] font-semibold text-[#6B5D47] m-0 mt-[3px]">
                {displayedResult.portionEstimate}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-[10px] py-[4px] text-[11px] font-bold whitespace-nowrap ${
                displayedResult.isHealthy
                  ? 'bg-[#D4F7EE] text-[#037A5B]'
                  : 'bg-[#FFF3CC] text-[#9E6B00]'
              }`}
            >
              {displayedResult.isHealthy ? 'Healthy' : 'Ăn vừa phải'}
            </span>
          </div>

          {displayedResult.itemsDetected.length > 0 && (
            <p className="text-[11px] font-medium text-[#6B5D47] m-0 mt-[8px] leading-relaxed">
              <strong className="text-[#2D2416]">Thành phần:</strong>{' '}
              {displayedResult.itemsDetected.join(' · ')}
            </p>
          )}

          <div className="mt-[12px] flex items-center justify-between gap-[10px]">
            <div className="flex items-baseline gap-[6px] tabular-nums">
              <span
                data-testid="analyzed-calories"
                className="text-[32px] font-extrabold text-[#FF8A3D] leading-none"
              >
                {displayedResult.calories}
              </span>
              <span className="text-[13px] font-semibold text-[#6B5D47]">
                kcal
              </span>
            </div>

            <div className="flex items-center gap-[6px]">
              <button
                type="button"
                onClick={() => setIsEditingResult((prev) => !prev)}
                className={`px-[10px] py-[5px] rounded-full text-[11px] font-bold border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  isEditingResult
                    ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A]'
                    : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47]'
                }`}
              >
                {isEditingResult ? 'Xong' : 'Chỉnh sửa'}
              </button>
              <div
                role="group"
                aria-label="Điều chỉnh khẩu phần thực tế"
                className="flex items-center gap-[4px] bg-[#F2EBD8] p-[3px] rounded-full border border-[#DDD0B0]"
              >
                {PORTION_MULTIPLIERS.map((m) => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setPortionScale(m.value)}
                    aria-pressed={portionScale === m.value}
                    className={`px-[9px] py-[4px] rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                      portionScale === m.value
                        ? 'bg-[#FFFDF5] text-[#2D2416] shadow-xs'
                        : 'text-[#6B5D47]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isEditingResult && (
            <div className="mt-[12px] rounded-[14px] bg-[#FFF9ED] border-[1.5px] border-[#DDD0B0] p-[12px] flex flex-col gap-[8px]">
              <p className="text-[10px] font-bold tracking-[0.04em] text-[#CC5F1A] m-0">
                CHỈNH SỬA TRỰC TIẾP TRƯỚC KHI LƯU
              </p>
              <div>
                <label
                  htmlFor="edit-meal-name"
                  className="block text-[10px] font-bold text-[#6B5D47] mb-[3px]"
                >
                  Tên món ăn
                </label>
                <input
                  id="edit-meal-name"
                  type="text"
                  value={baseAnalysis?.name ?? ''}
                  onChange={(e) => updateEditableField('name', e.target.value)}
                  className="w-full px-[10px] py-[7px] rounded-[10px] border border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-bold text-[#2D2416]"
                />
              </div>
              <div className="grid grid-cols-5 gap-[6px]">
                {[
                  { key: 'calories' as const, label: 'Kcal', val: displayedResult.calories },
                  { key: 'protein' as const, label: 'Đạm(g)', val: displayedResult.protein },
                  { key: 'carbs' as const, label: 'Bột(g)', val: displayedResult.carbs },
                  { key: 'fiber' as const, label: 'Xơ(g)', val: displayedResult.fiber },
                  { key: 'fat' as const, label: 'Béo(g)', val: displayedResult.fat },
                ].map((f) => (
                  <div key={f.key}>
                    <label
                      htmlFor={`edit-meal-${f.key}`}
                      className="block text-[9px] font-bold text-[#6B5D47] mb-[2px] text-center"
                    >
                      {f.label}
                    </label>
                    <input
                      id={`edit-meal-${f.key}`}
                      type="number"
                      min={0}
                      value={f.val}
                      onChange={(e) => updateEditableField(f.key, e.target.value)}
                      className="w-full px-[4px] py-[6px] rounded-[8px] border border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-extrabold text-[#2D2416] text-center tabular-nums"
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-[6px]">
                <div>
                  <label
                    htmlFor="edit-meal-sodiumMg"
                    className="block text-[9px] font-bold text-[#6B5D47] mb-[2px]"
                  >
                    Natri / muối (mg)
                  </label>
                  <input
                    id="edit-meal-sodiumMg"
                    type="number"
                    min={0}
                    value={displayedResult.sodiumMg ?? 0}
                    onChange={(e) => updateEditableField('sodiumMg', e.target.value)}
                    className="w-full px-[8px] py-[6px] rounded-[8px] border border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-bold text-[#2D2416] tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-meal-sugarG"
                    className="block text-[9px] font-bold text-[#6B5D47] mb-[2px]"
                  >
                    Đường tự do (g)
                  </label>
                  <input
                    id="edit-meal-sugarG"
                    type="number"
                    min={0}
                    value={displayedResult.sugarG ?? 0}
                    onChange={(e) => updateEditableField('sugarG', e.target.value)}
                    className="w-full px-[8px] py-[6px] rounded-[8px] border border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-bold text-[#2D2416] tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-[8px] mt-[12px]">
            <div className="rounded-[10px] p-[8px] bg-[#FFE8E8] text-center">
              <p className="text-[15px] font-extrabold text-[#FF6B6B] m-0 tabular-nums">
                {displayedResult.protein}g
              </p>
              <p className="text-[10px] font-semibold text-[#6B5D47] m-0 mt-[2px]">
                Đạm
              </p>
            </div>
            <div className="rounded-[10px] p-[8px] bg-[#FFF3CC] text-center">
              <p className="text-[15px] font-extrabold text-[#E8A500] m-0 tabular-nums">
                {displayedResult.carbs}g
              </p>
              <p className="text-[10px] font-semibold text-[#6B5D47] m-0 mt-[2px]">
                Tinh bột
              </p>
            </div>
            <div className="rounded-[10px] p-[8px] bg-[#D4F4F2] text-center">
              <p className="text-[15px] font-extrabold text-[#2EC4B6] m-0 tabular-nums">
                {displayedResult.fiber}g
              </p>
              <p className="text-[10px] font-semibold text-[#6B5D47] m-0 mt-[2px]">
                Chất xơ
              </p>
            </div>
            <div className="rounded-[10px] p-[8px] bg-[#EDE6FF] text-center">
              <p className="text-[15px] font-extrabold text-[#9D7BFF] m-0 tabular-nums">
                {displayedResult.fat}g
              </p>
              <p className="text-[10px] font-semibold text-[#6B5D47] m-0 mt-[2px]">
                Chất béo
              </p>
            </div>
          </div>

          {(displayedResult.sodiumMg !== undefined ||
            displayedResult.sugarG !== undefined) && (
            <div className="flex items-center justify-between gap-[8px] mt-[8px] px-[10px] py-[6px] rounded-[10px] bg-[#FFF9ED] border border-[#DDD0B0] text-[11px] font-semibold text-[#6B5D47] tabular-nums">
              <span>
                Natri (muối):{' '}
                <strong className="text-[#2D2416]">
                  {displayedResult.sodiumMg ?? 0} mg
                </strong>
              </span>
              <span>
                Đường tự do:{' '}
                <strong className="text-[#2D2416]">
                  {displayedResult.sugarG ?? 0} g
                </strong>
              </span>
            </div>
          )}

          <p className="mt-[12px] mb-0 rounded-[12px] bg-[#F2EBD8] border border-[#DDD0B0] px-[12px] py-[10px] text-[12px] font-medium text-[#2D2416] leading-relaxed">
            {displayedResult.summaryNote}
          </p>

          {analysisSource === 'local_bank' && !photoPreview && (
            <div className="mt-[8px] flex justify-end">
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => void handleAnalyze(true)}
                className="text-[11px] font-bold text-[#CC5F1A] cursor-pointer hover:underline disabled:opacity-50 whitespace-nowrap"
              >
                Phân tích chi tiết hơn →
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            className="w-full mt-[14px] py-[12px] rounded-[14px] bg-[#06D6A0] text-[#033F2E] text-[14px] font-extrabold border-[1.5px] border-[#037A5B] cursor-pointer active:translate-y-[1px] transition-all flex items-center justify-center gap-[6px]"
            style={{ boxShadow: '0 3px 0 #037A5B' }}
          >
            <CheckIcon size={18} />
            <span>Lưu vào nhật ký hôm nay</span>
          </button>
        </section>
      )}
        </div>
      </div>
    </div>
  );
}
