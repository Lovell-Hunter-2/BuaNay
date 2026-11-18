import type { MealSlot, UserGoal } from '../types/nutrition';

export interface AppGuideStep {
  stepNumber: string;
  title: string;
  summary: string;
  tips: string[];
  actionLabel?: string;
  actionTarget?: 'log' | 'suggestions' | 'profile' | 'reports';
}

export interface HandbookMealGuide {
  id: string;
  slot: MealSlot;
  title: string;
  caloriesRange: string;
  macroFocus: string;
  bestForGoals: UserGoal[];
  portionTip: string;
  diningTip: string;
  swapPromptDish: string;
}

export interface HandbookSwapPair {
  id: string;
  category: 'Đồ uống & Ăn vặt' | 'Cơm & Món nước' | 'Đồ chiên & Béo';
  fromDish: string;
  fromCalories: number;
  toDish: string;
  toCalories: number;
  nutritionBadge: string;
  whyBetter: string;
  howToApply: string;
}

export interface HandPortionRule {
  id: string;
  group: string;
  handCue: string;
  equivalent: string;
  color: string;
  softBg: string;
}

export const APP_GUIDE_STEPS: AppGuideStep[] = [
  {
    stepNumber: '01',
    title: 'Thiết lập chỉ số thật & mục tiêu cá nhân',
    summary:
      'BữaNay tính BMI chuẩn châu Á và TDEE (Mifflin-St Jeor) từ tuổi, chiều cao, cân nặng và mức vận động của chính bạn — hoàn toàn không dùng dữ liệu mẫu.',
    tips: [
      'Thay đổi cân nặng hoặc mục tiêu bất kỳ lúc nào tại tab Hồ sơ để tự động tính lại calo, 4 nhóm chất và lượng nước.',
      'Chuẩn nước khuyến nghị tính theo 35ml × cân nặng (kg), mỗi lần chạm +200ml tương đương 1 cốc vừa.',
    ],
    actionLabel: 'Kiểm tra Hồ sơ',
    actionTarget: 'profile',
  },
  {
    stepNumber: '02',
    title: 'Chụp ảnh hoặc mô tả bữa ăn cho AI nhận diện',
    summary:
      'Chạm nút Camera màu cam ở giữa thanh điều hướng để chụp trực tiếp, chọn ảnh từ máy hoặc nhập nhanh món vừa ăn bằng tiếng Việt.',
    tips: [
      'Nên chụp góc chéo 45° từ trên xuống để AI thấy rõ số lượng (ví dụ: 2 hay 3 quả trứng, 1 bát hay 1 đĩa đầy).',
      'Chọn đúng Bối cảnh (Ăn ngoài quán, Tự nấu ít dầu, Ít cơm, Ăn một nửa...) trước khi bấm Phân tích ngay để trừ/cộng dầu mỡ chuẩn hơn.',
      'Sau khi AI trả kết quả, bạn có thể bấm 0.5× / 1× / 1.5× nếu thực tế chỉ ăn một phần hoặc gọi thêm.',
    ],
    actionLabel: 'Thử ghi bữa ăn',
    actionTarget: 'log',
  },
  {
    stepNumber: '03',
    title: 'Theo dõi Nhật ký, Báo cáo & Streak thật 100%',
    summary:
      'Mọi con số trên Trang chủ, Báo cáo 7 ngày và chuỗi Streak chỉ tăng lên khi bạn thật sự ghi nhận bữa ăn hoặc lượng nước uống.',
    tips: [
      'Chạm vào thẻ Bữa đã ghi hoặc tab Lịch sử để xem lại khẩu phần ước tính, nhận xét AI và xóa nếu ghi nhầm.',
      'Tab Báo cáo tổng hợp trung bình calo các ngày bạn có ghi chép và tỷ lệ hoàn thành Đạm, Tinh bột, Chất xơ, Chất béo.',
    ],
    actionLabel: 'Xem Báo cáo',
    actionTarget: 'reports',
  },
  {
    stepNumber: '04',
    title: 'Gợi ý thực đơn AI & Tìm đồ thay thế khi thèm',
    summary:
      'Dựa trên lượng calo & đạm còn thiếu hôm nay cùng sở thích ăn uống của bạn, AI sẽ đề xuất món Việt dễ mua hoặc gợi ý món thay thế nhẹ bụng hơn.',
    tips: [
      'Có thể bấm "Chọn ăn & lưu vào nhật ký" ngay trên thẻ gợi ý mà không cần nhập lại.',
      'Khi thèm trà sữa, mì gói hay cơm sườn bì chả, hãy sang tab Tìm đồ thay thế để nhận ngay 3 phương án đổi món cân đối hơn.',
    ],
    actionLabel: 'Mở Gợi ý AI',
    actionTarget: 'suggestions',
  },
];

