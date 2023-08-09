/*
  Warnings:

  - You are about to drop the `InlineChecklistHash` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "UserConfig" ADD COLUMN     "show_edit_confirmation" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "InlineChecklistHash";
