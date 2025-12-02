-- ============================================================================
-- MIGRATION: Add Takeaway and Reservation Support
-- Description: Adds order_type tracking, customer info, and reservations table
-- Date: 2025-11-29
-- ============================================================================

-- Step 1: Add order_type and customer fields to order_items table
-- ============================================================================
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'dine-in' CHECK (order_type IN ('dine-in', 'takeaway')),
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS pickup_time TIME,
ADD COLUMN IF NOT EXISTS special_requests TEXT;

COMMENT ON COLUMN order_items.order_type IS 'Type of order: dine-in or takeaway';
COMMENT ON COLUMN order_items.customer_name IS 'Customer name for takeaway orders';
COMMENT ON COLUMN order_items.customer_phone IS 'Customer phone for takeaway orders';

-- Step 2: Add order_type and customer fields to paid_order_items table (for statistics)
-- ============================================================================
ALTER TABLE paid_order_items
ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'dine-in' CHECK (order_type IN ('dine-in', 'takeaway')),
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS pickup_time TIME,
ADD COLUMN IF NOT EXISTS special_requests TEXT;

COMMENT ON COLUMN paid_order_items.order_type IS 'Type of order for analytics';

-- Step 3: Add order_type to payments table
-- ============================================================================
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'dine-in' CHECK (order_type IN ('dine-in', 'takeaway'));

COMMENT ON COLUMN payments.order_type IS 'Type of order payment is for';

-- Step 4: Create reservations table
-- ============================================================================
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add all columns if they don't exist (for existing reservations tables)
DO $$
BEGIN
    -- Add customer_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'customer_name'
    ) THEN
        ALTER TABLE reservations ADD COLUMN customer_name VARCHAR(255) NOT NULL DEFAULT 'Unknown';
        ALTER TABLE reservations ALTER COLUMN customer_name DROP DEFAULT;
    END IF;

    -- Add customer_phone
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'customer_phone'
    ) THEN
        ALTER TABLE reservations ADD COLUMN customer_phone VARCHAR(50) NOT NULL DEFAULT '000000000';
        ALTER TABLE reservations ALTER COLUMN customer_phone DROP DEFAULT;
    END IF;

    -- Add customer_email
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'customer_email'
    ) THEN
        ALTER TABLE reservations ADD COLUMN customer_email VARCHAR(255);
    END IF;

    -- Add party_size
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'party_size'
    ) THEN
        ALTER TABLE reservations ADD COLUMN party_size INTEGER NOT NULL DEFAULT 2 CHECK (party_size > 0);
        ALTER TABLE reservations ALTER COLUMN party_size DROP DEFAULT;
    END IF;

    -- Add reservation_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'reservation_date'
    ) THEN
        ALTER TABLE reservations ADD COLUMN reservation_date DATE NOT NULL DEFAULT CURRENT_DATE;
        ALTER TABLE reservations ALTER COLUMN reservation_date DROP DEFAULT;
    END IF;

    -- Add reservation_time
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'reservation_time'
    ) THEN
        ALTER TABLE reservations ADD COLUMN reservation_time TIME NOT NULL DEFAULT '19:00';
        ALTER TABLE reservations ALTER COLUMN reservation_time DROP DEFAULT;
    END IF;

    -- Add status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'status'
    ) THEN
        ALTER TABLE reservations ADD COLUMN status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no-show'));
    END IF;

    -- Add table_ids
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'table_ids'
    ) THEN
        ALTER TABLE reservations ADD COLUMN table_ids UUID[];
    END IF;

    -- Add special_requests
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'special_requests'
    ) THEN
        ALTER TABLE reservations ADD COLUMN special_requests TEXT;
    END IF;

    -- Add created_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE reservations ADD COLUMN created_by UUID REFERENCES users(id);
    END IF;

    -- Add seated_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'seated_at'
    ) THEN
        ALTER TABLE reservations ADD COLUMN seated_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add completed_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' AND column_name = 'completed_at'
    ) THEN
        ALTER TABLE reservations ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

COMMENT ON TABLE reservations IS 'Customer reservations for restaurant tables';
COMMENT ON COLUMN reservations.status IS 'Reservation status: pending, confirmed, seated, completed, cancelled, no-show';
COMMENT ON COLUMN reservations.table_ids IS 'Array of table UUIDs assigned to this reservation';

-- Step 5: Create indexes for better performance
-- ============================================================================

