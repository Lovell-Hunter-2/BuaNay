import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

interface AnalyzeMealBody {
  description?: string;
  contexts?: string[];
  slot?: string;
  imageDataUrl?: string;
}

interface GeminiMealAnalysis {
  name: string;
  portionEstimate: string;
  itemsDetected: string[];
  calories: number;
  protein: number;
  carbs: number;
  fiber: number;
  fat: number;
  sodiumMg: number;
  sugarG: number;
  isHealthy: boolean;
  summaryNote: string;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('MISSING_GEMINI_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 12000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseDataUrl(
  dataUrl: string
): { mimeType: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) return null;
  const mimeType = match[1];
  const data = match[2];
  if (!mimeType.startsWith('image/') || !data) return null;
  return { mimeType, data };
}

function buildMealPrompt(params: {
  description: string;
  contexts: string[];
  slot: string;
  hasImage: boolean;
}): string {
  const contextText =
    params.contexts.length > 0
      ? params.contexts.join(', ')
      : 'Không có ghi chú bối cảnh thêm';

  const lines = [
    'Bạn là chuyên gia dinh dưỡng lâm sàng am hiểu ẩm thực Việt Nam và quốc tế.',
    params.hasImage
      ? 'Hãy quan sát kỹ ảnh bữa ăn đính kèm: nhận diện chính xác tên món ăn, đếm số lượng phần ăn/chén/miếng/quả nhìn thấy trong ảnh, phương pháp chế biến (luộc, hấp, nướng, chiên, xào), nước chấm và rau ăn kèm.'
      : 'Hãy phân tích món ăn từ mô tả văn bản của người dùng với khẩu phần phổ biến tại Việt Nam.',
    `Buổi ăn: ${params.slot || 'Chưa rõ'}.`,
    `Mô tả từ người dùng: ${params.description ? `"${params.description}"` : 'Không có mô tả chữ.'}`,
    `Bối cảnh người dùng chọn: ${contextText}.`,
    'Quy tắc ước lượng chuẩn xác:',
    '- KHÔNG áp dụng cộng/trừ máy móc cứng nhắc; hãy suy luận theo bản chất từng món (ví dụ: món luộc/hấp ngoài quán như trứng vịt lộn luộc hay phở thanh thì không tự cộng thêm nhiều dầu chiên; nếu có "Ít cơm" hoặc "Nhiều cơm" thì điều chỉnh phần cơm trong món có cơm; nếu có "Ăn một nửa" thì tính bằng 50% tổng khẩu phần quan sát được; nếu có "Tự nấu ít dầu" thì giảm lượng chất béo từ dầu ăn hợp lý).',
    '- Giá trị calories phải nhất quán với đạm, tinh bột và chất béo (4*protein + 4*carbs + 9*fat tương đương calories).',
    '- Ước lượng thêm sodiumMg (lượng muối Natri tính bằng mg từ nước mắm, nước dùng, đồ kho/mặn) và sugarG (lượng đường tự do/thêm tính bằng gram từ đồ ngọt, nước sốt, trà sữa).',
    '- Trả lời hoàn toàn bằng tiếng Việt tự nhiên, thân thiện cho người trẻ 20–30 tuổi.',
    '- summaryNote viết ngắn gọn 1–2 câu nêu rõ điểm mạnh/hạn chế dinh dưỡng của đúng món này và 1 gợi ý cân bằng thực tế.',
  ];

  return lines.join('\n');
}

