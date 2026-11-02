-- Add foreign key constraint after tables are created
-- This assumes product_catalog_items table already exists
DO $$
BEGIN
  BEGIN
    ALTER TABLE product_variants
    ADD CONSTRAINT fk_product_variants_product_id
    FOREIGN KEY (product_id) REFERENCES product_catalog_items(id) ON DELETE CASCADE;
  EXCEPTION WHEN OTHERS THEN
    -- Constraint may already exist or table doesn't exist yet
    NULL;
  END;
END $$;
