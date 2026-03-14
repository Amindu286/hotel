const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const multer = require('multer');
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
app.use(express.static(path.join(__dirname))); // Serve public frontend

// Admin Session configuration
app.use('/api/admin', session({
    secret: 'hotel-management-secret-key-1234',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 3600000, // 1 hour inactivity
        secure: false // true if https
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
    const query = `
        SELECT r.*, i.image_path 
        FROM rooms r 
        LEFT JOIN room_images i ON r.id = i.room_id AND i.is_primary = 1
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get single room details and images
app.get('/api/rooms/:id', (req, res) => {
    const roomId = req.params.id;
    db.get('SELECT * FROM rooms WHERE id = ?', [roomId], (err, room) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        
        db.all('SELECT * FROM room_images WHERE room_id = ?', [roomId], (err, images) => {
            if (err) return res.status(500).json({ error: err.message });
            room.images = images;
            res.json(room);
        });
    });
});

// Check availability for a specific date range
app.post('/api/availability', (req, res) => {
    const { room_id, check_in, check_out } = req.body;
    if (!room_id || !check_in || !check_out) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = `
        SELECT COUNT(*) as count FROM bookings 
        WHERE room_id = ? AND status = 'confirmed'
        AND check_in < ? AND check_out > ?
    `;
    db.get(query, [room_id, check_out, check_in], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ available: row.count === 0 });
    });
});

// Validate promo code
app.post('/api/check-promo', (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Promo code required' });

    db.get('SELECT * FROM promo_codes WHERE code = ? AND is_active = 1 AND valid_until >= date("now")', [code], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.json({ valid: false, message: 'Invalid or expired promo code' });
        res.json({ valid: true, discount_percent: row.discount_percent });
    });
});

const getDaysBetween = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
};

// Create a booking
app.post('/api/bookings', (req, res) => {
    const { room_id, guest_name, guest_email, guest_phone, check_in, check_out, promo_code } = req.body;
    if (!room_id || !guest_name || !check_in || !check_out) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Verify availability again
    const availQuery = `
        SELECT COUNT(*) as count FROM bookings 
        WHERE room_id = ? AND status = 'confirmed' AND check_in < ? AND check_out > ?
    `;
    db.get(availQuery, [room_id, check_out, check_in], (err, availRow) => {
        if (err) return res.status(500).json({ error: err.message });
        if (availRow.count > 0) return res.status(400).json({ error: 'Room is not available for these dates' });

        // 2. Calculate price (incorporating seasonal pricing)
        db.get('SELECT price_per_night FROM rooms WHERE id = ?', [room_id], (err, roomRow) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!roomRow) return res.status(404).json({ error: 'Room not found' });
            
            const basePrice = roomRow.price_per_night;
            
            db.get(`SELECT price_override FROM seasonal_pricing WHERE room_id = ? AND start_date <= ? AND end_date >= ?`, [room_id, check_in, check_in], (err, seasonRow) => {
                let nightlyRate = basePrice;
                if (seasonRow) nightlyRate = seasonRow.price_override;

                const days = Math.max(1, getDaysBetween(check_in, check_out));
                let totalPrice = nightlyRate * days;

                // 3. Apply promo code
                const finalizeBooking = (finalPrice) => {
                    const insertQuery = `
                        INSERT INTO bookings (room_id, guest_name, guest_email, guest_phone, check_in, check_out, total_price)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `;
                    db.run(insertQuery, [room_id, guest_name, guest_email, guest_phone, check_in, check_out, finalPrice], function(err) {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ success: true, booking_id: this.lastID, total_price: finalPrice });
                    });
                };

                if (promo_code) {
                    db.get('SELECT discount_percent FROM promo_codes WHERE code = ? AND is_active = 1 AND valid_until >= date("now")', [promo_code], (err, promoRow) => {
                        if (promoRow) {
                            totalPrice = totalPrice * (1 - (promoRow.discount_percent / 100));
                        }
                        finalizeBooking(totalPrice);
                    });
                } else {
                    finalizeBooking(totalPrice);
                }
            });
        });
    });
});

// Get events
app.get('/api/events', (req, res) => {
    const query = `
        SELECT e.*, i.image_path 
        FROM events e 
        LEFT JOIN event_images i ON e.id = i.event_id 
        GROUP BY e.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get gallery
app.get('/api/gallery', (req, res) => {
    db.all('SELECT * FROM gallery_images ORDER BY category, uploaded_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get site content
app.get('/api/content', (req, res) => {
    db.all('SELECT section_key, content_value FROM site_content', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const content = {};
        rows.forEach(r => content[r.section_key] = r.content_value);
        res.json(content);
    });
});

// --- Admin API Routes (Protected) ---
const bcrypt = require('bcrypt');

// Admin Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM admin_users WHERE username = ?', [username], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const match = bcrypt.compareSync(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        req.session.adminId = user.id;
        res.json({ success: true });
    });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/admin/session', (req, res) => {
    if (req.session && req.session.adminId) {
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
});

// Admin Dashboard stats
app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
    const stats = {};
    const today = new Date().toISOString().split('T')[0];
    
    // Total bookings
    db.get('SELECT COUNT(*) as count FROM bookings', [], (err, row) => {
        stats.total_bookings = row ? row.count : 0;
        
        // Upcoming check-ins today
        db.get('SELECT COUNT(*) as count FROM bookings WHERE check_in = ? AND status = "confirmed"', [today], (err, row2) => {
            stats.check_ins_today = row2 ? row2.count : 0;
            
            // Rooms currently occupied
            db.get('SELECT COUNT(*) as count FROM bookings WHERE check_in <= ? AND check_out >= ? AND status = "confirmed"', [today, today], (err, row3) => {
                stats.occupied_rooms = row3 ? row3.count : 0;
                
                // Total revenue this month
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                const startStr = startOfMonth.toISOString().split('T')[0];
                db.get('SELECT SUM(total_price) as revenue FROM bookings WHERE created_at >= ? AND status != "cancelled"', [startStr], (err, row4) => {
                    stats.revenue_this_month = row4 && row4.revenue ? row4.revenue : 0;
                    res.json(stats);
                });
            });
        });
    });
});

