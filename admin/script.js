const API_BASE = 'http://localhost:3000/api/admin';
const PUBLIC_API = 'http://localhost:3000/api';

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const adminDashboard = document.getElementById('admin-dashboard');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const sessionRes = await fetch(`${API_BASE}/session`);
    const sessionData = await sessionRes.json();
    
    if (sessionData.loggedIn) {
        showDashboard();
    } else {
        loginScreen.classList.remove('hidden');
        adminDashboard.classList.add('hidden');
    }
    
    setupNavigation();
});

function showDashboard() {
    loginScreen.classList.add('hidden');
    adminDashboard.classList.remove('hidden');
    loadDashboardStats();
}

// --- Auth ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-user').value;
    const password = document.getElementById('login-pass').value;
    const errorEl = document.getElementById('login-error');
    
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        const data = await res.json();
        if (data.success) {
            errorEl.textContent = '';
            showDashboard();
        } else {
            errorEl.textContent = data.error || 'Login failed';
        }
    } catch(err) {
        errorEl.textContent = 'Server error';
    }
});

logoutBtn.addEventListener('click', async () => {
    await fetch(`${API_BASE}/logout`, {method: 'POST'});
    location.reload();
});

// --- Navigation ---
function setupNavigation() {
    document.querySelectorAll('.nav-btn[data-target]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
            
            // Load specific view data
            const target = btn.dataset.target;
            if (target === 'dashboard-view') loadDashboardStats();
            else if (target === 'rooms-view') loadRooms();
            else if (target === 'pricing-view') loadPricing();
            else if (target === 'bookings-view') loadBookings();
            else if (target === 'events-view') loadEvents();
            else if (target === 'gallery-view') loadGallery();
            else if (target === 'content-view') loadContent();
        });
    });
}

// --- Views API Calls ---

// 1. Dashboard
async function loadDashboardStats() {
    try {
        const res = await fetch(`${API_BASE}/dashboard`);
        if(res.status === 401) return location.reload();
        const data = await res.json();
        
        document.getElementById('stat-total').textContent = data.total_bookings || 0;
        document.getElementById('stat-checkins').textContent = data.check_ins_today || 0;
        document.getElementById('stat-occupied').textContent = data.occupied_rooms || 0;
        document.getElementById('stat-revenue').textContent = `$${data.revenue_this_month || 0}`;
    } catch(err) {
        console.error(err);
    }
}

// 2. Rooms
async function loadRooms() {
    try {
        const res = await fetch(`${PUBLIC_API}/rooms`); // we can use public API for reading
        const rooms = await res.json();
        
        const tbody = document.querySelector('#rooms-table tbody');
        tbody.innerHTML = '';
        const roomSelect = document.getElementById('seasonal-room');
        if(roomSelect) roomSelect.innerHTML = '<option value="">Select Room</option>';
        
        rooms.forEach(r => {
            tbody.innerHTML += `
                <tr>
                    <td>${r.id}</td>
                    <td>${r.name}</td>
                    <td>$${r.price_per_night}</td>
                    <td>${r.max_guests}</td>
                    <td>
                        <button class="action-btn" onclick="deleteRoom(${r.id})">Delete</button>
                    </td>
                </tr>
            `;
            if(roomSelect) roomSelect.innerHTML += `<option value="${r.id}">${r.name}</option>`;
        });
    } catch(err) { console.error(err); }
}

document.getElementById('add-room-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('room-name').value,
        type: document.getElementById('room-type').value,
        description: document.getElementById('room-desc').value,
        price_per_night: document.getElementById('room-price').value,
        max_guests: document.getElementById('room-guests').value,
        status: 'available'
    };
    
    const res = await fetch(`${API_BASE}/rooms`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    
    if(data.success && data.id) {
        const fileInput = document.getElementById('room-images');
        if (fileInput.files.length > 0) {
            const formData = new FormData();
            for(let i=0; i<fileInput.files.length; i++) {
                formData.append('images', fileInput.files[i]);
            }
            await fetch(`${API_BASE}/rooms/${data.id}/images`, {
                method: 'POST',
                body: formData
            });
        }
        alert('Room added successfully');
        e.target.reset();
        loadRooms();
    }
});

async function deleteRoom(id) {
    if(!confirm("Delete this room?")) return;
    await fetch(`${API_BASE}/rooms/${id}`, { method: 'DELETE' });
    loadRooms();
}

// 3. Pricing & Promos
async function loadPricing() {
    loadRooms(); // populates select
    
    // Seasonal Rules
    const res1 = await fetch(`${API_BASE}/seasonal_pricing`);
    const seasonal = await res1.json();
    const tb1 = document.querySelector('#seasonal-table tbody');
    tb1.innerHTML = '';
    seasonal.forEach(s => {
        tb1.innerHTML += `<tr>
            <td>${s.room_name}</td>
            <td>${s.start_date} to ${s.end_date}</td>
            <td>$${s.price_override}</td>
            <td><button class="action-btn" onclick="deleteSeasonal(${s.id})">Del</button></td>
        </tr>`;
    });
    
    // Promos
    const res2 = await fetch(`${API_BASE}/promos`);
    const promos = await res2.json();
    const tb2 = document.querySelector('#promo-table tbody');
    tb2.innerHTML = '';
    promos.forEach(p => {
        tb2.innerHTML += `<tr>
            <td>${p.code}</td>
            <td>${p.discount_percent}%</td>
            <td>${p.valid_until}</td>
            <td><button class="action-btn" onclick="deletePromo(${p.id})">Del</button></td>
        </tr>`;
    });
}