export const HANDBOOK_MEAL_GUIDES: HandbookMealGuide[] = [
  // Bữa Sáng
  {
    id: 'sang-pho-tai',
    slot: 'Sáng',
    title: 'Phở bò tái nạm (ít bánh, thêm hành rau)',
    caloriesRange: '380 – 440 kcal',
    macroFocus: '24–28g Đạm · Ấm bụng, dễ tiêu',
    bestForGoals: ['lose_fat', 'maintain'],
    portionTip: 'Xin ít bánh phở hơn bình thường khoảng 1/3, giữ nguyên phần thịt tái.',
    diningTip: 'Không húp hết nước béo, hạn chế quẩy chiên (1 chiếc quẩy thêm ~120 kcal).',
    swapPromptDish: 'Phở bò tái gầu nhiều nước béo và quẩy',
  },
  {
    id: 'sang-banh-mi-op-la',
    slot: 'Sáng',
    title: 'Bánh mì 2 trứng ốp la + dưa leo, ít pate',
    caloriesRange: '390 – 450 kcal',
    macroFocus: '18–21g Đạm · Tiện mua mang đi',
    bestForGoals: ['maintain', 'build_muscle', 'gain_weight'],
    portionTip: '1 ổ bánh mì vừa + 2 quả trứng + nhiều dưa leo, ngò rí.',
    diningTip: 'Nếu đang giảm mỡ, xin bỏ bơ/pate béo và bớt sốt mayonnaise.',
    swapPromptDish: 'Bánh mì thịt chả pate đầy đủ',
  },
  {
    id: 'sang-khoai-trung',
    slot: 'Sáng',
    title: 'Khoai lang luộc + 2 trứng luộc + sữa không đường',
    caloriesRange: '330 – 380 kcal',
    macroFocus: '19g Đạm · 6g Xơ · No lâu đến trưa',
    bestForGoals: ['lose_fat', 'maintain'],
    portionTip: '1 củ khoai vừa (~150g) + 2 trứng + 1 hộp sữa tươi/sữa hạt không đường.',
    diningTip: 'Tinh bột hấp thu chậm giúp không bị buồn ngủ vào 10h sáng ở văn phòng.',
    swapPromptDish: 'Xôi xéo hành phi chả lụa',
  },
  {
    id: 'sang-yen-mach-chuoi',
    slot: 'Sáng',
    title: 'Yến mạch sữa chua Hy Lạp / chuối + bơ đậu phộng',
    caloriesRange: '430 – 510 kcal',
    macroFocus: '22–26g Đạm · Năng lượng tập gym',
    bestForGoals: ['build_muscle', 'gain_weight'],
    portionTip: '50g yến mạch + 1 hộp sữa chua + 1 quả chuối + 1 thìa nhỏ bơ đậu phộng.',
    diningTip: 'Có thể ngâm qua đêm (overnight oats) để tiết kiệm thời gian buổi sáng.',
    swapPromptDish: 'Bánh ngọt kem bơ và cà phê sữa đặc',
  },

  // Bữa Trưa
  {
    id: 'trua-com-binh-dan',
    slot: 'Trưa',
    title: 'Cơm đĩa chuẩn 50-25-25 (ức gà/cá + rau luộc)',
    caloriesRange: '480 – 560 kcal',
    macroFocus: '32–38g Đạm · Đủ chất không ngấy',
    bestForGoals: ['lose_fat', 'maintain', 'build_muscle'],
    portionTip: '1/2 đĩa rau xanh, 1/4 đĩa thịt nạc/cá, 1/4 đĩa cơm (~1 chén vừa).',
    diningTip: 'Khi ăn cơm tấm hoặc cơm văn phòng, ưu tiên gà nướng bỏ da, thịt kho trứng bỏ mỡ, xin thêm dưa leo/cà chua.',
    swapPromptDish: 'Cơm tấm sườn bì chả mỡ hành',
  },
  {
    id: 'trua-bun-thit-nuong',
    slot: 'Trưa',
    title: 'Bún thịt nướng nhiều rau sống (bỏ chả giò)',
    caloriesRange: '440 – 510 kcal',
    macroFocus: '26–30g Đạm · Thanh mát buổi trưa',
    bestForGoals: ['lose_fat', 'maintain'],
    portionTip: 'Bớt 1/3 lượng bún trắng, ăn hết xà lách dưa leo giá đỗ.',
    diningTip: 'Chan vừa đủ nước mắm pha, tránh rưới thêm dầu hành quá tay.',
    swapPromptDish: 'Bún đậu mắm tôm đầy đủ chả cốm lòng dồi',
  },
  {
    id: 'trua-com-bo-xao',
    slot: 'Trưa',
    title: 'Cơm gạo lứt/trắng + bò xào bông cải + canh đậu hũ',
    caloriesRange: '600 – 680 kcal',
    macroFocus: '38–42g Đạm · Hỗ trợ tăng cơ & tăng cân',
    bestForGoals: ['build_muscle', 'gain_weight'],
    portionTip: '1.5 chén cơm + 130g thịt bò nạc + 1 đĩa bông cải xanh.',
    diningTip: 'Dùng dầu oliu hoặc áp chảo lửa lớn ít dầu để thịt mềm mà không thừa béo.',
    swapPromptDish: 'Cơm chiên dương châu lạp xưởng',
  },

  // Bữa Xế
  {
    id: 'xe-sua-chua-trai-cay',
    slot: 'Xế',
    title: 'Sữa chua không đường + ổi hoặc táo giòn',
    caloriesRange: '130 – 170 kcal',
    macroFocus: '6–10g Đạm · Chống thèm trà sữa 15h',
    bestForGoals: ['lose_fat', 'maintain'],
    portionTip: '1 hộp sữa chua không đường (hoặc Hy Lạp) + 1 quả ổi vừa/1 quả táo.',
    diningTip: 'Uống kèm 1 cốc nước lọc lớn trước khi ăn vặt giúp giảm hẳn cơn thèm đồ ngọt.',
    swapPromptDish: 'Trà sữa trân châu đường đen size L',
  },
  {
    id: 'xe-hat-chuoi',
    slot: 'Xế',
    title: '1 quả chuối + 20g hạt hạnh nhân / sữa đậu nành ít đường',
    caloriesRange: '210 – 260 kcal',
    macroFocus: '8–10g Đạm · Nạp năng lượng trước tập',
    bestForGoals: ['build_muscle', 'gain_weight', 'maintain'],
    portionTip: '1 nắm tay nhỏ hạt không rang muối (~15–20 hạt) + 1 quả chuối.',
    diningTip: 'Ăn trước buổi tập 45–60 phút giúp nâng tạ sung sức hơn.',
    swapPromptDish: 'Bánh tráng trộn nhiều mỡ hành và bò khô',
  },
  {
    id: 'xe-trung-ga',
    slot: 'Xế',
    title: '2 trứng gà luộc hoặc bánh mì đen kẹp ức gà',
    caloriesRange: '160 – 240 kcal',
    macroFocus: '13–22g Đạm · Giữ cơ chiều muộn',
    bestForGoals: ['lose_fat', 'build_muscle'],
    portionTip: '2 quả trứng luộc chấm muối tiêu hoặc 1 lát bánh mì nguyên cám + 60g ức gà.',
    diningTip: 'Bữa xế giàu đạm giúp bạn không bị đói cồn cào dẫn đến ăn quá đà vào bữa tối.',
    swapPromptDish: 'Khoai tây chiên và gà rán',
  },

  // Bữa Tối
  {
    id: 'toi-canh-chua-ca',
    slot: 'Tối',
    title: 'Canh chua cá lóc / cá diêu hồng + nửa chén cơm + rau luộc',
    caloriesRange: '360 – 430 kcal',
    macroFocus: '26–30g Đạm · Nhẹ bụng dễ ngủ',
    bestForGoals: ['lose_fat', 'maintain'],
    portionTip: '1 khứa cá vừa (~120g) + thật nhiều cà chua, bạc hà, giá đỗ + 1/2 chén cơm.',
    diningTip: 'Nên ăn tối trước khi ngủ ít nhất 2.5–3 tiếng và giảm tinh bột so với bữa trưa.',
    swapPromptDish: 'Lẩu thái hải sản kèm nhiều mì gói và viên thả lẩu',
  },
  {
    id: 'toi-salad-uc-ga',
    slot: 'Tối',
    title: 'Salad ức gà áp chảo / cá hồi + khoai lang nhỏ',
    caloriesRange: '380 – 450 kcal',
    macroFocus: '32–36g Đạm · 7g Xơ · Siết mỡ gọn',
    bestForGoals: ['lose_fat', 'build_muscle'],
    portionTip: '120–140g ức gà/cá + đĩa lớn rau xà lách cà chua bi + sốt mè rang để riêng (1 thìa).',
    diningTip: 'Luôn xin để sốt riêng và chấm nhẹ thay vì trộn hết cả gói sốt béo vào rau.',
    swapPromptDish: 'Cơm rang dưa bò buổi tối',
  },
  {
    id: 'toi-mien-ga-bun-gao-lut',
    slot: 'Tối',
    title: 'Miến gà xé phay hoặc bún gạo lứt thịt nạc nhiều rau',
    caloriesRange: '390 – 470 kcal',
    macroFocus: '25–30g Đạm · Ấm áp, đủ chất',
    bestForGoals: ['maintain', 'gain_weight', 'build_muscle'],
    portionTip: '1 tô vừa gà bỏ da + nhiều giá, hành ngò, cải ngọt.',
    diningTip: 'Nếu đang muốn tăng cân lành mạnh, thêm 1 quả trứng chần hoặc 1 ly sữa ấm sau bữa 1 tiếng.',
    swapPromptDish: 'Mì tôm nấu xúc xích trứng chiên đêm',
  },
];

