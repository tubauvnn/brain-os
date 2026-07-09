// Image Agent contracts. Image Agent KHÔNG tự vẽ, KHÔNG gọi API ngoài ở Phase
// 6 — chỉ dựng Prompt Pack JSON có cấu trúc, sẵn sàng đưa cho 1 image
// generator thật (DALL-E/Midjourney/Stable Diffusion/...) sau này. Mọi dữ
// liệu liên quan nhân vật PHẢI lấy từ Character Agent (src/lib/character/),
// KHÔNG tự bịa — đúng yêu cầu Phase 6 "must never invent character details".

// Tham chiếu nhân vật trong 1 prompt pack — lấy nguyên từ Character Agent,
// không chỉnh sửa/diễn giải thêm. canonImagePath/canonImageAvailable thêm cho
// ChinChin Character Canon (assets/chinchin/characters/) — ảnh THẬT là nguồn
// sự thật duy nhất, PHẢI tham chiếu trước khi sinh bất kỳ hình ảnh nào.
export type CharacterReference = {
  id: string;
  name: string;
  visualPrompt: string;
  forbiddenChanges: string[];
  consistencyScore: number;
  canonImagePath: string;
  canonImageAvailable: boolean;
};

// Prompt Pack JSON — output DUY NHẤT của Image Agent Phase 6. heightChartReference
// thêm cho ChinChin Character Canon — tham chiếu tỉ lệ chiều cao dùng chung
// khi cảnh có từ 2 nhân vật trở lên.
export type PromptPack = {
  characterReferences: CharacterReference[];
  sceneDescription: string;
  style: string;
  pose: string;
  expression: string;
  cameraAngle: string;
  background: string;
  negativePrompts: string[];
  consistencyNotes: string[];
  heightChartReference?: string;
};
