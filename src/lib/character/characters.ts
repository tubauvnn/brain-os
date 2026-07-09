import type { Character } from "./types";

// Character Memory — Character Agent "nhớ" toàn bộ nhân vật đã biết, KHÔNG
// cần user mô tả lại (đúng yêu cầu Phase 5). Phase 5 lưu dạng in-memory seed
// (3 nhân vật vũ trụ Onigiri City) — đủ để chứng minh vertical slice; chuyển
// sang bảng Postgres riêng (giống Memory/Knowledge) là bước sau, không đổi
// contract Character/CharacterOutput ở types.ts.

const CHARACTERS: Character[] = [
  {
    id: "cam",
    name: "Cam",
    universe: "Onigiri City",
    species: "Rice Spirit (tinh linh cơm nắm)",
    personality: "Năng động, nhiệt huyết, thích phiêu lưu.",
    appearance: "Mặt cơm nắm màu cam, đội vương miện ngọn lửa nhỏ trên đầu.",
    canonicalColors: ["cam (orange)", "đỏ ngọn lửa (flame red)"],
    bodyProportions: "Thân tròn, đầu to bằng khoảng 2/3 cơ thể, tay chân ngắn.",
    facialFeatures: "Mắt to tròn, không đeo kính.",
    accessories: ["vương miện ngọn lửa (flame crown)"],
    voiceProfile: "Giọng cao, nhanh, tràn đầy năng lượng.",
    speakingStyle: "Nói nhanh, hay dùng câu cảm thán, thích hô khẩu hiệu.",
    relationships: [
      { name: "Trang", relation: "bạn thân" },
      { name: "Nâu", relation: "coi như anh lớn" },
    ],
    history: "Nhân vật đầu tiên của Onigiri City, đại diện tinh thần nhiệt huyết của thương hiệu.",
    visualRules: ["Luôn giữ màu cam chủ đạo trên mặt.", "Vương miện ngọn lửa luôn hiện diện khi xuất hiện."],
    forbiddenChanges: ["Không bao giờ đeo kính.", "Không đổi màu mặt sang màu khác cam."],
  },
  {
    id: "trang",
    name: "Trang",
    universe: "Onigiri City",
    species: "Rice Spirit (tinh linh cơm nắm)",
    personality: "Dịu dàng, ấm áp, chu đáo.",
    appearance: "Mặt cơm nắm màu trắng, có mầm cây hình trái tim mọc trên đầu.",
    canonicalColors: ["trắng (white)", "xanh lá nhạt (soft green, mầm cây)"],
    bodyProportions: "Nhỏ nhất trong nhóm, thân tròn nhỏ nhắn.",
    facialFeatures: "Mắt to, hiền, má hồng.",
    accessories: ["mầm cây hình trái tim (heart sprout)"],
    voiceProfile: "Giọng nhỏ nhẹ, trong trẻo.",
    speakingStyle: "Nói chậm rãi, nhẹ nhàng, hay an ủi người khác.",
    relationships: [
      { name: "Cam", relation: "bạn thân" },
      { name: "Nâu", relation: "được Nâu bảo vệ" },
    ],
    history: "Thành viên nhỏ tuổi nhất, biểu tượng cho sự chăm sóc và phát triển.",
    visualRules: [
      "Luôn là nhân vật nhỏ nhất trong khung hình nhóm.",
      "Mầm trái tim luôn ở đúng vị trí trên đầu.",
    ],
    forbiddenChanges: ["Không được vẽ cao lớn hơn Cam hoặc Nâu.", "Không đổi mầm cây thành hình dạng khác."],
  },
  {
    id: "nau",
    name: "Nâu",
    universe: "Onigiri City",
    species: "Rice Spirit (tinh linh cơm nắm)",
    personality: "Điềm tĩnh, chín chắn, đáng tin cậy.",
    appearance: "Khoác áo choàng nâu, đeo kính tròn.",
    canonicalColors: ["nâu (brown)"],
    bodyProportions: "Cao nhất trong nhóm, thân hình chắc chắn.",
    facialFeatures: "Đeo kính tròn, ánh mắt điềm đạm.",
    accessories: ["áo choàng nâu (brown robe)", "kính tròn (round glasses)"],
    voiceProfile: "Giọng trầm, chậm rãi.",
    speakingStyle: "Nói chậm, rõ ràng, hay đưa ra lời khuyên.",
    relationships: [
      { name: "Cam", relation: "coi như em" },
      { name: "Trang", relation: "bảo vệ, che chở" },
    ],
    history: "Nhân vật lớn tuổi nhất nhóm, đóng vai trò dẫn dắt.",
    visualRules: ["Luôn đeo kính tròn.", "Áo choàng luôn màu nâu, không đổi kiểu dáng."],
    forbiddenChanges: ["Không bao giờ bỏ kính.", "Không đổi áo choàng sang màu khác."],
  },
];

export function getAllCharacters(): Character[] {
  return CHARACTERS;
}

export function findCharacterByName(name: string): Character | null {
  const lower = name.trim().toLowerCase();
  return CHARACTERS.find((c) => c.name.toLowerCase() === lower) ?? null;
}

// Tự nhận diện nhân vật được nhắc tên trong text (substring, không phân biệt
// hoa/thường/dấu câu quanh tên).
export function findCharactersMentioned(text: string): Character[] {
  const lower = text.toLowerCase();
  return CHARACTERS.filter((c) => lower.includes(c.name.toLowerCase()));
}
