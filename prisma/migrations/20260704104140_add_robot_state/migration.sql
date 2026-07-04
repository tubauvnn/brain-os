-- CreateTable
CREATE TABLE "RobotState" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'idle',
    "face" TEXT NOT NULL DEFAULT 'idle',
    "battery" INTEGER NOT NULL DEFAULT 100,
    "last_command" TEXT,
    "last_command_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RobotState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RobotState_device_id_key" ON "RobotState"("device_id");

-- AddForeignKey
ALTER TABLE "RobotState" ADD CONSTRAINT "RobotState_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