const MEAL_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description:
        'Tên món ăn tiếng Việt chính xác kèm số lượng/khẩu phần chính (ví dụ: "Trứng vịt lộn (3 quả) kèm rau răm, gừng").',
    },
    portionEstimate: {
      type: Type.STRING,
      description:
        'Mô tả ngắn khẩu phần quan sát hoặc ước tính (ví dụ: "3 chén trứng vịt lộn luộc (~210g), rau răm và gừng tươi").',
    },
    itemsDetected: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Danh sách 2–6 thành phần chính nhận diện được.',
    },
    calories: {
      type: Type.INTEGER,
      description: 'Tổng năng lượng ước tính (kcal).',
    },
    protein: {
      type: Type.INTEGER,
      description: 'Lượng chất đạm ước tính (gram).',
    },
    carbs: {
      type: Type.INTEGER,
      description: 'Lượng tinh bột/đường ước tính (gram).',
    },
    fiber: {
      type: Type.INTEGER,
      description: 'Lượng chất xơ ước tính (gram).',
    },
    fat: {
      type: Type.INTEGER,
      description: 'Lượng chất béo ước tính (gram).',
    },
    sodiumMg: {
      type: Type.INTEGER,
      description: 'Lượng muối Natri ước tính (mg), ví dụ phở/bún nhiều nước dùng khoảng 900–1400mg.',
    },
    sugarG: {
      type: Type.INTEGER,
      description: 'Lượng đường tự do/đường thêm ước tính (gram).',
    },
    isHealthy: {
      type: Type.BOOLEAN,
      description:
        'true nếu món ăn cân đối dinh dưỡng, ít chiên rán/đường tinh luyện; false nếu nhiều dầu mỡ, tinh bột nhanh hoặc cholesterol/natri cao.',
    },
    summaryNote: {
      type: Type.STRING,
      description:
        'Nhận xét dinh dưỡng thực tế 1–2 câu bằng tiếng Việt về ưu/nhược điểm của món và gợi ý đi kèm.',
    },
  },
  required: [
    'name',
    'portionEstimate',
    'itemsDetected',
    'calories',
    'protein',
    'carbs',
    'fiber',
    'fat',
    'sodiumMg',
    'sugarG',
    'isHealthy',
    'summaryNote',
  ],
};

function sanitizeAnalysis(raw: Partial<GeminiMealAnalysis>): GeminiMealAnalysis {
  const toNonNegInt = (val: unknown, fallback: number) => {
    const num = Number(val);
    return Number.isFinite(num) && num >= 0 ? Math.round(num) : fallback;
  };

  const protein = toNonNegInt(raw.protein, 15);
  const carbs = toNonNegInt(raw.carbs, 30);
  const fiber = toNonNegInt(raw.fiber, 3);
  const fat = toNonNegInt(raw.fat, 10);
  const macroCalories = protein * 4 + carbs * 4 + fat * 9;
  const rawCalories = toNonNegInt(raw.calories, macroCalories || 250);
  const calories =
    rawCalories > 0 ? rawCalories : Math.max(10, macroCalories);

  const itemsDetected = Array.isArray(raw.itemsDetected)
    ? raw.itemsDetected
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .slice(0, 6)
    : [];

  return {
    name:
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : 'Món ăn đã nhận diện',
    portionEstimate:
      typeof raw.portionEstimate === 'string' && raw.portionEstimate.trim()
        ? raw.portionEstimate.trim()
        : 'Khẩu phần tiêu chuẩn',
    itemsDetected,
    calories,
    protein,
    carbs,
    fiber,
    fat,
    sodiumMg: toNonNegInt(raw.sodiumMg, 420),
    sugarG: toNonNegInt(raw.sugarG, 4),
    isHealthy: Boolean(raw.isHealthy),
    summaryNote:
      typeof raw.summaryNote === 'string' && raw.summaryNote.trim()
        ? raw.summaryNote.trim()
        : 'Đã ước tính dinh dưỡng dựa trên thành phần và bối cảnh bữa ăn.',
  };
}

