/*
  Warnings:

  - You are about to drop the column `imageCostUsd` on the `CostEstimate` table. All the data in the column will be lost.
  - You are about to drop the column `totalUsd` on the `CostEstimate` table. All the data in the column will be lost.
  - You are about to drop the column `videoCostUsd` on the `CostEstimate` table. All the data in the column will be lost.
  - You are about to drop the column `voiceCostUsd` on the `CostEstimate` table. All the data in the column will be lost.
  - You are about to drop the column `characterIds` on the `GeneratedAsset` table. All the data in the column will be lost.
  - You are about to drop the column `contentHash` on the `GeneratedAsset` table. All the data in the column will be lost.
  - You are about to drop the column `costUsd` on the `GeneratedAsset` table. All the data in the column will be lost.
  - You are about to drop the column `locationTag` on the `GeneratedAsset` table. All the data in the column will be lost.
  - You are about to drop the column `mimeType` on the `GeneratedAsset` table. All the data in the column will be lost.
  - You are about to drop the column `negativePrompts` on the `GeneratedAsset` table. All the data in the column will be lost.
  - You are about to drop the column `propTags` on the `GeneratedAsset` table. All the data in the column will be lost.
  - You are about to drop the column `finishedAt` on the `RenderJob` table. All the data in the column will be lost.
  - You are about to drop the column `maxAttempts` on the `RenderJob` table. All the data in the column will be lost.
  - You are about to drop the column `queuedAt` on the `RenderJob` table. All the data in the column will be lost.
  - You are about to drop the column `resultAssetId` on the `RenderJob` table. All the data in the column will be lost.
  - You are about to drop the column `startedAt` on the `RenderJob` table. All the data in the column will be lost.
  - You are about to drop the column `durationSeconds` on the `StoryEpisode` table. All the data in the column will be lost.
  - You are about to drop the column `characterIds` on the `StoryScene` table. All the data in the column will be lost.
  - You are about to drop the column `durationSeconds` on the `StoryScene` table. All the data in the column will be lost.
  - You are about to drop the column `imagePrompt` on the `StoryScene` table. All the data in the column will be lost.
  - You are about to drop the column `locationTag` on the `StoryScene` table. All the data in the column will be lost.
  - You are about to drop the column `negativePrompts` on the `StoryScene` table. All the data in the column will be lost.
  - You are about to drop the column `propTags` on the `StoryScene` table. All the data in the column will be lost.
  - Added the required column `content_hash` to the `GeneratedAsset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mime_type` to the `GeneratedAsset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `duration_seconds` to the `StoryScene` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "GeneratedAsset_contentHash_idx";

-- DropIndex
DROP INDEX "GeneratedAsset_project_id_locationTag_idx";

-- DropIndex
DROP INDEX "RenderJob_status_queuedAt_idx";

-- AlterTable
ALTER TABLE "CostEstimate" DROP COLUMN "imageCostUsd",
DROP COLUMN "totalUsd",
DROP COLUMN "videoCostUsd",
DROP COLUMN "voiceCostUsd",
ADD COLUMN     "image_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "video_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "voice_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GeneratedAsset" DROP COLUMN "characterIds",
DROP COLUMN "contentHash",
DROP COLUMN "costUsd",
DROP COLUMN "locationTag",
DROP COLUMN "mimeType",
DROP COLUMN "negativePrompts",
DROP COLUMN "propTags",
ADD COLUMN     "character_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "content_hash" TEXT NOT NULL,
ADD COLUMN     "cost_usd" DOUBLE PRECISION,
ADD COLUMN     "location_tag" TEXT,
ADD COLUMN     "mime_type" TEXT NOT NULL,
ADD COLUMN     "negative_prompts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "prop_tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "RenderJob" DROP COLUMN "finishedAt",
DROP COLUMN "maxAttempts",
DROP COLUMN "queuedAt",
DROP COLUMN "resultAssetId",
DROP COLUMN "startedAt",
ADD COLUMN     "finished_at" TIMESTAMP(3),
ADD COLUMN     "max_attempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "result_asset_id" TEXT,
ADD COLUMN     "started_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StoryEpisode" DROP COLUMN "durationSeconds",
ADD COLUMN     "duration_seconds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StoryScene" DROP COLUMN "characterIds",
DROP COLUMN "durationSeconds",
DROP COLUMN "imagePrompt",
DROP COLUMN "locationTag",
DROP COLUMN "negativePrompts",
DROP COLUMN "propTags",
ADD COLUMN     "character_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "duration_seconds" INTEGER NOT NULL,
ADD COLUMN     "image_prompt" TEXT,
ADD COLUMN     "location_tag" TEXT,
ADD COLUMN     "negative_prompts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "prop_tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "GeneratedAsset_content_hash_idx" ON "GeneratedAsset"("content_hash");

-- CreateIndex
CREATE INDEX "GeneratedAsset_project_id_location_tag_idx" ON "GeneratedAsset"("project_id", "location_tag");

-- CreateIndex
CREATE INDEX "RenderJob_status_queued_at_idx" ON "RenderJob"("status", "queued_at");