-- Index for filtering orders by type
CREATE INDEX IF NOT EXISTS idx_order_items_order_type ON order_items(order_type);
CREATE INDEX IF NOT EXISTS idx_paid_order_items_order_type ON paid_order_items(order_type);
CREATE INDEX IF NOT EXISTS idx_payments_order_type ON payments(order_type);

-- Index for customer lookups (takeaway orders)
CREATE INDEX IF NOT EXISTS idx_order_items_customer_phone ON order_items(customer_phone) WHERE customer_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_paid_order_items_customer_phone ON paid_order_items(customer_phone) WHERE customer_phone IS NOT NULL;

-- Indexes for reservation queries
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(reservation_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_phone ON reservations(customer_phone);
CREATE INDEX IF NOT EXISTS idx_reservations_date_status ON reservations(reservation_date, status);
CREATE INDEX IF NOT EXISTS idx_reservations_time ON reservations(reservation_time);

-- Composite index for common queries (date + time + status)
CREATE INDEX IF NOT EXISTS idx_reservations_datetime_status ON reservations(reservation_date, reservation_time, status);

-- Step 6: Create trigger to update updated_at on reservations
-- ============================================================================
CREATE OR REPLACE FUNCTION update_reservations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_reservations_updated_at();

-- Step 7: Backfill existing data (mark all existing orders as 'dine-in')
-- ============================================================================
-- This ensures existing orders without order_type are properly categorized
UPDATE order_items SET order_type = 'dine-in' WHERE order_type IS NULL;
UPDATE paid_order_items SET order_type = 'dine-in' WHERE order_type IS NULL;
UPDATE payments SET order_type = 'dine-in' WHERE order_type IS NULL;

-- Step 8: Add constraints after backfill
-- ============================================================================
-- Ensure order_type is never null going forward
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' 
        AND column_name = 'order_type' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE order_items ALTER COLUMN order_type SET NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'paid_order_items' 
        AND column_name = 'order_type' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE paid_order_items ALTER COLUMN order_type SET NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' 
        AND column_name = 'order_type' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE payments ALTER COLUMN order_type SET NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the migration)
-- ============================================================================

-- Verify columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('order_items', 'paid_order_items', 'payments', 'reservations')
ORDER BY table_name, ordinal_position;

-- Verify indexes were created
SELECT tablename, indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('order_items', 'paid_order_items', 'payments', 'reservations')
ORDER BY tablename, indexname;

-- Check reservations table structure (run this in psql separately)
-- \d reservations;

-- ============================================================================
-- ROLLBACK SCRIPT (Use this to undo the migration if needed)
-- ============================================================================
/*
-- WARNING: This will delete all takeaway orders and reservations!

-- Drop indexes
DROP INDEX IF EXISTS idx_order_items_order_type;
DROP INDEX IF EXISTS idx_paid_order_items_order_type;
DROP INDEX IF EXISTS idx_payments_order_type;
DROP INDEX IF EXISTS idx_order_items_customer_phone;
DROP INDEX IF EXISTS idx_paid_order_items_customer_phone;
DROP INDEX IF EXISTS idx_reservations_date;
DROP INDEX IF EXISTS idx_reservations_status;
DROP INDEX IF EXISTS idx_reservations_phone;
DROP INDEX IF EXISTS idx_reservations_date_status;
DROP INDEX IF EXISTS idx_reservations_time;
DROP INDEX IF EXISTS idx_reservations_datetime_status;

-- Drop trigger and function
DROP TRIGGER IF EXISTS trigger_update_reservations_updated_at ON reservations;
DROP FUNCTION IF EXISTS update_reservations_updated_at();

-- Drop reservations table
DROP TABLE IF EXISTS reservations;

-- Remove columns from payments
ALTER TABLE payments DROP COLUMN IF EXISTS order_type;

-- Remove columns from paid_order_items
ALTER TABLE paid_order_items 
DROP COLUMN IF EXISTS order_type,
DROP COLUMN IF EXISTS customer_name,
DROP COLUMN IF EXISTS customer_phone,
DROP COLUMN IF EXISTS customer_email,
DROP COLUMN IF EXISTS pickup_time,
DROP COLUMN IF EXISTS special_requests;

-- Remove columns from order_items
ALTER TABLE order_items 
DROP COLUMN IF EXISTS order_type,
DROP COLUMN IF EXISTS customer_name,
DROP COLUMN IF EXISTS customer_phone,
DROP COLUMN IF EXISTS customer_email,
DROP COLUMN IF EXISTS pickup_time,
DROP COLUMN IF EXISTS special_requests;
*/
