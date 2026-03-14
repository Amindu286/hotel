const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('Connected to the SQLite database.');

db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT,
        description TEXT,
        price_per_night REAL,
        max_guests INTEGER,
        status TEXT DEFAULT 'available',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS room_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER,
        image_path TEXT,
        is_primary BOOLEAN DEFAULT FALSE,
        FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER,
        guest_name TEXT NOT NULL,
        guest_email TEXT,
        guest_phone TEXT,
        check_in DATE,
        check_out DATE,
        total_price REAL,
        status TEXT DEFAULT 'confirmed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        event_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER,
        image_path TEXT,
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gallery_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT,
        image_path TEXT,
        caption TEXT,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        discount_percent REAL,
        valid_until DATE,
        is_active BOOLEAN DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS seasonal_pricing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER,
        start_date DATE,
        end_date DATE,
        price_override REAL,
        FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_key TEXT UNIQUE NOT NULL,
        content_value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Seed admin user if not exists
const adminRow = db.prepare("SELECT * FROM admin_users WHERE username = 'admin'").get();
if (!adminRow) {
    const hash = bcrypt.hashSync('password123', 10);
    db.prepare("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)").run('admin', hash);
    console.log("Seeded basic admin user (admin / password123)");
}

// Seed site_content if empty
const contentCount = db.prepare("SELECT count(*) as count FROM site_content").get();
if (contentCount.count === 0) {
    const insert = db.prepare("INSERT INTO site_content (section_key, content_value) VALUES (?, ?)");
    const seedMany = db.transaction((items) => {
        for (const [key, val] of items) insert.run(key, val);
    });
    seedMany([
        ["hero_title", "Welcome to Randiya Hotel"],
        ["hero_subtitle", "Experience luxury and comfort in every stay"],
        ["about_text", "We are a premier destination for relaxation and joy."],
        ["contact_email", "info@randiyahotel.com"],
        ["contact_phone", "+1 234 567 8900"],
        ["contact_address", "123 Paradise Road, Beach City"],
        ["whatsapp_number", "1234567890"],
    ]);
    console.log("Seeded default site content");
}

module.exports = db;
