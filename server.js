const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname)));

// Admin Session configuration
app.use('/api/admin', session({
    secret: 'hotel-management-secret-key-1234',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 3600000,
        secure: false
    }
}));

// Setup multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
    if (req.session && req.session.adminId) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
};

// --- Public API Routes ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});

// Get all rooms with their primary image
app.get('/api/rooms', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT r.*, i.image_path 
            FROM rooms r 
            LEFT JOIN room_images i ON r.id = i.room_id AND i.is_primary = 1
        `).all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single room details and images
app.get('/api/rooms/:id', (req, res) => {
    try {
        const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
        if (!room) return res.status(404).json({ error: 'Room not found' });
        room.images = db.prepare('SELECT * FROM room_images WHERE room_id = ?').all(req.params.id);
        res.json(room);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check availability for a specific date range
app.post('/api/availability', (req, res) => {
    try {
        const { room_id, check_in, check_out } = req.body;
        if (!room_id || !check_in || !check_out) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const row = db.prepare(`
            SELECT COUNT(*) as count FROM bookings 
            WHERE room_id = ? AND status = 'confirmed'
            AND check_in < ? AND check_out > ?
        `).get(room_id, check_out, check_in);
        res.json({ available: row.count === 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Validate promo code
app.post('/api/check-promo', (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Promo code required' });
        const row = db.prepare('SELECT * FROM promo_codes WHERE code = ? AND is_active = 1 AND valid_until >= date("now")').get(code);
        if (!row) return res.json({ valid: false, message: 'Invalid or expired promo code' });
        res.json({ valid: true, discount_percent: row.discount_percent });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const getDaysBetween = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
};

// Create a booking
app.post('/api/bookings', (req, res) => {
    try {
        const { room_id, guest_name, guest_email, guest_phone, check_in, check_out, promo_code } = req.body;
        if (!room_id || !guest_name || !check_in || !check_out) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check availability
        const availRow = db.prepare(`
            SELECT COUNT(*) as count FROM bookings 
            WHERE room_id = ? AND status = 'confirmed' AND check_in < ? AND check_out > ?
        `).get(room_id, check_out, check_in);
        if (availRow.count > 0) return res.status(400).json({ error: 'Room is not available for these dates' });

        // Get base price
        const roomRow = db.prepare('SELECT price_per_night FROM rooms WHERE id = ?').get(room_id);
        if (!roomRow) return res.status(404).json({ error: 'Room not found' });

        // Check seasonal pricing
        const seasonRow = db.prepare(`
            SELECT price_override FROM seasonal_pricing 
            WHERE room_id = ? AND start_date <= ? AND end_date >= ?
        `).get(room_id, check_in, check_in);

        const nightlyRate = seasonRow ? seasonRow.price_override : roomRow.price_per_night;
        const days = Math.max(1, getDaysBetween(check_in, check_out));
        let totalPrice = nightlyRate * days;

        // Apply promo code
        if (promo_code) {
            const promoRow = db.prepare('SELECT discount_percent FROM promo_codes WHERE code = ? AND is_active = 1 AND valid_until >= date("now")').get(promo_code);
            if (promoRow) {
                totalPrice = totalPrice * (1 - (promoRow.discount_percent / 100));
            }
        }

        const result = db.prepare(`
            INSERT INTO bookings (room_id, guest_name, guest_email, guest_phone, check_in, check_out, total_price)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(room_id, guest_name, guest_email, guest_phone, check_in, check_out, totalPrice);

        res.json({ success: true, booking_id: result.lastInsertRowid, total_price: totalPrice });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get events
app.get('/api/events', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT e.*, i.image_path 
            FROM events e 
            LEFT JOIN event_images i ON e.id = i.event_id 
            GROUP BY e.id
        `).all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get gallery
app.get('/api/gallery', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM gallery_images ORDER BY category, uploaded_at DESC').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get site content
app.get('/api/content', (req, res) => {
    try {
        const rows = db.prepare('SELECT section_key, content_value FROM site_content').all();
        const content = {};
        rows.forEach(r => content[r.section_key] = r.content_value);
        res.json(content);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Admin API Routes (Protected) ---

// Admin Login
app.post('/api/admin/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const match = bcrypt.compareSync(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        req.session.adminId = user.id;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/admin/session', (req, res) => {
    res.json({ loggedIn: !!(req.session && req.session.adminId) });
});

// Admin Dashboard stats
app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        const startStr = startOfMonth.toISOString().split('T')[0];

        const stats = {
            total_bookings: db.prepare('SELECT COUNT(*) as count FROM bookings').get().count,
            check_ins_today: db.prepare('SELECT COUNT(*) as count FROM bookings WHERE check_in = ? AND status = "confirmed"').get(today).count,
            occupied_rooms: db.prepare('SELECT COUNT(*) as count FROM bookings WHERE check_in <= ? AND check_out >= ? AND status = "confirmed"').get(today, today).count,
            revenue_this_month: db.prepare('SELECT SUM(total_price) as revenue FROM bookings WHERE created_at >= ? AND status != "cancelled"').get(startStr).revenue || 0
        };
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Rooms CRUD
app.post('/api/admin/rooms', requireAdmin, (req, res) => {
    try {
        const { name, type, description, price_per_night, max_guests, status } = req.body;
        const result = db.prepare(
            'INSERT INTO rooms (name, type, description, price_per_night, max_guests, status) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(name, type, description, price_per_night, max_guests, status);
        res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/rooms/:id', requireAdmin, (req, res) => {
    try {
        const { name, type, description, price_per_night, max_guests, status } = req.body;
        db.prepare(
            'UPDATE rooms SET name = ?, type = ?, description = ?, price_per_night = ?, max_guests = ?, status = ? WHERE id = ?'
        ).run(name, type, description, price_per_night, max_guests, status, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/rooms/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/rooms/:id/images', requireAdmin, upload.array('images', 5), (req, res) => {
    try {
        const roomId = req.params.id;
        const files = req.files;
        if (!files || files.length === 0) return res.json({ success: true });

        const countRow = db.prepare('SELECT count(*) as cnt FROM room_images WHERE room_id = ?').get(roomId);
        files.forEach((file, index) => {
            const isPrimary = (countRow.cnt === 0 && index === 0) ? 1 : 0;
            db.prepare('INSERT INTO room_images (room_id, image_path, is_primary) VALUES (?, ?, ?)').run(roomId, `/uploads/${file.filename}`, isPrimary);
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Pricing Manager
app.get('/api/admin/seasonal_pricing', requireAdmin, (req, res) => {
    try {
        const rows = db.prepare('SELECT sp.*, r.name as room_name FROM seasonal_pricing sp JOIN rooms r ON sp.room_id = r.id').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/seasonal_pricing', requireAdmin, (req, res) => {
    try {
        const { room_id, start_date, end_date, price_override } = req.body;
        const result = db.prepare('INSERT INTO seasonal_pricing (room_id, start_date, end_date, price_override) VALUES (?, ?, ?, ?)').run(room_id, start_date, end_date, price_override);
        res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/seasonal_pricing/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM seasonal_pricing WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Promo Codes
app.get('/api/admin/promos', requireAdmin, (req, res) => {
    try {
        res.json(db.prepare('SELECT * FROM promo_codes').all());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/promos', requireAdmin, (req, res) => {
    try {
        const { code, discount_percent, valid_until, is_active } = req.body;
        const result = db.prepare('INSERT INTO promo_codes (code, discount_percent, valid_until, is_active) VALUES (?, ?, ?, ?)').run(code, discount_percent, valid_until, is_active !== undefined ? is_active : 1);
        res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/promos/:id', requireAdmin, (req, res) => {
    try {
        const { code, discount_percent, valid_until, is_active } = req.body;
        db.prepare('UPDATE promo_codes SET code = ?, discount_percent = ?, valid_until = ?, is_active = ? WHERE id = ?').run(code, discount_percent, valid_until, is_active, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/promos/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM promo_codes WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Bookings Manager
app.get('/api/admin/bookings', requireAdmin, (req, res) => {
    try {
        const rows = db.prepare('SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON b.room_id = r.id ORDER BY b.created_at DESC').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/bookings', requireAdmin, (req, res) => {
    try {
        const { room_id, guest_name, guest_email, guest_phone, check_in, check_out, total_price, status } = req.body;
        const result = db.prepare('INSERT INTO bookings (room_id, guest_name, guest_email, guest_phone, check_in, check_out, total_price, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(room_id, guest_name, guest_email, guest_phone, check_in, check_out, total_price, status || 'confirmed');
        res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/bookings/:id/cancel', requireAdmin, (req, res) => {
    try {
        db.prepare('UPDATE bookings SET status = "cancelled" WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Events Manager
app.post('/api/admin/events', requireAdmin, (req, res) => {
    try {
        const { title, description, event_date } = req.body;
        const result = db.prepare('INSERT INTO events (title, description, event_date) VALUES (?, ?, ?)').run(title, description, event_date);
        res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/events/:id/images', requireAdmin, upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
        db.prepare('INSERT INTO event_images (event_id, image_path) VALUES (?, ?)').run(req.params.id, `/uploads/${req.file.filename}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/events/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Gallery Manager
app.post('/api/admin/gallery', requireAdmin, upload.single('image'), (req, res) => {
    try {
        const { category, caption } = req.body;
        if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
        const result = db.prepare('INSERT INTO gallery_images (category, image_path, caption) VALUES (?, ?, ?)').run(category, `/uploads/${req.file.filename}`, caption);
        res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/gallery/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM gallery_images WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Content Manager
app.put('/api/admin/content', requireAdmin, (req, res) => {
    try {
        const { section_key, content_value } = req.body;
        db.prepare('INSERT INTO site_content (section_key, content_value) VALUES (?, ?) ON CONFLICT(section_key) DO UPDATE SET content_value = ?').run(section_key, content_value, content_value);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Server Initialization
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
