import { useState } from 'react';
import { createPortal } from 'react-dom';
import { loadDishBank } from '../data/dishes';
import type {
  AppTab,
  CompanionChatReply,
  UserProfile,
} from '../types/nutrition';
import { tryAnswerCompanionFromLocalBank } from '../utils/dishMatcher';
import {
  formatViNumber,
  getMascotFeedback,
  getMascotMoodState,
  parseApiJson,
  type DailyTotals,
} from '../utils/nutrition';
import { MamMascot3D } from './MamMascot3D';

interface MascotCompanionModalProps {
  profile: UserProfile;
  totals: DailyTotals;
  waterCups: number;
  streakDays: number;
  onClose: () => void;
  onNavigate: (tab: AppTab) => void;
  onReplayTour?: () => void;
}

const QUICK_QUESTIONS = [
  'Hôm nay mình thiếu chất gì?',
  'Gợi ý bữa nhẹ dưới 200 kcal',
  'Làm sao duy trì streak dễ hơn?',
];

export function MascotCompanionModal({
  profile,
  totals,
  waterCups,
  streakDays,
  onClose,
  onNavigate,
  onReplayTour,
}: MascotCompanionModalProps) {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reply, setReply] = useState<CompanionChatReply | null>(null);
  const [replySource, setReplySource] = useState<'local_bank' | 'gemini_ai' | null>(
    null
  );
  const [recentDishes, setRecentDishes] = useState<string[]>([]);
  const [varietySeed, setVarietySeed] = useState<number>(() =>
    Math.floor(Date.now() % 1000)
  );

  const mood = getMascotMoodState(totals, profile, streakDays);
  const mascotSummary = getMascotFeedback(totals, profile);

  const askMam = async (q: string, forceAi = false) => {
    const clean = q.trim();
    if (!clean) return;
    setQuestion(clean);
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const remaining = {
        calories: Math.max(0, profile.targetCalories - totals.calories),
        protein: Math.max(0, profile.targets.protein - totals.protein),
        carbs: Math.max(0, profile.targets.carbs - totals.carbs),
        fiber: Math.max(0, profile.targets.fiber - totals.fiber),
        fat: Math.max(0, profile.targets.fat - totals.fat),
      };

      if (!forceAi) {
        const dishes = await loadDishBank();
        const nextSeed = varietySeed + 1;
        setVarietySeed(nextSeed);
        const localReply = tryAnswerCompanionFromLocalBank({
          question: clean,
          dishes,
          profile,
          remaining,
          waterCups,
          streakDays,
          excludeNames: recentDishes,
          varietySeed: nextSeed,
        });
        if (localReply) {
          const quotedMatches = [...localReply.reply.matchAll(/"([^"]+)"/g)].map(
            (m) => m[1]
          );
          if (quotedMatches.length > 0) {
            setRecentDishes((prev) => [...prev.slice(-12), ...quotedMatches]);
          }
          setReply(localReply);
          setReplySource('local_bank');
          return;
        }
      }

      const res = await fetch('/api/suggest-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'companion_chat',
          question: clean,
          profile,
          remaining,
          waterCups,
        }),
      });
      const data = await parseApiJson<{
        companion?: CompanionChatReply;
        error?: string;
      }>(res);
      if (!res.ok || !data.companion) {
        throw new Error(data.error || 'Mầm chưa thể trả lời lúc này.');
      }
      setReply(data.companion);
      setReplySource('gemini_ai');
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Lỗi kết nối trợ lý Mầm.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const actionButtonLabel = (action?: CompanionChatReply['suggestedAction']) => {
    if (action === 'suggestions') return 'Mở Gợi ý thực đơn →';
    if (action === 'log') return 'Chụp / Nhập bữa ăn →';
    if (action === 'reports') return 'Xem Báo cáo →';
    if (action === 'guide') return 'Mở Cẩm nang →';
    return null;
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mam-companion-title"
      className="fixed inset-0 z-[140] flex items-center justify-center bg-[#2D2416]/50 p-[16px]"
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
        <div className="flex items-center justify-between gap-[10px]">
          <div className="flex items-center gap-[10px]">
            <MamMascot3D size={56} />
            <div>
              <span className="inline-block rounded-full px-[8px] py-[2px] text-[10px] font-extrabold bg-[#D4F7EE] text-[#037A5B]">
                Tâm trạng: {mood.label}
              </span>
              <h2
                id="mam-companion-title"
                className="text-[17px] font-extrabold text-[#2D2416] m-0 mt-[2px]"
              >
                Trợ lý Mầm của {profile.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-[10px] py-[5px] rounded-full bg-[#F2EBD8] border border-[#DDD0B0] text-[11px] font-bold text-[#6B5D47] cursor-pointer"
          >
            Đóng
          </button>
        </div>

        <div className="mt-[12px] rounded-[14px] bg-[#FFF9ED] border border-[#DDD0B0] p-[11px] text-[12px] font-medium text-[#2D2416] leading-relaxed">
          <p className="m-0">
            Hôm nay bạn đã nạp{' '}
            <strong className="text-[#FF8A3D] tabular-nums">
              {formatViNumber(totals.calories)} /{' '}
              {formatViNumber(profile.targetCalories)} kcal
            </strong>
            {mascotSummary.suffix}
          </p>
        </div>

        {/* 1-tap quick prompts */}
        <p className="text-[10px] font-bold tracking-[0.05em] text-[#9E8E78] m-0 mt-[12px] mb-[6px]">
          HỎI NHANH MẦM
        </p>
        <div className="flex flex-wrap gap-[6px]">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void askMam(q, false)}
              disabled={isLoading}
              className="px-[10px] py-[6px] rounded-full bg-[#F2EBD8] border border-[#DDD0B0] hover:border-[#FF8A3D] text-[11px] font-semibold text-[#2D2416] cursor-pointer disabled:opacity-60"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Custom question */}
        <form
          className="flex gap-[6px] mt-[10px]"
          onSubmit={(e) => {
            e.preventDefault();
            void askMam(question, false);
          }}
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Hỏi Mầm điều gì đó về bữa ăn..."
            className="flex-1 min-w-0 px-[11px] py-[9px] rounded-[12px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-medium text-[#2D2416] placeholder:text-[#9E8E78] focus:outline-none focus:border-[#06D6A0]"
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="px-[14px] py-[9px] rounded-[12px] bg-[#FF8A3D] text-white text-[12px] font-bold neo-cta cursor-pointer disabled:opacity-60 shrink-0"
          >
            {isLoading ? '...' : 'Hỏi'}
          </button>
        </form>

        {errorMsg && (
          <p
            role="alert"
            className="mt-[8px] text-[11px] font-semibold text-[#C94A4A] m-0"
          >
            {errorMsg}
          </p>
        )}

        {reply && (
          <div className="mt-[12px] rounded-[14px] bg-[#D4F7EE]/70 border-[1.5px] border-[#06D6A0] p-[12px]">
            <div className="flex items-center justify-between gap-[8px] mb-[6px]">
              <span
                className={`inline-block rounded-full px-[8px] py-[2px] text-[10px] font-extrabold whitespace-nowrap ${
                  replySource === 'local_bank'
                    ? 'bg-[#FFFDF5] text-[#037A5B] border border-[#06D6A0]/50'
                    : 'bg-[#FFEEDD] text-[#CC5F1A]'
                }`}
              >
                {replySource === 'local_bank'
                  ? 'Gợi ý nhanh từ Mầm'
                  : 'Tư vấn chuyên sâu'}
              </span>
              {replySource === 'local_bank' && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => void askMam(question, true)}
                  className="text-[10px] font-bold text-[#CC5F1A] cursor-pointer hover:underline disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  Hỏi Mầm phân tích kỹ hơn →
                </button>
              )}
            </div>
            <p className="text-[12px] font-medium text-[#2D2416] m-0 leading-relaxed">
              {reply.reply}
            </p>
            <p className="text-[11px] font-bold text-[#037A5B] m-0 mt-[6px]">
              Mẹo nhỏ: {reply.quickTip}
            </p>
            {actionButtonLabel(reply.suggestedAction) && (
              <button
                type="button"
                onClick={() => {
                  const target = reply.suggestedAction!;
                  onClose();
                  onNavigate(target);
                }}
                className="w-full mt-[8px] py-[8px] rounded-[10px] bg-[#06D6A0] text-[#033F2E] text-[12px] font-extrabold border border-[#037A5B] cursor-pointer"
              >
                {actionButtonLabel(reply.suggestedAction)}
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-[8px] mt-[12px]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('suggestions');
            }}
            className="py-[9px] rounded-[12px] bg-[#FFEEDD] border border-[#FF8A3D]/50 text-[#CC5F1A] text-[11px] font-bold cursor-pointer"
          >
            Gợi ý món hôm nay
          </button>
          <button
            type="button"
            onClick={() => {
              if (onReplayTour) onReplayTour();
              onClose();
            }}
            className="py-[9px] rounded-[12px] bg-[#F2EBD8] border border-[#DDD0B0] text-[#6B5D47] text-[11px] font-bold cursor-pointer"
          >
            Xem hướng dẫn 3 bước
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