async function generateJsonWithRetry(
  ai: GoogleGenAI,
  parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }>,
  responseSchema: Record<string, unknown>
): Promise<{ text: string; model: string }> {
  const callModel = async (model: string, withLowThinking: boolean) => {
    return ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema,
        ...(withLowThinking
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
      },
    });
  };

  const isTransientError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    const low = msg.toLowerCase();
    return (
      msg.includes('503') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('high demand') ||
      msg.includes('429') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      low.includes('timeout') ||
      low.includes('aborted') ||
      low.includes('etimedout') ||
      low.includes('fetch failed')
    );
  };

  const attempts: Array<{ model: string; withLowThinking: boolean; delayMs: number }> = [
    { model: MODEL_NAME, withLowThinking: true, delayMs: 0 },
    { model: 'gemini-3.1-flash-lite', withLowThinking: false, delayMs: 150 },
  ];

  let lastErr: unknown = null;
  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      await new Promise((r) => setTimeout(r, attempt.delayMs));
    }
    try {
      const response = await callModel(attempt.model, attempt.withLowThinking);
      return { text: (response.text ?? '').trim(), model: attempt.model };
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err)) {
        throw err;
      }
    }
  }

  throw lastErr ?? new Error('EMPTY_RESPONSE');
}

function handleGeminiRouteError(err: unknown, res: Response, tag: string) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(tag, err);

  if (message === 'MISSING_GEMINI_API_KEY') {
    res.status(503).json({
      error:
        'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng kiểm tra mục Settings > Secrets trong AI Studio.',
    });
    return;
  }

  if (
    message.includes('API_KEY_INVALID') ||
    message.includes('PERMISSION_DENIED') ||
    message.includes('403')
  ) {
    res.status(403).json({
      error:
        'GEMINI_API_KEY không hợp lệ hoặc chưa đủ quyền. Vui lòng kiểm tra lại trong Settings > Secrets.',
    });
    return;
  }

  if (
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('429') ||
    message.includes('503') ||
    message.includes('UNAVAILABLE')
  ) {
    res.status(503).json({
      error:
        'Hệ thống AI đang quá tải tạm thời. Bạn đợi vài giây rồi thử lại nhé.',
    });
    return;
  }

  if (message.includes('NOT_FOUND') || message.includes('404')) {
    res.status(502).json({
      error: `Model AI (${MODEL_NAME}) hiện chưa khả dụng: ${message.slice(0, 120)}`,
    });
    return;
  }

  res.status(500).json({
    error:
      'Không thể xử lý yêu cầu AI lúc này. Vui lòng kiểm tra kết nối và thử lại.',
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, model: MODEL_NAME });
  });

  app.post('/api/analyze-meal', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as AnalyzeMealBody;
      const description =
        typeof body.description === 'string' ? body.description.trim() : '';
      const contexts = Array.isArray(body.contexts)
        ? body.contexts.filter((c): c is string => typeof c === 'string')
        : [];
      const slot = typeof body.slot === 'string' ? body.slot.trim() : '';
      const imagePart =
        typeof body.imageDataUrl === 'string'
          ? parseDataUrl(body.imageDataUrl)
          : null;

      if (!imagePart && !description) {
        res.status(400).json({
          error:
            'Vui lòng chụp/tải ảnh món ăn hoặc nhập mô tả trước khi phân tích.',
        });
        return;
      }

      const ai = getGeminiClient();
      const promptText = buildMealPrompt({
        description,
        contexts,
        slot,
        hasImage: Boolean(imagePart),
      });

      const parts: Array<
        | { inlineData: { mimeType: string; data: string } }
        | { text: string }
      > = [];
      if (imagePart) {
        parts.push({ inlineData: imagePart });
      }
      parts.push({ text: promptText });

      const { text: rawText, model: usedModel } = await generateJsonWithRetry(
        ai,
        parts,
        MEAL_RESPONSE_SCHEMA
      );

      if (!rawText) {
        res.status(502).json({
          error: 'AI chưa trả về kết quả phân tích. Bạn thử bấm phân tích lại nhé!',
        });
        return;
      }

      const parsed = JSON.parse(rawText) as Partial<GeminiMealAnalysis>;
      const result = sanitizeAnalysis(parsed);
      res.json({ analysis: result, model: usedModel });
    } catch (err: unknown) {
      handleGeminiRouteError(err, res, '[/api/analyze-meal error]');
    }
  });

  app.post('/api/suggest-meals', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        mode?: 'menu' | 'swap' | 'report_insight' | 'companion_chat';
        diningMode?: 'eat_out' | 'home_cook';
        availableIngredients?: string;
        profile?: {
          name?: string;
          gender?: string;
          age?: number;
          heightCm?: number;
          weightKg?: number;
          bmi?: number;
          bmiCategory?: string;
          goal?: string;
          activityLevel?: string;
          dietaryTags?: string[];
          dietaryNote?: string;
          dislikedFoods?: string;
          budgetLevel?: string;
          cookingTime?: string;
          cookingSkill?: string;
          kitchenTools?: string[];
          healthConditions?: string[];
          suggestionFeedback?: {
            liked?: string[];
            disliked?: string[];
            tried?: string[];
          };
          targetCalories?: number;
          targets?: { protein?: number; carbs?: number; fiber?: number; fat?: number };
        };
        remaining?: {
          calories?: number;
          protein?: number;
          carbs?: number;
          fiber?: number;
          fat?: number;
        };
        cravingDish?: string;
        preferredSlot?: string;
        period?: 'week' | 'month';
        reportStats?: {
          loggedDaysCount?: number;
          totalMealsCount?: number;
          uniqueDishesCount?: number;
          avgCalories?: number;
          avgMacros?: { protein?: number; carbs?: number; fiber?: number; fat?: number };
          slotCalorieShare?: Record<string, number>;
          deficientNutrients?: string[];
        };
        question?: string;
        waterCups?: number;
      };

      const mode = body.mode ?? 'menu';
      const p = body.profile ?? {};
      const rem = body.remaining ?? {};
      const dietaryTags = Array.isArray(p.dietaryTags) ? p.dietaryTags.join(', ') : '';
      const kitchenTools = Array.isArray(p.kitchenTools) ? p.kitchenTools.join(', ') : '';
      const healthConditions = Array.isArray(p.healthConditions)
        ? p.healthConditions.filter((h) => h !== 'Bình thường').join(', ')
        : '';
      const liked = Array.isArray(p.suggestionFeedback?.liked)
        ? p.suggestionFeedback!.liked.slice(0, 8).join(', ')
        : '';
      const dislikedFeedback = Array.isArray(p.suggestionFeedback?.disliked)
        ? p.suggestionFeedback!.disliked.slice(0, 10).join(', ')
        : '';
      const tried = Array.isArray(p.suggestionFeedback?.tried)
        ? p.suggestionFeedback!.tried.slice(0, 8).join(', ')
        : '';

      const ai = getGeminiClient();

      const profileSummary = [
        `Người dùng: ${p.name || 'Bạn'}, ${p.gender === 'male' ? 'Nam' : 'Nữ'}, ${p.age ?? 24} tuổi, cao ${p.heightCm ?? 165}cm, nặng ${p.weightKg ?? 58}kg.`,
        `BMI: ${p.bmi ?? 'N/A'} (${p.bmiCategory || 'Chưa rõ'}).`,
        `Mục tiêu: ${p.goal || 'maintain'}. Mức vận động: ${p.activityLevel || 'light'}.`,
        `Mục tiêu ngày: ${p.targetCalories ?? 1800} kcal (Đạm ${p.targets?.protein ?? 80}g, Tinh bột ${p.targets?.carbs ?? 200}g, Chất xơ ${p.targets?.fiber ?? 25}g, Chất béo ${p.targets?.fat ?? 50}g).`,
        `Nhu cầu còn lại hôm nay: ${rem.calories ?? 0} kcal, Đạm ${rem.protein ?? 0}g, Tinh bột ${rem.carbs ?? 0}g, Chất xơ ${rem.fiber ?? 0}g, Chất béo ${rem.fat ?? 0}g.`,
        `Thói quen & dị ứng: ${dietaryTags || 'Không có'}; Ghi chú thêm: ${p.dietaryNote || 'Không có'}.`,
        `Thực phẩm không thích (tránh gợi ý): ${p.dislikedFoods || 'Không có'}.`,
        `Ngân sách: ${p.budgetLevel || 'balanced'}; Thời gian nấu: ${p.cookingTime || 'under_15'}; Trình độ nấu: ${p.cookingSkill || 'basic'}; Dụng cụ có sẵn: ${kitchenTools || 'Bếp cơ bản'}.`,
        `Tình trạng sức khỏe lưu ý: ${healthConditions || 'Bình thường'}.`,
        liked ? `Món đã thích trước đây: ${liked}.` : '',
        dislikedFeedback ? `Món từng đánh giá KHÔNG HỢP (tuyệt đối tránh lặp lại): ${dislikedFeedback}.` : '',
        tried ? `Món đã thử gần đây (ưu tiên đổi vị nhẹ): ${tried}.` : '',
      ]
        .filter(Boolean)
        .join('\n');

      if (mode === 'companion_chat') {
        const question = typeof body.question === 'string' ? body.question.trim() : '';
        if (!question) {
          res.status(400).json({ error: 'Vui lòng nhập câu hỏi cho Mầm.' });
          return;
        }
        const chatPrompt = [
          'Bạn là Mầm — linh vật trợ lý dinh dưỡng thân thiện, không phán xét của app BữaNay dành cho người trẻ 20–30 tuổi.',
          profileSummary,
          `Lượng nước đã uống hôm nay: ${(Number(body.waterCups ?? 0) * 0.2).toFixed(1)}L.`,
          `Câu hỏi từ người dùng: "${question}"`,
          'Hãy trả lời ngắn gọn 2–3 câu bằng tiếng Việt tự nhiên, ấm áp, dựa trên đúng số liệu thật ở trên (không bịa số liệu). Kèm 1 mẹo hành động cụ thể.',
        ].join('\n');

        const chatSchema = {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            quickTip: { type: Type.STRING },
            suggestedAction: {
              type: Type.STRING,
              description: 'Một trong: log, suggestions, guide, reports',
            },
          },
          required: ['reply', 'quickTip', 'suggestedAction'],
        };

        const { text: rawText, model: usedModel } = await generateJsonWithRetry(
          ai,
          [{ text: chatPrompt }],
          chatSchema
        );
        if (!rawText) {
          res.status(502).json({ error: 'Mầm chưa kịp phản hồi, bạn hỏi lại nhé!' });
          return;
        }
        res.json({ companion: JSON.parse(rawText), model: usedModel });
        return;
      }

      if (mode === 'report_insight') {
        const rs = body.reportStats ?? {};
        const periodLabel = body.period === 'month' ? '30 ngày qua (Báo cáo Tháng)' : '7 ngày qua (Báo cáo Tuần)';
        const reportPrompt = [
          'Bạn là Mầm — linh vật trợ lý dinh dưỡng thân thiện của BữaNay.',
          profileSummary,
          `Dữ liệu thực tế trong ${periodLabel}:`,
          `- Số ngày có ghi nhận: ${rs.loggedDaysCount ?? 0} ngày (${rs.totalMealsCount ?? 0} bữa, ${rs.uniqueDishesCount ?? 0} món khác nhau).`,
          `- Trung bình ngày đã ghi: ${rs.avgCalories ?? 0} kcal (Đạm ${rs.avgMacros?.protein ?? 0}g, Tinh bột ${rs.avgMacros?.carbs ?? 0}g, Xơ ${rs.avgMacros?.fiber ?? 0}g, Béo ${rs.avgMacros?.fat ?? 0}g).`,
          `- Tỷ trọng calo theo buổi (%): ${JSON.stringify(rs.slotCalorieShare ?? {})}.`,
          `- Nhóm chất thường thiếu/cần chú ý: ${(rs.deficientNutrients ?? []).join(', ') || 'Khá cân đối'}.`,
          'Hãy giải thích báo cáo bằng ngôn ngữ dễ hiểu, động viên tích cực, không gây áp lực hay phán xét, và đưa ra 1 hướng điều chỉnh thực tế. Báo cáo mang tính tham khảo, không chẩn đoán y tế.',
        ].join('\n');

        const insightSchema = {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            strengths: { type: Type.STRING },
            watchOut: { type: Type.STRING },
            actionTip: { type: Type.STRING },
          },
          required: ['headline', 'strengths', 'watchOut', 'actionTip'],
        };

        const { text: rawText, model: usedModel } = await generateJsonWithRetry(
          ai,
          [{ text: reportPrompt }],
          insightSchema
        );
        if (!rawText) {
          res.status(502).json({ error: 'Chưa thể tạo nhận xét báo cáo lúc này.' });
          return;
        }
        res.json({ insight: JSON.parse(rawText), model: usedModel });
        return;
      }

      if (mode === 'swap') {
        const craving = typeof body.cravingDish === 'string' ? body.cravingDish.trim() : '';
        if (!craving) {
          res.status(400).json({
            error: 'Vui lòng nhập món ăn bạn đang thèm hoặc muốn tìm đồ thay thế.',
          });
          return;
        }

        const swapPrompt = [
          'Bạn là chuyên gia dinh dưỡng Việt Nam.',
          profileSummary,
          `Người dùng đang cân nhắc ăn/uống món: "${craving}".`,
          'Hãy ước tính calo món gốc và gợi ý 3 lựa chọn thay thế lành mạnh hơn hoặc dễ đặt ngoài quán/tự làm tại Việt Nam, phù hợp đúng mục tiêu, ngân sách, tình trạng sức khỏe và sở thích của họ.',
          'Trả lời hoàn toàn bằng tiếng Việt tự nhiên, thực tế.',
        ].join('\n');

        const swapSchema = {
          type: Type.OBJECT,
          properties: {
            originalDish: { type: Type.STRING },
            originalEstimatedCalories: { type: Type.INTEGER },
            swaps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  alternativeName: { type: Type.STRING },
                  calories: { type: Type.INTEGER },
                  calorieDiff: {
                    type: Type.INTEGER,
                    description: 'Số kcal giảm được (số âm, ví dụ -220) hoặc chênh lệch so với món gốc.',
                  },
                  protein: { type: Type.INTEGER },
                  reason: { type: Type.STRING },
                  howToOrderOrCook: { type: Type.STRING },
                },
                required: [
                  'alternativeName',
                  'calories',
                  'calorieDiff',
                  'protein',
                  'reason',
                  'howToOrderOrCook',
                ],
              },
            },
          },
          required: ['originalDish', 'originalEstimatedCalories', 'swaps'],
        };

        const { text: rawText, model: usedModel } = await generateJsonWithRetry(
          ai,
          [{ text: swapPrompt }],
          swapSchema
        );
        if (!rawText) {
          res.status(502).json({ error: 'AI chưa trả về gợi ý thay thế. Thử lại nhé!' });
          return;
        }
        const swapResult = JSON.parse(rawText);
        res.json({ swapResult, model: usedModel });
        return;
      }

      const diningMode = body.diningMode === 'home_cook' ? 'home_cook' : 'eat_out';
      const availableIngredients =
        typeof body.availableIngredients === 'string'
          ? body.availableIngredients.trim()
          : '';

      const menuPrompt = [
        'Bạn là chuyên gia dinh dưỡng & bếp trưởng Việt Nam hỗ trợ người trẻ bận rộn 20–30 tuổi.',
        profileSummary,
        `Buổi ăn ưu tiên gợi ý: ${body.preferredSlot || 'Phù hợp phần calo còn lại hôm nay'}.`,
        diningMode === 'home_cook'
          ? `HÌNH THỨC: TỰ NẤU TẠI NHÀ. Nguyên liệu người dùng đang có sẵn: "${availableIngredients || 'Chưa nhập (hãy gợi ý món từ nguyên liệu siêu thị bình dân dễ mua)'}". BẮT BUỘC ưu tiên tận dụng tối đa nguyên liệu sẵn có, phù hợp thời gian nấu và dụng cụ đã khai báo, và trả kèm công thức đầy đủ gồm định lượng nguyên liệu + các bước nấu từng bước dễ làm.`
          : 'HÌNH THỨC: ĂN NGOÀI / ĐẶT MÓN. Hãy gợi ý 3 món Việt Nam dễ mua ngoài quán hoặc đặt giao đồ ăn, hợp đúng ngân sách, tình trạng sức khỏe, sở thích và lượng calo/chất còn lại hôm nay. Kèm khoảng giá ước tính VNĐ.',
        'Tránh tuyệt đối thực phẩm dị ứng/không thích và các món người dùng đã bấm không hợp.',
        'Trả lời hoàn toàn bằng tiếng Việt.',
      ].join('\n');

      const menuSchema = {
        type: Type.OBJECT,
        properties: {
          summaryTip: { type: Type.STRING },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                slot: { type: Type.STRING, description: 'Một trong: Sáng, Trưa, Xế, Tối' },
                portionEstimate: { type: Type.STRING },
                calories: { type: Type.INTEGER },
                protein: { type: Type.INTEGER },
                carbs: { type: Type.INTEGER },
                fiber: { type: Type.INTEGER },
                fat: { type: Type.INTEGER },
                whyItFits: { type: Type.STRING },
                swapTip: { type: Type.STRING },
                estimatedCostVnd: { type: Type.STRING, description: 'Ví dụ: ~35.000đ - 45.000đ' },
                prepMinutes: { type: Type.INTEGER, description: 'Số phút chuẩn bị/nấu nếu tự nấu' },
                recipe: {
                  type: Type.OBJECT,
                  properties: {
                    ingredients: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'Nguyên liệu kèm định lượng cụ thể (gram, quả, thìa).',
                    },
                    steps: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: '3 đến 5 bước chế biến ngắn gọn, dễ làm.',
                    },
                    cookTip: { type: Type.STRING },
                  },
                  required: ['ingredients', 'steps'],
                },
              },
              required: [
                'name',
                'slot',
                'portionEstimate',
                'calories',
                'protein',
                'carbs',
                'fiber',
                'fat',
                'whyItFits',
                'swapTip',
              ],
            },
          },
        },
        required: ['summaryTip', 'suggestions'],
      };

      const { text: rawText, model: usedModel } = await generateJsonWithRetry(
        ai,
        [{ text: menuPrompt }],
        menuSchema
      );
      if (!rawText) {
        res.status(502).json({ error: 'AI chưa trả về thực đơn gợi ý. Thử lại nhé!' });
        return;
      }
      const parsed = JSON.parse(rawText) as {
        summaryTip?: string;
        suggestions?: Array<Record<string, unknown>>;
      };
      const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions.map((s) => ({
            ...s,
            diningMode,
          }))
        : [];
      res.json({
        summaryTip: parsed.summaryTip || '',
        suggestions,
        model: usedModel,
      });
    } catch (err: unknown) {
      handleGeminiRouteError(err, res, '[/api/suggest-meals error]');
    }
  });

  // Ensure /api/* requests NEVER fall through to Vite or SPA HTML fallback
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Không tìm thấy đường dẫn API yêu cầu.' });
  });

  app.use(
    '/api',
    (
      err: unknown,
      _req: Request,
      res: Response,
      _next: express.NextFunction
    ) => {
      const status =
        typeof (err as { status?: unknown })?.status === 'number'
          ? ((err as { status: number }).status)
          : 500;
      if (status === 413) {
        res.status(413).json({
          error: 'Ảnh tải lên hơi nặng. Bạn thử chọn ảnh dung lượng nhỏ hơn nhé!',
        });
        return;
      }
      res.status(status >= 400 ? status : 500).json({
        error: 'Yêu cầu dữ liệu chưa hợp lệ. Bạn thử lại giúp nhé!',
      });
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BữaNay server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
