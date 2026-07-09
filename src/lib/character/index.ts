// Điểm vào duy nhất mà code ngoài src/lib/character/ nên import — không import
// trực tiếp characters.ts/consistency-checker.ts ở nơi khác. Image/Video/
// Voice/Comic Agent sau này PHẢI xin dữ liệu nhân vật qua đây, không tự giữ
// bản sao riêng (yêu cầu Phase 5: "Never duplicate character information
// elsewhere").
export { resolveCharacters, type CharacterAgentOutput } from "./character-agent";
export { getAllCharacters, findCharacterByName, findCharactersMentioned } from "./characters";
export type { Character, CharacterRelationship, CharacterOutput, ConsistencyOverride, ConsistencyCheckResult } from "./types";