export const HANDBOOK_SWAP_PAIRS: HandbookSwapPair[] = [
  {
    id: 'swap-tra-sua',
    category: 'Đồ uống & Ăn vặt',
    fromDish: 'Trà sữa kem cheese (size L)',
    fromCalories: 520,
    toDish: 'Trà ô long sữa tươi ít đường (size M)',
    toCalories: 165,
    nutritionBadge: 'Ít đường · Thêm canxi',
    whyBetter: 'Cắt đường tinh luyện & kem béo, giữ canxi từ sữa tươi.',
    howToApply: 'Gọi 0–30% đường, thay trân châu bằng sương sáo / hạt chia.',
  },
  {
    id: 'swap-ca-phe',
    category: 'Đồ uống & Ăn vặt',
    fromDish: 'Bạc xỉu / Cà phê nhiều sữa đặc',
    fromCalories: 230,
    toDish: 'Latte sữa tươi không đường / Đen đá',
    toCalories: 75,
    nutritionBadge: 'Ổn định đường huyết',
    whyBetter: 'Tránh tăng vọt đường huyết buổi sáng, tỉnh táo bền hơn.',
    howToApply: 'Dùng sữa tươi không đường hoặc giảm 2/3 lượng sữa đặc.',
  },
  {
    id: 'swap-com-tam',
    category: 'Cơm & Món nước',
    fromDish: 'Cơm tấm sườn bì chả mỡ hành',
    fromCalories: 820,
    toDish: 'Cơm tấm ít cơm + sườn nạc + trứng ốp + rau',
    toCalories: 520,
    nutritionBadge: '~32g Đạm · Ít mỡ bão hòa',
    whyBetter: 'Giữ trọn đạm thịt & trứng, bỏ chất béo bão hòa từ bì mỡ.',
    howToApply: 'Xin ít cơm, bỏ mỡ hành, thêm đồ chua & dưa leo.',
  },
  {
    id: 'swap-mi-goi',
    category: 'Cơm & Món nước',
    fromDish: '2 gói mì chiên + xúc xích',
    fromCalories: 680,
    toDish: 'Phở/bún gạo lứt + 2 trứng + cải ngọt',
    toCalories: 390,
    nutritionBadge: 'Gấp đôi xơ & đạm · Ít muối',
    whyBetter: 'Giảm natri & dầu chiên, bổ sung đạm trứng và vitamin rau xanh.',
    howToApply: 'Chọn sợi gạo lứt hoặc miến dong, thêm 1 nắm rau cải.',
  },
  {
    id: 'swap-ga-ran',
    category: 'Đồ chiên & Béo',
    fromDish: 'Gà rán tẩm bột + khoai chiên',
    fromCalories: 780,
    toDish: 'Đùi gà nướng bỏ da + khoai lang + salad',
    toCalories: 430,
    nutritionBadge: 'Đạm sạch · Tinh bột chậm',
    whyBetter: 'Giữ trọn đạm nạc & chất xơ, tránh dầu chiên nhiệt độ cao.',
    howToApply: 'Chọn gà nướng lò / nồi chiên không dầu, bỏ phần da.',
  },
  {
    id: 'swap-snack',
    category: 'Đồ uống & Ăn vặt',
    fromDish: 'Snack khoai tây / Bánh tráng trộn',
    fromCalories: 440,
    toDish: 'Ổi tươi + Sữa chua Hy Lạp / Hạnh nhân',
    toCalories: 170,
    nutritionBadge: 'Chất xơ & Lợi khuẩn',
    whyBetter: 'Thay muối & gia vị đậm bằng vitamin C, chất xơ và béo tốt.',
    howToApply: 'Chuẩn bị sẵn trái cây cắt nhỏ và ~15 hạt hạnh nhân.',
  },
];

