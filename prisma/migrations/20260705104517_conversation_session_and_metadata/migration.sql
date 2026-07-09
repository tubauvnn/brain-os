-- AlterTable
ALTER TABLE "ConversationMessage" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "session_id" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "ConversationSession" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "source" TEXT NOT NULL DEFAULT 'robot',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationMessage_session_id_created_at_idx" ON "ConversationMessage"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ConversationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
