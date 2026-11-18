import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MealEntry, MealSlot, MealsByDate } from '../types/nutrition';
import {
  MEAL_SLOTS,
  computeDailyTotals,
  formatReadableViDate,
  formatViNumber,
  getRecentDateKeys,
} from '../utils/nutrition';
import { EditIcon, PlusIcon, TrashIcon, UtensilsIcon } from './Icons';

interface HistoryScreenProps {
  mealsByDate: MealsByDate;
  targetCalories: number;
  todayKey: string;
  onDeleteMeal: (id: string, dateKey: string) => void;
  onUpdateMeal: (dateKey: string, updatedMeal: MealEntry) => void;
  onAddMealClick: () => void;
}

type SlotFilter = 'Tất cả' | MealSlot;
const SLOT_FILTERS: SlotFilter[] = ['Tất cả', ...MEAL_SLOTS];

export function HistoryScreen({
  mealsByDate,
  targetCalories,
  todayKey,
  onDeleteMeal,
  onUpdateMeal,
  onAddMealClick,
}: HistoryScreenProps) {
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('Tất cả');
  const [editingMeal, setEditingMeal] = useState<MealEntry | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const recentDates = useMemo(() => getRecentDateKeys(14), []);

  useEffect(() => {
    if (stripRef.current) {
      stripRef.current.scrollLeft = stripRef.current.scrollWidth;
    }
  }, []);

  const dayMeals = mealsByDate[selectedDateKey] ?? [];
  const dayTotals = useMemo(
    () => computeDailyTotals(dayMeals, targetCalories),
    [dayMeals, targetCalories]
  );

  const visibleMeals = useMemo(() => {
    if (slotFilter === 'Tất cả') return dayMeals;
    return dayMeals.filter((m) => m.slot === slotFilter);
  }, [dayMeals, slotFilter]);

  const readableDate = formatReadableViDate(selectedDateKey, todayKey);
  const isSelectedToday = selectedDateKey === todayKey;

  const handleSaveEdit = () => {
    if (!editingMeal || !editingMeal.name.trim()) return;
    onUpdateMeal(selectedDateKey, {
      ...editingMeal,
      name: editingMeal.name.trim(),
      calories: Math.max(0, Math.round(editingMeal.calories)),
      protein: Math.max(0, Math.round(editingMeal.protein)),
      carbs: Math.max(0, Math.round(editingMeal.carbs)),
      fiber: Math.max(0, Math.round(editingMeal.fiber)),
      fat: Math.max(0, Math.round(editingMeal.fat)),
      sodiumMg:
        editingMeal.sodiumMg !== undefined
          ? Math.max(0, Math.round(editingMeal.sodiumMg))
          : undefined,
      sugarG:
        editingMeal.sugarG !== undefined
          ? Math.max(0, Math.round(editingMeal.sugarG))
          : undefined,
    });
    setEditingMeal(null);
  };

  return (
    <div className="animate-screen-fade px-[20px] md:px-0 pt-[20px] md:pt-[4px] pb-[105px] md:pb-[48px]">
      <header className="flex items-center justify-between gap-[10px] mb-[14px]">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.04em] text-[#9E8E78] m-0 uppercase truncate">
            {isSelectedToday ? 'NHẬT KÝ HÔM NAY' : `TRA CỨU · ${readableDate}`}
          </p>
          <h1 className="text-[22px] font-extrabold text-[#2D2416] m-0 mt-[2px]">
            Lịch sử bữa ăn
          </h1>
        </div>

        <button
          type="button"
          onClick={onAddMealClick}
          className="px-[14px] py-[9px] rounded-full bg-[#FF8A3D] text-white text-[12px] font-bold neo-cta flex items-center gap-[5px] cursor-pointer whitespace-nowrap shrink-0"
        >
          <PlusIcon size={15} />
          <span>Thêm bữa</span>
        </button>
      </header>

      {/* Date Picker & 14-day Quick Strip */}
      <section aria-label="Chọn ngày xem nhật ký" className="mb-[14px]">
        <div className="flex items-center justify-between gap-[8px] mb-[8px]">
          <span className="text-[11px] font-bold text-[#6B5D47]">
            {readableDate}
          </span>
          <label className="flex items-center gap-[6px] text-[11px] font-bold text-[#037A5B]">
            <span>Chọn ngày khác:</span>
            <input
              type="date"
              aria-label="Chọn ngày bất kỳ trong lịch sử"
              max={todayKey}
              value={selectedDateKey}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDateKey(e.target.value);
                }
              }}
              className="px-[8px] py-[4px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[11px] font-bold text-[#2D2416] focus:outline-none focus:border-[#06D6A0]"
            />
          </label>
        </div>

        <div
          ref={stripRef}
          className="flex gap-[6px] overflow-x-auto pb-[4px] no-scrollbar"
        >
          {recentDates.map((d) => {
            const hasMeals = (mealsByDate[d.dateKey]?.length ?? 0) > 0;
            const active = selectedDateKey === d.dateKey;
            return (
              <button
                key={d.dateKey}
                type="button"
                onClick={() => setSelectedDateKey(d.dateKey)}
                className={`shrink-0 min-w-[46px] px-[8px] py-[7px] rounded-[12px] border-[1.5px] flex flex-col items-center gap-[2px] cursor-pointer transition-all ${
                  active
                    ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A]'
                    : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47]'
                }`}
              >
                <span className="text-[10px] font-bold">{d.shortDay}</span>
                <span className="text-[11px] font-extrabold tabular-nums">
                  {d.dateNum.slice(0, 2)}
                </span>
                <span
                  className="w-[5px] h-[5px] rounded-full"
                  style={{
                    backgroundColor: hasMeals
                      ? active
                        ? '#FF8A3D'
                        : '#06D6A0'
                      : 'transparent',
                  }}
                />
              </button>
            );
          })}
        </div>
      </section>

      <div className="md:grid md:grid-cols-12 md:gap-[20px] md:items-start">
        <div className="md:col-span-4 md:sticky md:top-[20px]">
      {/* Summary strip */}
      <div className="neo-card p-[14px] mb-[12px]">
        <div className="flex items-center justify-between gap-[8px]">
          <div>
            <p className="text-[11px] font-semibold text-[#9E8E78] m-0">
              Tổng năng lượng ({readableDate.toLowerCase()})
            </p>
            <p className="text-[22px] font-extrabold text-[#2D2416] m-0 mt-[2px] tabular-nums">
              {formatViNumber(dayTotals.calories)} kcal
            </p>
          </div>
          <span className="text-[12px] font-bold text-[#037A5B] bg-[#D4F7EE] px-[12px] py-[5px] rounded-full tabular-nums">
            {dayMeals.length} bữa
          </span>
        </div>

        <div className="flex items-center gap-[10px] mt-[8px] pt-[8px] border-t border-[#EDE5CC] text-[11px] font-bold tabular-nums flex-wrap">
          <span className="text-[#FF6B6B]">Đạm {dayTotals.protein}g</span>
          <span className="text-[#E8A500]">Tinh bột {dayTotals.carbs}g</span>
          <span className="text-[#2EC4B6]">Chất xơ {dayTotals.fiber}g</span>
          <span className="text-[#9D7BFF]">Béo {dayTotals.fat}g</span>
        </div>
      </div>

      {/* Meal Slot Filter */}
      <div
        role="tablist"
        aria-label="Lọc theo buổi ăn"
        className="flex flex-wrap gap-[5px] mb-[12px]"
      >
        {SLOT_FILTERS.map((slot) => {
          const active = slotFilter === slot;
          const count =
            slot === 'Tất cả'
              ? dayMeals.length
              : dayMeals.filter((m) => m.slot === slot).length;
          return (
            <button
              key={slot}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSlotFilter(slot)}
              className={`px-[9px] py-[5px] rounded-full text-[11px] font-bold border-[1.5px] cursor-pointer transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#D4F7EE] border-[#06D6A0] text-[#037A5B]'
                  : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47]'
              }`}
            >
              {slot} ({count})
            </button>
          );
        })}
      </div>
        </div>

        <div className="md:col-span-8">
      {/* Meal List */}
      {visibleMeals.length === 0 ? (
        <div className="neo-card p-[24px] text-center flex flex-col items-center gap-[10px]">
          <span className="w-[46px] h-[46px] rounded-full bg-[#F2EBD8] border-[1.5px] border-[#DDD0B0] flex items-center justify-center text-[#9E8E78]">
            <UtensilsIcon size={21} />
          </span>
          <p className="text-[15px] font-bold text-[#2D2416] m-0">
            {dayMeals.length === 0
              ? `Chưa có bữa ăn nào được ghi (${readableDate.toLowerCase()})`
              : `Không có bữa nào thuộc nhóm "${slotFilter}"`}
          </p>
          <p className="text-[12px] font-medium text-[#6B5D47] m-0 leading-relaxed">
            Dữ liệu luôn giữ 100% thực tế từ bữa bạn tự chụp hoặc nhập.{' '}
            {isSelectedToday
              ? 'Nhấn nút Thêm bữa hoặc nút camera để ghi bữa đầu tiên nhé.'
              : 'Chọn ngày có chấm xanh ở thanh phía trên để xem lại lịch sử đã ghi.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[10px] md:gap-[12px]">
          {visibleMeals.map((meal) => (
            <article key={meal.id} className="neo-card p-[14px]">
              <div className="flex items-start justify-between gap-[10px]">
                <div className="min-w-0">
                  <div className="flex items-center gap-[6px] flex-wrap">
                    <span className="rounded-full px-[9px] py-[2px] text-[11px] font-bold bg-[#D4F7EE] text-[#037A5B]">
                      {meal.slot}
                    </span>
                    <span className="text-[11px] font-semibold text-[#9E8E78] tabular-nums">
                      {meal.time}
                    </span>
                    {meal.isHealthy && (
                      <span className="text-[11px] font-bold text-[#037A5B]">
                        · Healthy
                      </span>
                    )}
                  </div>
                  <h2 className="text-[15px] font-extrabold text-[#2D2416] m-0 mt-[6px] leading-snug">
                    {meal.name}
                  </h2>
                  {meal.portionEstimate && (
                    <p className="text-[11px] font-medium text-[#6B5D47] m-0 mt-[2px]">
                      {meal.portionEstimate}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-[6px] shrink-0">
                  <span className="text-[15px] font-extrabold text-[#FF8A3D] tabular-nums">
                    {meal.calories} kcal
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingMeal({ ...meal })}
                    aria-label={`Chỉnh sửa ${meal.name}`}
                    className="w-[32px] h-[32px] rounded-full bg-[#FFF9ED] border-[1.5px] border-[#DDD0B0] flex items-center justify-center text-[#6B5D47] hover:text-[#CC5F1A] hover:border-[#FF8A3D] cursor-pointer transition-colors"
                  >
                    <EditIcon size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteMeal(meal.id, selectedDateKey)}
                    aria-label={`Xóa ${meal.name}`}
                    className="w-[32px] h-[32px] rounded-full bg-[#F2EBD8] border-[1.5px] border-[#DDD0B0] flex items-center justify-center text-[#6B5D47] hover:text-[#FF6B6B] hover:border-[#FF6B6B] cursor-pointer transition-colors"
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              </div>

              {meal.imageUrl && (
                <img
                  src={meal.imageUrl}
                  alt={meal.name}
                  className="w-full h-[120px] object-cover rounded-[12px] border border-[#DDD0B0] mt-[10px]"
                />
              )}

              {meal.summaryNote && (
                <p className="text-[11px] font-medium text-[#6B5D47] m-0 mt-[8px] leading-relaxed">
                  {meal.summaryNote}
                </p>
              )}

              <div className="flex items-center gap-[8px] mt-[10px] text-[11px] font-semibold text-[#6B5D47] tabular-nums flex-wrap">
                <span className="text-[#FF6B6B] font-bold">
                  Đạm {meal.protein}g
                </span>
                <span>·</span>
                <span className="text-[#E8A500] font-bold">
                  Tinh bột {meal.carbs}g
                </span>
                <span>·</span>
                <span className="text-[#2EC4B6] font-bold">
                  Chất xơ {meal.fiber}g
                </span>
                <span>·</span>
                <span className="text-[#9D7BFF] font-bold">
                  Béo {meal.fat}g
                </span>
                {(meal.sodiumMg !== undefined || meal.sugarG !== undefined) && (
                  <span className="text-[#9E8E78] font-semibold">
                    · Natri {meal.sodiumMg ?? 0}mg · Đường {meal.sugarG ?? 0}g
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
        </div>
      </div>

      {/* Portaled Edit Saved Meal Modal */}
      {editingMeal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-history-meal-title"
            className="fixed inset-0 z-[140] flex items-center justify-center bg-[#2D2416]/50 p-[16px]"
            onClick={() => setEditingMeal(null)}
          >
            <div
              className="w-full max-w-[360px] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-[22px] bg-[#FFFDF5] border-[1.5px] border-[#DDD0B0] p-[18px] animate-screen-fade"
              style={{
                boxShadow:
                  '0 4px 0 var(--border-dark), 0 12px 32px rgba(45, 36, 22, 0.24)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-[8px] mb-[12px]">
                <h2
                  id="edit-history-meal-title"
                  className="text-[17px] font-extrabold text-[#2D2416] m-0"
                >
                  Chỉnh sửa bữa ăn đã lưu
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingMeal(null)}
                  className="px-[10px] py-[4px] rounded-full bg-[#F2EBD8] border border-[#DDD0B0] text-[11px] font-bold text-[#6B5D47] cursor-pointer"
                >
                  Hủy
                </button>
              </div>

              <div className="flex flex-col gap-[9px]">
                <div>
                  <span className="block text-[11px] font-bold text-[#6B5D47] mb-[4px]">
                    Buổi ăn
                  </span>
                  <div className="grid grid-cols-4 gap-[6px]">
                    {MEAL_SLOTS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          setEditingMeal({ ...editingMeal, slot: s })
                        }
                        className={`py-[6px] rounded-[10px] text-[11px] border-[1.5px] cursor-pointer ${
                          editingMeal.slot === s
                            ? 'bg-[#FFEEDD] border-[#FF8A3D] text-[#CC5F1A] font-bold'
                            : 'bg-[#FFFDF5] border-[#DDD0B0] text-[#6B5D47] font-semibold'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="history-edit-name"
                    className="block text-[11px] font-bold text-[#6B5D47] mb-[3px]"
                  >
                    Tên món ăn
                  </label>
                  <input
                    id="history-edit-name"
                    type="text"
                    value={editingMeal.name}
                    onChange={(e) =>
                      setEditingMeal({ ...editingMeal, name: e.target.value })
                    }
                    className="w-full px-[10px] py-[8px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[13px] font-bold text-[#2D2416]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="history-edit-portion"
                    className="block text-[11px] font-bold text-[#6B5D47] mb-[3px]"
                  >
                    Khẩu phần
                  </label>
                  <input
                    id="history-edit-portion"
                    type="text"
                    value={editingMeal.portionEstimate ?? ''}
                    onChange={(e) =>
                      setEditingMeal({
                        ...editingMeal,
                        portionEstimate: e.target.value,
                      })
                    }
                    placeholder="Ví dụ: 1 tô vừa"
                    className="w-full px-[10px] py-[7px] rounded-[10px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-medium text-[#2D2416]"
                  />
                </div>

                <div className="grid grid-cols-5 gap-[5px]">
                  {[
                    { key: 'calories' as const, label: 'Kcal' },
                    { key: 'protein' as const, label: 'Đạm' },
                    { key: 'carbs' as const, label: 'Bột' },
                    { key: 'fiber' as const, label: 'Xơ' },
                    { key: 'fat' as const, label: 'Béo' },
                  ].map((f) => (
                    <div key={f.key}>
                      <label
                        htmlFor={`history-edit-${f.key}`}
                        className="block text-[10px] font-bold text-[#6B5D47] mb-[2px] text-center"
                      >
                        {f.label}
                      </label>
                      <input
                        id={`history-edit-${f.key}`}
                        type="number"
                        min={0}
                        value={editingMeal[f.key]}
                        onChange={(e) =>
                          setEditingMeal({
                            ...editingMeal,
                            [f.key]: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-full px-[4px] py-[6px] rounded-[8px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-extrabold text-[#2D2416] text-center tabular-nums"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-[6px]">
                  <div>
                    <label
                      htmlFor="history-edit-sodium"
                      className="block text-[10px] font-bold text-[#6B5D47] mb-[2px]"
                    >
                      Natri (mg)
                    </label>
                    <input
                      id="history-edit-sodium"
                      type="number"
                      min={0}
                      value={editingMeal.sodiumMg ?? 0}
                      onChange={(e) =>
                        setEditingMeal({
                          ...editingMeal,
                          sodiumMg: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full px-[8px] py-[6px] rounded-[8px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-bold text-[#2D2416] tabular-nums"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="history-edit-sugar"
                      className="block text-[10px] font-bold text-[#6B5D47] mb-[2px]"
                    >
                      Đường tự do (g)
                    </label>
                    <input
                      id="history-edit-sugar"
                      type="number"
                      min={0}
                      value={editingMeal.sugarG ?? 0}
                      onChange={(e) =>
                        setEditingMeal({
                          ...editingMeal,
                          sugarG: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full px-[8px] py-[6px] rounded-[8px] border-[1.5px] border-[#DDD0B0] bg-[#FFFDF5] text-[12px] font-bold text-[#2D2416] tabular-nums"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="w-full mt-[6px] py-[11px] rounded-[14px] bg-[#FF8A3D] text-white text-[13px] font-bold neo-cta cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