document.getElementById('add-seasonal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        room_id: document.getElementById('seasonal-room').value,
        start_date: document.getElementById('seasonal-start').value,
        end_date: document.getElementById('seasonal-end').value,
        price_override: document.getElementById('seasonal-price').value
    };
    await fetch(`${API_BASE}/seasonal_pricing`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
    });
    e.target.reset();
    loadPricing();
});

document.getElementById('add-promo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        code: document.getElementById('promo-code').value,
        discount_percent: document.getElementById('promo-discount').value,
        valid_until: document.getElementById('promo-valid').value
    };
    await fetch(`${API_BASE}/promos`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
    });
    e.target.reset();
    loadPricing();
});

async function deleteSeasonal(id) {
    if(!confirm("Delete this rule?")) return;
    await fetch(`${API_BASE}/seasonal_pricing/${id}`, { method: 'DELETE' });
    loadPricing();
}

async function deletePromo(id) {
    if(!confirm("Delete this promo?")) return;
    await fetch(`${API_BASE}/promos/${id}`, { method: 'DELETE' });
    loadPricing();
}

// 4. Bookings
async function loadBookings() {
    const res = await fetch(`${API_BASE}/bookings`);
    const bookings = await res.json();
    const tb = document.querySelector('#bookings-table tbody');
    tb.innerHTML = '';
    
    bookings.forEach(b => {
        let statusClass = b.status === 'confirmed' ? 'confirmed' : 'cancelled';
        tb.innerHTML += `<tr>
            <td>${b.id}</td>
            <td>${b.guest_name}<br><small>${b.guest_phone}</small></td>
            <td>${b.room_name}</td>
            <td>${b.check_in} &rarr; ${b.check_out}</td>
            <td>$${b.total_price}</td>
            <td><span class="status-badge ${statusClass}">${b.status}</span></td>
            <td>
                ${b.status === 'confirmed' ? `<button class="action-btn" onclick="cancelBooking(${b.id})">Cancel</button>` : ''}
            </td>
        </tr>`;
    });
}

async function cancelBooking(id) {
    if(!confirm("Cancel this booking?")) return;
    await fetch(`${API_BASE}/bookings/${id}/cancel`, { method: 'PUT' });
    loadBookings();
}

// 5. Events
async function loadEvents() {
    const res = await fetch(`${PUBLIC_API}/events`);
    const events = await res.json();
    const tb = document.querySelector('#events-table tbody');
    tb.innerHTML = '';
    
    events.forEach(e => {
        tb.innerHTML += `<tr>
            <td>${e.title}</td>
            <td>${e.event_date}</td>
            <td><button class="action-btn" onclick="deleteEvent(${e.id})">Del</button></td>
        </tr>`;
    });
}

document.getElementById('add-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        title: document.getElementById('event-title').value,
        event_date: document.getElementById('event-date').value,
        description: document.getElementById('event-desc').value,
    };
    const res = await fetch(`${API_BASE}/events`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
    });
    const data = await res.json();
    
    if(data.success && data.id) {
        const fileInput = document.getElementById('event-img');
        if (fileInput.files.length > 0) {
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            await fetch(`${API_BASE}/events/${data.id}/images`, { method: 'POST', body: formData });
        }
        e.target.reset();
        loadEvents();
    }
});

async function deleteEvent(id) {
    if(!confirm("Delete event?")) return;
    await fetch(`${API_BASE}/events/${id}`, { method: 'DELETE' });
    loadEvents();
}

// 6. Gallery
async function loadGallery() {
    const res = await fetch(`${PUBLIC_API}/gallery`);
    const gallery = await res.json();
    const grid = document.getElementById('admin-gallery-grid');
    grid.innerHTML = '';
    
    gallery.forEach(img => {
        grid.innerHTML += `
            <div class="gallery-item">
                <img src="${img.image_path}" alt="">
                <button class="del-btn" onclick="deleteGalleryImage(${img.id})">X</button>
            </div>
        `;
    });
}

document.getElementById('add-gallery-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('category', document.getElementById('gallery-category').value);
    formData.append('caption', document.getElementById('gallery-caption').value);
    formData.append('image', document.getElementById('gallery-img').files[0]);
    
    await fetch(`${API_BASE}/gallery`, { method: 'POST', body: formData });
    
    e.target.reset();
    loadGallery();
});

async function deleteGalleryImage(id) {
    if(!confirm("Delete image?")) return;
    await fetch(`${API_BASE}/gallery/${id}`, { method: 'DELETE' });
    loadGallery();
}

// 7. Site Content
async function loadContent() {
    const res = await fetch(`${PUBLIC_API}/content`);
    const content = await res.json();
    
    for(const key in content) {
        const el = document.getElementById(`content-${key}`);
        if(el) el.value = content[key];
    }
}

document.getElementById('content-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const keys = ['hero_title', 'hero_subtitle', 'about_text', 'contact_email', 'contact_phone', 'contact_address', 'whatsapp_number'];
    
    for(let key of keys) {
        const val = document.getElementById(`content-${key}`).value;
        await fetch(`${API_BASE}/content`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ section_key: key, content_value: val })
        });
    }
    alert('Content saved successfully');
});