// Admin Rooms CRUD
app.post('/api/admin/rooms', requireAdmin, (req, res) => {
    const { name, type, description, price_per_night, max_guests, status } = req.body;
    db.run(
        `INSERT INTO rooms (name, type, description, price_per_night, max_guests, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, type, description, price_per_night, max_guests, status],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, success: true });
        }
    );
});

app.put('/api/admin/rooms/:id', requireAdmin, (req, res) => {
    const { name, type, description, price_per_night, max_guests, status } = req.body;
    db.run(
        `UPDATE rooms SET name = ?, type = ?, description = ?, price_per_night = ?, max_guests = ?, status = ? WHERE id = ?`,
        [name, type, description, price_per_night, max_guests, status, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.delete('/api/admin/rooms/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM rooms WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/admin/rooms/:id/images', requireAdmin, upload.array('images', 5), (req, res) => {
    const roomId = req.params.id;
    const files = req.files;
    let count = 0;
    
    if(!files || files.length === 0) return res.json({success: true});
    
    files.forEach((file, index) => {
        // Find if this room has images already
        db.get('SELECT count(*) as cnt FROM room_images WHERE room_id = ?', [roomId], (err, row) => {
            const isPrimary = (row.cnt === 0 && index === 0) ? 1 : 0;
            db.run('INSERT INTO room_images (room_id, image_path, is_primary) VALUES (?, ?, ?)', [roomId, `/uploads/${file.filename}`, isPrimary], (err) => {
                count++;
                if (count === files.length) res.json({ success: true });
            });
        });
    });
});

// Admin Pricing Manager
app.get('/api/admin/seasonal_pricing', requireAdmin, (req, res) => {
    db.all(`SELECT sp.*, r.name as room_name FROM seasonal_pricing sp JOIN rooms r ON sp.room_id = r.id`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/seasonal_pricing', requireAdmin, (req, res) => {
    const { room_id, start_date, end_date, price_override } = req.body;
    db.run('INSERT INTO seasonal_pricing (room_id, start_date, end_date, price_override) VALUES (?, ?, ?, ?)', 
        [room_id, start_date, end_date, price_override], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, success: true });
    });
});

app.delete('/api/admin/seasonal_pricing/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM seasonal_pricing WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Admin Promo Codes
app.get('/api/admin/promos', requireAdmin, (req, res) => {
    db.all('SELECT * FROM promo_codes', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/promos', requireAdmin, (req, res) => {
    const { code, discount_percent, valid_until, is_active } = req.body;
    db.run('INSERT INTO promo_codes (code, discount_percent, valid_until, is_active) VALUES (?, ?, ?, ?)', 
        [code, discount_percent, valid_until, is_active !== undefined ? is_active : 1], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, success: true });
    });
});

app.put('/api/admin/promos/:id', requireAdmin, (req, res) => {
    const { code, discount_percent, valid_until, is_active } = req.body;
    db.run('UPDATE promo_codes SET code = ?, discount_percent = ?, valid_until = ?, is_active = ? WHERE id = ?',
        [code, discount_percent, valid_until, is_active, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
    });
});

app.delete('/api/admin/promos/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM promo_codes WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Admin Bookings Manager
app.get('/api/admin/bookings', requireAdmin, (req, res) => {
    db.all(`SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON b.room_id = r.id ORDER BY b.created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/bookings', requireAdmin, (req, res) => {
    const { room_id, guest_name, guest_email, guest_phone, check_in, check_out, total_price, status } = req.body;
    db.run(`INSERT INTO bookings (room_id, guest_name, guest_email, guest_phone, check_in, check_out, total_price, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [room_id, guest_name, guest_email, guest_phone, check_in, check_out, total_price, status || 'confirmed'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, success: true });
        }
    );
});

app.put('/api/admin/bookings/:id/cancel', requireAdmin, (req, res) => {
    db.run('UPDATE bookings SET status = "cancelled" WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Admin Events Manager
app.post('/api/admin/events', requireAdmin, (req, res) => {
    const { title, description, event_date } = req.body;
    db.run('INSERT INTO events (title, description, event_date) VALUES (?, ?, ?)', [title, description, event_date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, success: true });
    });
});

app.post('/api/admin/events/:id/images', requireAdmin, upload.single('image'), (req, res) => {
    if(!req.file) return res.status(400).json({error: 'No image uploaded'});
    db.run('INSERT INTO event_images (event_id, image_path) VALUES (?, ?)', [req.params.id, `/uploads/${req.file.filename}`], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/admin/events/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM events WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Admin Gallery Manager
app.post('/api/admin/gallery', requireAdmin, upload.single('image'), (req, res) => {
    const { category, caption } = req.body;
    if(!req.file) return res.status(400).json({error: 'No image uploaded'});
    db.run('INSERT INTO gallery_images (category, image_path, caption) VALUES (?, ?, ?)', [category, `/uploads/${req.file.filename}`, caption], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, success: true });
    });
});

app.delete('/api/admin/gallery/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM gallery_images WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Admin Content Manager
app.put('/api/admin/content', requireAdmin, (req, res) => {
    const { section_key, content_value } = req.body;
    db.run(`INSERT INTO site_content (section_key, content_value) VALUES (?, ?) ON CONFLICT(section_key) DO UPDATE SET content_value = ?`, 
    [section_key, content_value, content_value], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Server Initialization
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
