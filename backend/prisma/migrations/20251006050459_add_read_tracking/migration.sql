-- AlterTable
ALTER TABLE "public"."chat_messages" ADD COLUMN     "readBy" TEXT[] DEFAULT ARRAY[]::TEXT[];
