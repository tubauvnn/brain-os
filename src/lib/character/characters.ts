import { CANON_IMAGE_PATHS } from "./canon";
import type { Character } from "./types";

// Character Memory — Character Agent "nhớ" toàn bộ nhân vật đã biết, KHÔNG
// cần user mô tả lại (đúng yêu cầu Phase 5). Phase 5 lưu dạng in-memory seed
// (3 nhân vật vũ trụ ChinChin) — đủ để chứng minh vertical slice; chuyển sang
// bảng Postgres riêng (giống Memory/Knowledge) là bước sau, không đổi contract
// Character/CharacterOutput ở types.ts.
//
// SỬA THEO CANON (sau khi ảnh canon chính thức được upload tại
// assets/chinchin/characters/, xem canon.ts): dữ liệu ban đầu ở Phase 5 mô tả
// nhầm 3 nhân vật là "Rice Spirit"/mặt cơm nắm, vũ trụ "Onigiri City" — SAI so
// với ảnh canon thật (linh vật hoá thân quả BƠ, vũ trụ "ChinChin", height
// chart chính thức: Trang 95% / Cam 100% / Nâu 105%; Nâu KHÔNG mặc áo choàng
// nâu — thân/mũ trùm cùng màu xanh đậm như Cam/Trang, chỉ MẶT màu nâu nhạt).
// Đã sửa lại toàn bộ theo đúng ảnh canon — canon luôn thắng.

