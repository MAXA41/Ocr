-- Table for product categories with dynamic fields
CREATE TABLE IF NOT EXISTS product_categories (
  id TEXT PRIMARY KEY,
  name_uk TEXT NOT NULL,
  name_en TEXT,
  icon TEXT,
  description TEXT,
  
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  variant_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for product variants (colors, sizes, etc)
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID,
  
  variant_values JSONB NOT NULL,
  sku TEXT UNIQUE,
  image_url TEXT,
  image_alt TEXT,
  price INTEGER,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_categories_active ON product_categories(is_active);

-- Table for predefined variant values
CREATE TABLE IF NOT EXISTS variant_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id TEXT NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  
  variant_type TEXT NOT NULL,
  variant_value TEXT NOT NULL,
  metadata JSONB,
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(category_id, variant_type, variant_value),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variant_definitions_category ON variant_definitions(category_id);

-- Enable RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_definitions ENABLE ROW LEVEL SECURITY;

-- Read policies
CREATE POLICY "product_categories_read" ON product_categories
  FOR SELECT USING (true);

CREATE POLICY "product_variants_read" ON product_variants
  FOR SELECT USING (is_active);

CREATE POLICY "variant_definitions_read" ON variant_definitions
  FOR SELECT USING (is_active);

-- Write policies (admin only)
CREATE POLICY "product_categories_write" ON product_categories
  FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated')
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "product_variants_write" ON product_variants
  FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated')
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "variant_definitions_write" ON variant_definitions
  FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated')
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Timestamp triggers
CREATE OR REPLACE FUNCTION update_product_categories_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_product_variants_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_categories_timestamp
  BEFORE UPDATE ON product_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_product_categories_timestamp();

CREATE TRIGGER product_variants_timestamp
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_product_variants_timestamp();