export const HAND_PORTION_RULES: HandPortionRule[] = [
  {
    id: 'hand-protein',
    group: 'Chất đạm',
    handCue: '1 lòng bàn tay',
    equivalent: '≈ 100g thịt/cá (20–25g Đạm)',
    color: '#FF6B6B',
    softBg: '#FFE8E8',
  },
  {
    id: 'hand-carbs',
    group: 'Tinh bột',
    handCue: '1 nắm tay tròn',
    equivalent: '≈ 1 chén cơm vừa',
    color: '#E8A500',
    softBg: '#FFF3CC',
  },
  {
    id: 'hand-fiber',
    group: 'Rau & Chất xơ',
    handCue: '2 bàn tay chụm',
    equivalent: '≈ 1 đĩa rau (4–6g Chất xơ)',
    color: '#2EC4B6',
    softBg: '#D4F4F2',
  },
  {
    id: 'hand-fat',
    group: 'Chất béo tốt',
    handCue: '1 đốt ngón cái',
    equivalent: '≈ 1 thìa dầu oliu / bơ hạt',
    color: '#9D7BFF',
    softBg: '#EDE6FF',
  },
];

export const DINING_OUT_TIPS: string[] = [
  'Ăn theo thứ tự: rau & canh trước → đạm → tinh bột sau để ổn định đường huyết.',
  'Món nước (phở, bún): ăn hết cái, chỉ dùng 1/3 nước dùng để giảm muối & mỡ nổi.',
  'Xin để riêng nước sốt, mỡ hành để chủ động kiểm soát lượng chất béo.',
  'Lỡ ăn bữa nhiều dầu muối: bữa sau tăng rau xanh, uống đủ nước — không nhịn bù.',
];

