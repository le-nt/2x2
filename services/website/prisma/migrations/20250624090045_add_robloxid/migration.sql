-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "robloxId" BIGINT;

-- AlterTable
CREATE SEQUENCE universe_id_seq;
ALTER TABLE "Universe" ALTER COLUMN "id" SET DEFAULT nextval('universe_id_seq');
ALTER SEQUENCE universe_id_seq OWNED BY "Universe"."id";
