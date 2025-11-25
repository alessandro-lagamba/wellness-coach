-- Allow storing intelligent insights for food analysis
ALTER TABLE intelligent_insights
  DROP CONSTRAINT IF EXISTS intelligent_insights_category_check;

ALTER TABLE intelligent_insights
  ADD CONSTRAINT intelligent_insights_category_check
  CHECK (category IN ('emotion', 'skin', 'food'));

