-- CreateTable
CREATE TABLE "Session" (
    "id" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" BIGSERIAL NOT NULL,
    "telegram_chat_id" BIGINT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "username" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "language" TEXT,
    "invited_by_id" BIGINT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConfig" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "default_checked_box" TEXT NOT NULL,
    "default_unchecked_box" TEXT NOT NULL,
    "show_edit_confirmation" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_key_key" ON "Session"("key");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegram_chat_id_key" ON "User"("telegram_chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserConfig_user_id_key" ON "UserConfig"("user_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConfig" ADD CONSTRAINT "UserConfig_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
