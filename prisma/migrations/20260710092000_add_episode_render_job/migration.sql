-- CreateEnum
CREATE TYPE "EpisodeRenderStatus" AS ENUM ('queued', 'rendering', 'completed', 'failed');

-- CreateTable
CREATE TABLE "EpisodeRenderJob" (
    "id" TEXT NOT NULL,
    "episode_id" TEXT NOT NULL,
    "project_id" TEXT,
    "format" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "fps" INTEGER NOT NULL,
    "status" "EpisodeRenderStatus" NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "output_path" TEXT,
    "duration_seconds" DOUBLE PRECISION,
    "cost_usd" DOUBLE PRECISION,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeRenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EpisodeRenderJob_episode_id_created_at_idx" ON "EpisodeRenderJob"("episode_id", "created_at");

-- AddForeignKey
ALTER TABLE "EpisodeRenderJob" ADD CONSTRAINT "EpisodeRenderJob_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "StoryEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
