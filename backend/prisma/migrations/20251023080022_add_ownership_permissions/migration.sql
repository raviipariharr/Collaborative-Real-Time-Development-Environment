-- AlterTable
ALTER TABLE "public"."documents" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "public"."folders" ADD COLUMN     "ownerId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."folders" ADD CONSTRAINT "folders_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
