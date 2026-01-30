-- AlterTable
ALTER TABLE "public"."chat_messages" ADD COLUMN     "audioData" TEXT,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "replyToId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."chat_messages" ADD CONSTRAINT "chat_messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "public"."chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
