export type AppTab =
  | 'dashboard'
  | 'reports'
  | 'log'
  | 'history'
  | 'profile'
  | 'suggestions'
  | 'guide';

export type MealSlot = 'Sáng' | 'Trưa' | 'Xế' | 'Tối';

export type Gender = 'female' | 'male';

export type UserGoal =
  | 'lose_fat'
  | 'maintain'
  | 'gain_weight'
  | 'build_muscle';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';

export type BudgetLevel = 'economy' | 'balanced' | 'flexible';

export type CookingTime = 'no_cook' | 'under_15' | '15_to_30' | 'flexible';

export type CookingSkill = 'basic' | 'intermediate' | 'confident';

export type ContextOption =
  | 'Ăn ngoài quán'
  | 'Tự nấu ít dầu'
  | 'Ít cơm'
  | 'Nhiều cơm'
  | 'Ăn một nửa';

export interface MacroValues {
  calories: number;
  protein: number;
  carbs: number;
  fiber: number;
  fat: number;
  sodiumMg?: number;
  sugarG?: number;
}

export interface AnalyzedMealResult extends MacroValues {
  name: string;
  portionEstimate: string;
  itemsDetected: string[];
  contexts: ContextOption[];
  isHealthy: boolean;
  summaryNote: string;
}

export interface MealEntry extends MacroValues {
  id: string;
  slot: MealSlot;
  name: string;
  time: string;
  contexts: ContextOption[];
  imageUrl?: string;
  isHealthy?: boolean;
  portionEstimate?: string;
  summaryNote?: string;
}

export interface SuggestionFeedback {
  liked: string[];
  disliked: string[];
  tried: string[];
}

export interface UserProfile {
  name: string;
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: UserGoal;
  activityLevel: ActivityLevel;
  dietaryTags: string[];
  dietaryNote: string;
  dislikedFoods?: string;
  budgetLevel?: BudgetLevel;
  cookingTime?: CookingTime;
  cookingSkill?: CookingSkill;
  kitchenTools?: string[];
  healthConditions?: string[];
  suggestionFeedback?: SuggestionFeedback;
  bmi: number;
  bmiCategory: string;
  bmr: number;
  tdee: number;
  targetCalories: number;
  targets: {
    protein: number;
    carbs: number;
    fiber: number;
    fat: number;
  };
  waterTargetCups: number;
  createdAt: string;
}

export type MealsByDate = Record<string, MealEntry[]>;
export type WaterByDate = Record<string, number>;

export interface WeeklyDayStat {
  dateKey: string;
  day: string;
  calories: number;
  target: number;
  isToday: boolean;
}

export type MealDiningMode = 'eat_out' | 'home_cook';

export interface MealRecipe {
  ingredients: string[];
  steps: string[];
  cookTip?: string;
}

export interface MealSuggestion extends MacroValues {
  name: string;
  slot: MealSlot;
  portionEstimate: string;
  whyItFits: string;
  swapTip: string;
  diningMode?: MealDiningMode;
  estimatedCostVnd?: string;
  prepMinutes?: number;
  recipe?: MealRecipe;
}

export interface FoodSwapItem {
  alternativeName: string;
  calories: number;
  calorieDiff: number;
  protein: number;
  reason: string;
  howToOrderOrCook: string;
}

export interface FoodSwapResponse {
  originalDish: string;
  originalEstimatedCalories: number;
  swaps: FoodSwapItem[];
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
}

export interface PeriodBucketStat {
  label: string;
  avgCalories: number;
  loggedDays: number;
  target: number;
  isCurrent: boolean;
}

export interface PeriodReportStats {
  period: 'week' | 'month';
  totalDaysWindow: number;
  loggedDaysCount: number;
  totalMealsCount: number;
  uniqueDishesCount: number;
  avgCalories: number;
  avgMacros: {
    protein: number;
    carbs: number;
    fiber: number;
    fat: number;
  };
  slotCounts: Record<MealSlot, number>;
  slotCalorieShare: Record<MealSlot, number>;
  deficientNutrients: string[];
  buckets: PeriodBucketStat[];
}

export interface ReportInsightResult {
  headline: string;
  strengths: string;
  watchOut: string;
  actionTip: string;
}

export type MascotMood = 'fresh' | 'encourage' | 'celebrate' | 'gentle_nudge';

export interface CompanionChatReply {
  reply: string;
  quickTip: string;
  suggestedAction?: 'log' | 'suggestions' | 'guide' | 'reports';
}

export interface WeightEntry {
  dateKey: string;
  weightKg: number;
  bmi: number;
  updatedAt: string;
}

export interface ReminderSettings {
  browserEnabled: boolean;
  remindMeals: boolean;
  remindWater: boolean;
}

export type DishCuisine = 'vietnam' | 'healthy_intl' | 'drink';

export interface DishBankItem extends MacroValues {
  id: string;
  name: string;
  slots: MealSlot[];
  diningMode: MealDiningMode;
  cuisine: DishCuisine;
  portionEstimate: string;
  budgetLevel: BudgetLevel;
  estimatedCostVnd: string;
  prepMinutes: number;
  tools: string[];
  avoidIf?: string[];
  allergens?: string[];
  whyItFits: string;
  swapTip: string;
  recipe?: MealRecipe;
}


