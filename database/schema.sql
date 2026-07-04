CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending',
  pickup_city TEXT NOT NULL,
  pickup_zip TEXT,
  preferred_day TEXT NOT NULL,
  preferred_window TEXT NOT NULL,
  location_type TEXT NOT NULL,
  customer_present TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  estimated_load TEXT,
  job_notes TEXT,
  items_to_remove TEXT NOT NULL,
  photo_count INTEGER NOT NULL DEFAULT 0,
  user_agent TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_slot_unique
ON bookings (preferred_day, preferred_window)
WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS bookings_day_status_idx
ON bookings (preferred_day, status);
