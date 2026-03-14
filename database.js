const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Run schema creation
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT,
                description TEXT,
                price_per_night REAL,
                max_guests INTEGER,
                status TEXT DEFAULT 'available',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS room_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER,
                image_path TEXT,
                is_primary BOOLEAN DEFAULT FALSE,
                FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS bookings (
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
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                event_date DATE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS event_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER,
                image_path TEXT,
                FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS gallery_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT,
                image_path TEXT,
                caption TEXT,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS promo_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                discount_percent REAL,
                valid_until DATE,
                is_active BOOLEAN DEFAULT 1
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS seasonal_pricing (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER,
                start_date DATE,
                end_date DATE,
                price_override REAL,
                FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS site_content (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                section_key TEXT UNIQUE NOT NULL,
                content_value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Seed admin user if not exists
            db.get("SELECT * FROM admin_users WHERE username = 'admin'", (err, row) => {
                if (!row) {
                    const hash = bcrypt.hashSync('password123', 10);
                    db.run("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)", ['admin', hash]);
                    console.log("Seeded basic admin user (admin / password123)");
                }
            });

            // Seed site_content
            db.get("SELECT count(*) as count FROM site_content", (err, row) => {
                if (row.count === 0) {
                    const stmt = db.prepare("INSERT INTO site_content (section_key, content_value) VALUES (?, ?)");
                    stmt.run("hero_title", "Welcome to Randiya Hotel");
                    stmt.run("hero_subtitle", "Experience luxury and comfort in every stay");
                    stmt.run("about_text", "We are a premier destination for relaxation and joy.");
                    stmt.run("contact_email", "info@randiyahotel.com");
                    stmt.run("contact_phone", "+1 234 567 8900");
                    stmt.run("contact_address", "123 Paradise Road, Beach City");
                    stmt.run("whatsapp_number", "1234567890");
                    stmt.finalize();
                    console.log("Seeded default site content");
                }
            });
        });
    }
});

module.exports = db;
