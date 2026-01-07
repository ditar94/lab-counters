/*
  Warnings:

  - You are about to drop the column `attestation` on the `count_records` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "count_records" DROP COLUMN "attestation",
ADD COLUMN     "method_version" TEXT NOT NULL DEFAULT '1.0.0',
ADD COLUMN     "params_snapshot" JSONB,
ADD COLUMN     "performer_attestation" TEXT,
ADD COLUMN     "performer_attested_at" TIMESTAMP(3),
ADD COLUMN     "verifier_attestation" TEXT;

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sites" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "org_method_configs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "counter_type" "CountRecordType" NOT NULL,
    "config" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_method_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_method_configs_org_id_idx" ON "org_method_configs"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_method_configs_org_id_counter_type_key" ON "org_method_configs"("org_id", "counter_type");

-- AddForeignKey
ALTER TABLE "org_method_configs" ADD CONSTRAINT "org_method_configs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