const CHARACTERS: Character[] = [
  {
    id: "cam",
    name: "Cam",
    universe: "ChinChin",
    species: "Linh vật hoá thân quả bơ (avocado mascot)",
    personality: "Năng động, dũng cảm, lạc quan, tự tin — vai trò 'Energy' (năng lượng) của nhóm.",
    appearance:
      "Thân hình quả bơ màu xanh đậm lốm đốm (mũ trùm đầu liền thân), khuôn mặt tròn màu cam nhô ra từ mũ trùm, đội vương miện ngọn lửa cam-đỏ trên đỉnh đầu, tay chân màu trắng kem, tư thế nắm đấm như võ sĩ.",
    canonicalColors: ["xanh đậm lốm đốm (thân/mũ trùm)", "cam (mặt)", "cam-đỏ (vương miện ngọn lửa)", "trắng kem (tay chân)"],
    bodyProportions: "Chiều cao = 100% (mốc gốc của height chart chính thức 3 nhân vật ChinChin).",
    facialFeatures: "Mắt to đen, lông mày xếch thể hiện quyết tâm, má hồng cam, không đeo kính.",
    accessories: ["vương miện ngọn lửa cam-đỏ trên đỉnh mũ trùm (flame crown)"],
    voiceProfile: "Giọng cao, nhanh, tràn đầy năng lượng.",
    speakingStyle: "Nói nhanh, hay dùng câu cảm thán, thích hô khẩu hiệu.",
    relationships: [
      { name: "Trang", relation: "bạn thân" },
      { name: "Nâu", relation: "coi như anh lớn" },
    ],
    history: "Nhân vật đại diện tinh thần năng lượng của ChinChin, mốc chiều cao gốc (100%) trong height chart chính thức.",
    visualRules: [
      "Phải khớp 100% với ảnh canon — không tự thiết kế lại ngoại hình.",
      "Luôn giữ mặt màu cam, thân/mũ trùm màu xanh đậm lốm đốm.",
      "Vương miện ngọn lửa luôn ở đỉnh mũ trùm.",
      "Chiều cao luôn là mốc 100% khi so với Trang (95%) và Nâu (105%).",
    ],
    forbiddenChanges: [
      "Không tự thiết kế lại ngoại hình khác với ảnh canon.",
      "Không bao giờ đeo kính.",
      "Không đổi màu mặt sang màu khác cam.",
    ],
    canonImagePath: CANON_IMAGE_PATHS.cam,
  },
  {
    id: "trang",
    name: "Trang",
    universe: "ChinChin",
    species: "Linh vật hoá thân quả bơ (avocado mascot)",
    personality: "Dịu dàng, tốt bụng, hỗ trợ, thân thiện — vai trò 'Heart' (trái tim) của nhóm.",
    appearance:
      "Thân hình quả bơ màu xanh đậm lốm đốm (mũ trùm đầu liền thân), khuôn mặt tròn màu trắng kem nhô ra từ mũ trùm, mầm cây hình trái tim mọc trên đỉnh đầu, tay chân màu trắng kem, dáng nhỏ nhắn nhất nhóm.",
    canonicalColors: ["xanh đậm lốm đốm (thân/mũ trùm)", "trắng kem (mặt)", "xanh lá (mầm trái tim)", "trắng kem (tay chân)"],
    bodyProportions: "Chiều cao = 95% so với Cam — thấp nhất trong 3 nhân vật (theo height chart chính thức).",
    facialFeatures: "Mắt to tròn đen, lông mày nhẹ nhàng, miệng cười tươi, má hồng.",
    accessories: ["mầm cây hình trái tim trên đỉnh mũ trùm (heart sprout)"],
    voiceProfile: "Giọng nhỏ nhẹ, trong trẻo.",
    speakingStyle: "Nói chậm rãi, nhẹ nhàng, hay an ủi người khác.",
    relationships: [
      { name: "Cam", relation: "bạn thân" },
      { name: "Nâu", relation: "được Nâu bảo vệ" },
    ],
    history: "Nhân vật đại diện tinh thần ấm áp của ChinChin, thấp nhất trong height chart chính thức (95%).",
    visualRules: [
      "Phải khớp 100% với ảnh canon — không tự thiết kế lại ngoại hình.",
      "Luôn là nhân vật thấp nhất trong khung hình nhóm (95% chiều cao Cam).",
      "Mầm trái tim luôn ở đúng vị trí trên đỉnh mũ trùm.",
    ],
    forbiddenChanges: [
      "Không tự thiết kế lại ngoại hình khác với ảnh canon.",
      "Không được vẽ cao lớn hơn Cam hoặc Nâu.",
      "Không đổi mầm cây thành hình dạng khác.",
    ],
    canonImagePath: CANON_IMAGE_PATHS.trang,
  },
  {
    id: "nau",
    name: "Nâu",
    universe: "ChinChin",
    species: "Linh vật hoá thân quả bơ (avocado mascot)",
    personality: "Thông minh, quan sát tốt, chu đáo, đáng tin cậy — vai trò 'Brain' (bộ não) của nhóm.",
    appearance:
      "Thân hình quả bơ màu xanh đậm lốm đốm (mũ trùm đầu liền thân — CÙNG màu xanh như Cam/Trang, KHÔNG phải áo choàng nâu riêng), khuôn mặt tròn màu nâu nhạt nhô ra từ mũ trùm, đeo kính tròn gọng nâu, mầm cây 2 lá mọc trên đỉnh đầu, tay chân màu trắng kem, dáng cao nhất nhóm.",
    canonicalColors: ["xanh đậm lốm đốm (thân/mũ trùm)", "nâu nhạt (mặt)", "xanh lá (mầm 2 lá)", "nâu (gọng kính)", "trắng kem (tay chân)"],
    bodyProportions: "Chiều cao = 105% so với Cam — cao nhất trong 3 nhân vật (theo height chart chính thức).",
    facialFeatures: "Mắt to đen hiền, đeo kính tròn gọng nâu, cười nhẹ, điềm đạm.",
    accessories: ["kính tròn gọng nâu (round glasses)", "mầm cây 2 lá trên đỉnh mũ trùm (twin-leaf sprout)"],
    voiceProfile: "Giọng trầm, chậm rãi.",
    speakingStyle: "Nói chậm, rõ ràng, hay đưa ra lời khuyên.",
    relationships: [
      { name: "Cam", relation: "coi như em" },
      { name: "Trang", relation: "bảo vệ, che chở" },
    ],
    history: "Nhân vật đại diện trí tuệ của ChinChin, cao nhất trong height chart chính thức (105%).",
    visualRules: [
      "Phải khớp 100% với ảnh canon — không tự thiết kế lại ngoại hình.",
      "Luôn đeo kính tròn gọng nâu.",
      "Thân/mũ trùm LUÔN màu xanh đậm lốm đốm giống Cam/Trang — KHÔNG phải áo choàng nâu, chỉ mặt màu nâu nhạt.",
      "Mầm cây 2 lá luôn ở đỉnh mũ trùm.",
    ],
    forbiddenChanges: [
      "Không tự thiết kế lại ngoại hình khác với ảnh canon.",
      "Không bao giờ bỏ kính.",
      "Không vẽ thân/mũ trùm màu nâu (chỉ mặt mới màu nâu nhạt, thân vẫn xanh đậm như 2 nhân vật kia).",
    ],
    canonImagePath: CANON_IMAGE_PATHS.nau,
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
