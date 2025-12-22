-- AlterTable
ALTER TABLE "count_records" ADD COLUMN     "is_qc" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sites" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "monthly_reviews" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "reviewed_by_id" TEXT NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "stats" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_reviews_org_id_site_id_idx" ON "monthly_reviews"("org_id", "site_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_reviews_org_id_site_id_year_month_key" ON "monthly_reviews"("org_id", "site_id", "year", "month");

-- AddForeignKey
ALTER TABLE "monthly_reviews" ADD CONSTRAINT "monthly_reviews_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_reviews" ADD CONSTRAINT "monthly_reviews_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_reviews" ADD CONSTRAINT "monthly_reviews_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