export function getMealGuidesBySlotAndGoal(
  slot: MealSlot,
  goal: UserGoal,
  onlyMatchingGoal = false
): HandbookMealGuide[] {
  const slotMeals = HANDBOOK_MEAL_GUIDES.filter((m) => m.slot === slot);
  const sorted = [...slotMeals].sort((a, b) => {
    const aMatch = a.bestForGoals.includes(goal) ? 1 : 0;
    const bMatch = b.bestForGoals.includes(goal) ? 1 : 0;
    return bMatch - aMatch;
  });

  if (onlyMatchingGoal) {
    const filtered = sorted.filter((m) => m.bestForGoals.includes(goal));
    return filtered.length > 0 ? filtered : sorted;
  }
  return sorted;
}

export function getHandbookTipsForGoal(
  goal: UserGoal,
  bmiCategory: string
): { headline: string; bulletTips: string[] } {
  switch (goal) {
    case 'lose_fat':
      return {
        headline: `Chiến lược Giảm mỡ bền vững (BMI: ${bmiCategory})`,
        bulletTips: [
          'Ưu tiên Đạm nạc (ức gà, cá, trứng, đậu phụ) và 2 phần rau mỗi bữa chính để no lâu dù thâm hụt calo.',
          'Cắt đồ uống có đường & sốt béo trước tiên — dễ giảm 200–350 kcal/ngày mà không bị đói.',
        ],
      };
    case 'build_muscle':
      return {
        headline: `Chiến lược Tập gym & Tăng cơ (BMI: ${bmiCategory})`,
        bulletTips: [
          'Chia đều lượng Đạm vào 3–4 bữa (25–35g Đạm/bữa) thay vì dồn hết vào bữa tối.',
          'Ăn bữa Xế giàu tinh bột dễ tiêu + đạm nhẹ 45–60 phút trước khi tập để nâng hiệu suất.',
        ],
      };
    case 'gain_weight':
      return {
        headline: `Chiến lược Tăng cân khỏe mạnh (BMI: ${bmiCategory})`,
        bulletTips: [
          'Đừng bỏ bữa Xế — thêm chuối, sữa hạt, hạt dinh dưỡng hoặc sinh tố bơ để tăng calo sạch.',
          'Ưu tiên thực phẩm giàu mật độ dinh dưỡng (cá hồi, trứng, thịt nạc, gạo, bơ) thay cho đồ chiên rán.',
        ],
      };
    case 'maintain':
    default:
      return {
        headline: `Chiến lược Giữ dáng & Ăn lành mạnh (BMI: ${bmiCategory})`,
        bulletTips: [
          'Áp dụng đĩa ăn 50% rau xanh · 25% đạm · 25% tinh bột ở cả bữa Trưa và bữa Tối.',
          'Duy trì uống đủ nước rải đều cả ngày và ghi nhận đủ 3 bữa chính để giữ nhịp sinh học.',
        ],
      };
  }
}
