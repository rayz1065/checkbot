-- CreateTable
CREATE TABLE "UserConfig" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "default_checked_box" TEXT NOT NULL,
    "default_unchecked_box" TEXT NOT NULL,

    CONSTRAINT "UserConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserConfig_user_id_key" ON "UserConfig"("user_id");

-- AddForeignKey
ALTER TABLE "UserConfig" ADD CONSTRAINT "UserConfig_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
