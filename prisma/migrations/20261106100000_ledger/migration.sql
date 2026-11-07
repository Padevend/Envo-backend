-- CreateEnum
CREATE TYPE "LedgerAccountKind" AS ENUM ('USER_WALLET', 'USER_ENVELOPE', 'USER_GOAL', 'SYSTEM_EXTERNAL', 'SYSTEM_TRANSIT', 'SYSTEM_FEES_MESOMB', 'SYSTEM_FEES_APP', 'SYSTEM_SUSPENSE');

-- CreateEnum
CREATE TYPE "LedgerAccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "JournalEntryKind" AS ENUM ('TOPUP', 'PAYOUT_RESERVE', 'PAYOUT_SETTLE', 'TRANSFER', 'RULE_ALLOCATION', 'REVERSAL', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "kind" "LedgerAccountKind" NOT NULL,
    "code" TEXT,
    "owner_user_id" UUID,
    "status" "LedgerAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "allows_negative" BOOLEAN NOT NULL DEFAULT false,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "kind" "JournalEntryKind" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "external_ref" TEXT,
    "reverses_entry_id" UUID,
    "description" TEXT,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postings" (
    "id" UUID NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_code_key" ON "ledger_accounts"("code");

-- CreateIndex
CREATE INDEX "ledger_accounts_owner_user_id_idx" ON "ledger_accounts"("owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_idempotency_key_key" ON "journal_entries"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reverses_entry_id_key" ON "journal_entries"("reverses_entry_id");

-- CreateIndex
CREATE INDEX "journal_entries_external_ref_idx" ON "journal_entries"("external_ref");

-- CreateIndex
CREATE INDEX "postings_account_id_seq_idx" ON "postings"("account_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "postings_entry_id_line_no_key" ON "postings"("entry_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "postings_entry_id_account_id_key" ON "postings"("entry_id", "account_id");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reverses_entry_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postings" ADD CONSTRAINT "postings_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postings" ADD CONSTRAINT "postings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Garde-fous SQL (non modélisés par Prisma). Ils s'appliquent même si quelqu'un
-- contourne le code applicatif : le ledger reste cohérent.
-- ============================================================================

-- Contraintes de cohérence
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_balance_non_negative"
  CHECK ("allows_negative" OR "balance" >= 0);

ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_owner_matches_kind"
  CHECK (("kind" IN ('USER_WALLET', 'USER_ENVELOPE', 'USER_GOAL')) = ("owner_user_id" IS NOT NULL));

ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_code_matches_kind"
  CHECK (("kind" IN ('SYSTEM_EXTERNAL', 'SYSTEM_TRANSIT', 'SYSTEM_FEES_MESOMB', 'SYSTEM_FEES_APP', 'SYSTEM_SUSPENSE')) = ("code" IS NOT NULL));

ALTER TABLE "postings" ADD CONSTRAINT "postings_amount_non_zero" CHECK ("amount" <> 0);

-- Un seul wallet par utilisateur
CREATE UNIQUE INDEX "ledger_accounts_one_wallet_per_user" ON "ledger_accounts"("owner_user_id") WHERE "kind" = 'USER_WALLET';

-- Immuabilité : aucune écriture ni ligne ne se modifie, ne se supprime, ne se vide (on contre-passe).
CREATE FUNCTION "ledger_forbid_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger: les écritures sont immuables (% sur %)', TG_OP, TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER "journal_entries_immutable" BEFORE UPDATE OR DELETE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION "ledger_forbid_mutation"();
CREATE TRIGGER "journal_entries_no_truncate" BEFORE TRUNCATE ON "journal_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION "ledger_forbid_mutation"();
CREATE TRIGGER "postings_immutable" BEFORE UPDATE OR DELETE ON "postings"
  FOR EACH ROW EXECUTE FUNCTION "ledger_forbid_mutation"();
CREATE TRIGGER "postings_no_truncate" BEFORE TRUNCATE ON "postings"
  FOR EACH STATEMENT EXECUTE FUNCTION "ledger_forbid_mutation"();
CREATE TRIGGER "ledger_accounts_no_delete" BEFORE DELETE ON "ledger_accounts"
  FOR EACH ROW EXECUTE FUNCTION "ledger_forbid_mutation"();
CREATE TRIGGER "ledger_accounts_no_truncate" BEFORE TRUNCATE ON "ledger_accounts"
  FOR EACH STATEMENT EXECUTE FUNCTION "ledger_forbid_mutation"();

-- Comptes : un compte naît à zéro ; son identité est fixe ; son solde ne change que via une ligne.
CREATE FUNCTION "ledger_guard_account_insert"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."balance" <> 0 THEN
    RAISE EXCEPTION 'ledger: un compte est créé avec un solde nul';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ledger_accounts_guard_insert" BEFORE INSERT ON "ledger_accounts"
  FOR EACH ROW EXECUTE FUNCTION "ledger_guard_account_insert"();

CREATE FUNCTION "ledger_guard_account_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."kind" <> OLD."kind"
     OR NEW."code" IS DISTINCT FROM OLD."code"
     OR NEW."owner_user_id" IS DISTINCT FROM OLD."owner_user_id"
     OR NEW."allows_negative" <> OLD."allows_negative" THEN
    RAISE EXCEPTION 'ledger: l''identité d''un compte est immuable';
  END IF;
  -- pg_trigger_depth() >= 2 : la mise à jour vient du trigger de ligne (postings_apply), jamais d'un accès direct.
  IF NEW."balance" <> OLD."balance" AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'ledger: le solde ne se modifie que par des écritures';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ledger_accounts_guard_update" BEFORE UPDATE ON "ledger_accounts"
  FOR EACH ROW EXECUTE FUNCTION "ledger_guard_account_update"();

-- Application d'une ligne : verrouille le compte, refuse compte fermé / gelé (débit) / solde insuffisant,
-- met à jour le solde en cache et fige le solde après l'opération.
CREATE FUNCTION "ledger_apply_posting"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_status "LedgerAccountStatus";
  v_allows BOOLEAN;
  v_balance BIGINT;
  v_new BIGINT;
BEGIN
  SELECT "status", "allows_negative", "balance" INTO v_status, v_allows, v_balance
    FROM "ledger_accounts" WHERE "id" = NEW."account_id" FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ledger: compte introuvable';
  END IF;
  IF v_status = 'CLOSED' THEN
    RAISE EXCEPTION 'ledger: compte fermé';
  END IF;
  IF v_status = 'FROZEN' AND NEW."amount" < 0 THEN
    RAISE EXCEPTION 'ledger: compte gelé, débit refusé';
  END IF;
  v_new := v_balance + NEW."amount";
  IF v_new < 0 AND NOT v_allows THEN
    RAISE EXCEPTION 'ledger: solde insuffisant';
  END IF;
  UPDATE "ledger_accounts" SET "balance" = v_new WHERE "id" = NEW."account_id";
  NEW."balance_after" := v_new;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "postings_apply" BEFORE INSERT ON "postings"
  FOR EACH ROW EXECUTE FUNCTION "ledger_apply_posting"();

-- Partie double : vérifiée au COMMIT (contrainte différée) : au moins deux lignes, somme nulle.
CREATE FUNCTION "ledger_check_entry_balanced"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_entry UUID;
  v_total NUMERIC;
  v_count BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'journal_entries' THEN
    v_entry := NEW."id";
  ELSE
    v_entry := NEW."entry_id";
  END IF;
  SELECT COALESCE(SUM("amount"), 0), COUNT(*) INTO v_total, v_count FROM "postings" WHERE "entry_id" = v_entry;
  IF v_count < 2 THEN
    RAISE EXCEPTION 'ledger: une écriture exige au moins deux lignes';
  END IF;
  IF v_total <> 0 THEN
    RAISE EXCEPTION 'ledger: écriture déséquilibrée (somme non nulle)';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "journal_entries_balanced" AFTER INSERT ON "journal_entries"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "ledger_check_entry_balanced"();
CREATE CONSTRAINT TRIGGER "postings_balanced" AFTER INSERT ON "postings"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "ledger_check_entry_balanced"();

-- Comptes système. EXTERNAL (argent entré dans le système : solde négatif) et SUSPENSE (à régulariser) peuvent être négatifs.
INSERT INTO "ledger_accounts" ("id", "kind", "code", "allows_negative") VALUES
  (gen_random_uuid(), 'SYSTEM_EXTERNAL', 'EXTERNAL', true),
  (gen_random_uuid(), 'SYSTEM_TRANSIT', 'TRANSIT', false),
  (gen_random_uuid(), 'SYSTEM_FEES_MESOMB', 'FEES_MESOMB', false),
  (gen_random_uuid(), 'SYSTEM_FEES_APP', 'FEES_APP', false),
  (gen_random_uuid(), 'SYSTEM_SUSPENSE', 'SUSPENSE', true);
