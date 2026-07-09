// Character contracts. Character Agent KHÔNG phải Image Agent — đây là nguồn
// sự thật DUY NHẤT về nhân vật/IP hư cấu trong Brain OS (docs yêu cầu Phase
// 5: "Never duplicate character information elsewhere"). Image/Video/Voice/
// Comic Agent sau này PHẢI xin dữ liệu nhân vật qua Character Agent, không tự
// giữ bản sao riêng.

export type CharacterRelationship = {
  name: string;
  relation: string;
};

// Character Model — đầy đủ field theo yêu cầu Phase 5.
export type Character = {
  id: string;
  name: string;
  universe: string;
  species: string;
  personality: string;
  appearance: string;
  canonicalColors: string[];
  bodyProportions: string;
  facialFeatures: string;
  accessories: string[];
  voiceProfile: string;
  speakingStyle: string;
  relationships: CharacterRelationship[];
  history: string;
  visualRules: string[];
  forbiddenChanges: string[];
};

// Output JSON — kết quả Character Agent trả về cho 1 nhân vật, đúng shape
// Phase 5 yêu cầu (character/appearance/personality/styleGuide/visualPrompt/
// voicePrompt/consistencyScore). "character" chỉ là định danh gọn — dữ liệu
// đầy đủ nằm trong Character Model (characters.ts), không lặp lại ở đây để
// tránh 2 bản sao lệch nhau.
export type CharacterOutput = {
  character: { id: string; name: string; universe: string; species: string };
  appearance: string;
  personality: string;
  styleGuide: string[];
  visualPrompt: string;
  voicePrompt: string;
  consistencyScore: number;
};

// Consistency Checker — so khớp override (nếu agent khác yêu cầu nhân vật với
// mô tả khác canonical) với Character Model gốc. Không override → khớp tuyệt
// đối (score 1), đúng nghĩa "No drift is allowed" khi Character Agent tự phát
// dữ liệu canonical của chính nó.
export type ConsistencyOverride = Partial<
  Pick<Character, "appearance" | "canonicalColors" | "bodyProportions" | "personality" | "voiceProfile" | "relationships">
>;

export type ConsistencyCheckResult = {
  score: number;
  mismatches: string[];
};
