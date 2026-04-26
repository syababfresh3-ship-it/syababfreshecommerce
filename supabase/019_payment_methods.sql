-- Payment methods toggle table
CREATE TABLE IF NOT EXISTS payment_methods (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  sublabel    text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  smallint NOT NULL DEFAULT 0
);

INSERT INTO payment_methods (id, label, sublabel, is_active, sort_order) VALUES
  ('fpx',          'FPX Online Banking',  'Semua bank Malaysia',             true, 0),
  ('ewallet',      'E-Wallet',            'Touch ''n Go · Boost · GrabPay',  true, 1),
  ('cod',          'Bayar Semasa Terima', 'Bayar tunai ketika barang tiba',  true, 2),
  ('bank_transfer','Pindahan Bank',       'Transfer terus ke akaun kami',    true, 3)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Anyone can read (checkout needs to know which methods are active)
CREATE POLICY "payment_methods_public_read"
  ON payment_methods FOR SELECT USING (true);

-- Only admins can update
CREATE POLICY "payment_methods_admin_update"
  ON payment_methods FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));
