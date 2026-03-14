// GSAP Registration
gsap.registerPlugin(ScrollTrigger);

// Utility to block scroll during loader
document.body.classList.add('loading');
window.scrollTo(0, 0);

// ==========================================
// 1. Initial Loading Sequence
// ==========================================
const tlLoader = gsap.timeline({
    onComplete: () => {
        document.body.classList.remove('loading');
        initScrollAnimations();
        initNavbarScroll();
        initRoomToggle();
        initHeroCarousel();
        initAutoScrollRooms();
    }
});

// Progress Bar Animation
tlLoader.to('#loader-bar', {
    width: '100%',
    duration: 1.5,
    ease: 'power3.inOut'
})
// Reveal Logo
.to('.loader-logo-img', {
    y: 0,
    opacity: 1,
    duration: 0.8,
    ease: 'power3.out'
}, "-=1.2")
// Stagger text reveal
.to('.loader-text .char', {
    y: 0,
    opacity: 1,
    duration: 0.8,
    stagger: 0.1,
    ease: 'power3.out'
}, "-=0.5")
// Hide loader elements
.to('.loader-content', {
    opacity: 0,
    duration: 0.6,
    ease: 'power2.inOut',
    delay: 0.5
})
// Slide up loader overlay
.to('#loader', {
    yPercent: -100,
    duration: 1.2,
    ease: 'expo.inOut'
})
// Hero Reveal Segment
.from('.hero-image', {
    scale: 1.2,
    duration: 2,
    ease: 'power3.out'
}, "-=1")
.from('.hero-overlay', {
    opacity: 1,
    duration: 2,
    ease: 'power2.out'
}, "-=2")
.from('.indent', {
    x: 50,
    opacity: 0,
    duration: 1.5,
    ease: 'power3.out'
}, "-=1.5")
.from('.hero-title-wrapper', {
    y: 50,
    opacity: 0,
    duration: 1.5,
    ease: 'power3.out'
}, "-=1.5")
.from('.hero-actions, .scroll-indicator', {
    y: 30,
    opacity: 0,
    duration: 1,
    ease: 'power2.out',
    stagger: 0.2
}, "-=1");

// ==========================================
// 2. Navbar Scroll Direction & Blur
// ==========================================
function initNavbarScroll() {
    const navbar = document.getElementById('navbar');
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        // Add base scrolled class if not at top
        if (currentScrollY > 50) {
            navbar.classList.add('scrolled');
            
            // Determine scroll direction
            if (currentScrollY < lastScrollY) {
                // Scrolling UP
                navbar.classList.remove('nav-scroll-down');
                navbar.classList.add('nav-scroll-up');
            } else {
                // Scrolling DOWN
                navbar.classList.remove('nav-scroll-up');
                navbar.classList.add('nav-scroll-down');
            }
        } else {
            // At TOP
            navbar.classList.remove('scrolled', 'nav-scroll-up', 'nav-scroll-down');
        }

        lastScrollY = currentScrollY;
    });
}

// ==========================================
// 3. Room Toggle Logic (Carousel to Grid)
// ==========================================
function initRoomToggle() {
    const toggleBtn = document.getElementById('toggle-rooms-btn');
    const carouselWrapper = document.getElementById('rooms-carousel');
    const gridWrapper = document.getElementById('rooms-grid');
    const gridContainer = document.querySelector('.rooms-grid');
    
    if(!toggleBtn) return;

    let isGridView = false;

    toggleBtn.addEventListener('click', () => {
        isGridView = !isGridView;

        if (isGridView) {
            // Hide Carousel, Show Grid
            toggleBtn.textContent = 'Previous View';
            
            gsap.to(carouselWrapper, {
                opacity: 0,
                duration: 0.4,
                onComplete: () => {
                    carouselWrapper.classList.add('hidden');
                    gridWrapper.classList.remove('hidden');
                    
                    // Fade in Grid
                    gsap.to(gridContainer, {
                        opacity: 1,
                        duration: 0.6
                    });
                    
                    // Stagger grid items
                    gsap.from('.room-grid-card', {
                        y: 30,
                        opacity: 0,
                        duration: 0.6,
                        stagger: 0.1,
                        ease: 'power2.out'
                    });
                }
            });
        } else {
            // Hide Grid, Show Carousel
            toggleBtn.textContent = 'View All Options';
            
            gsap.to(gridContainer, {
                opacity: 0,
                duration: 0.4,
                onComplete: () => {
                    gridWrapper.classList.add('hidden');
                    carouselWrapper.classList.remove('hidden');
                    
                    // Fade in Carousel
                    gsap.to(carouselWrapper, {
                        opacity: 1,
                        duration: 0.6
                    });
                }
            });
        }
    });
}

// ==========================================
// 4. GSAP Scroll Trigger Animations
// ==========================================
function initScrollAnimations() {
    
    // Blur Hero Image on scroll
    gsap.to('.hero-image', {
        filter: 'blur(12px)',
        scale: 1.05,
        ease: 'none',
        scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: true
        }
    });

    // Fade Up Text Elements
    const fadeUpElements = gsap.utils.toArray('.section-label, .section-title, .section-desc, .exp-text, .link-btn');
    fadeUpElements.forEach((el) => {
        gsap.from(el, {
            y: 50,
            opacity: 0,
            duration: 1.2,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: el,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            }
        });
    });

    // Image Reveal with Masking Effect
    const revealContainers = gsap.utils.toArray('.image-reveal-container');
    revealContainers.forEach((container) => {
        const img = container.querySelector('img');
        
        let tl = gsap.timeline({
            scrollTrigger: {
                trigger: container,
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            }
        });

        gsap.set(container, { clipPath: 'inset(0 100% 0 0)' });
        if(img) gsap.set(img, { scale: 1.2 });
        
        tl.to(container, {
            clipPath: 'inset(0 0% 0 0)',
            duration: 1.5,
            ease: 'power4.inOut'
        });
        
        if(img) {
            tl.to(img, {
                scale: 1,
                duration: 2,
                ease: 'power3.out'
            }, "-=1.5");
        }
    });
}

// ==========================================
// 5. Hero Carousel Logic
// ==========================================
function initHeroCarousel() {
    let currentSlide = 0;
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.hero-pagination .dot');
    const totalSlides = slides.length;
    let slideInterval;

    if(totalSlides === 0) return;

    function goToSlide(index) {
        if(index === currentSlide) return;
        
        // Remove active
        slides[currentSlide].classList.remove('active');
        if(dots[currentSlide]) dots[currentSlide].classList.remove('active');
        
        // Update index
        currentSlide = index;
        
        // Add active
        slides[currentSlide].classList.add('active');
        if(dots[currentSlide]) dots[currentSlide].classList.add('active');

        // Re-trigger text animation on new slide
        const newTitle = slides[currentSlide].querySelector('.hero-title-wrapper');
        const newIndent = slides[currentSlide].querySelector('.indent');
        const newImage = slides[currentSlide].querySelector('.hero-image');
        
        if(newTitle) gsap.killTweensOf(newTitle);
        if(newIndent) gsap.killTweensOf(newIndent);
        if(newImage) gsap.killTweensOf(newImage);

        if(newImage) {
            gsap.fromTo(newImage,
                { scale: 1.1 },
                { scale: 1, duration: 4, ease: 'power2.out'}
            );
        }
        if(newTitle) {
            gsap.fromTo(newTitle, 
                { y: 50, opacity: 0 }, 
                { y: 0, opacity: 1, duration: 1.5, ease: 'power3.out', delay: 0.2 }
            );
        }
        if(newIndent) {
            gsap.fromTo(newIndent, 
                { x: 50, opacity: 0 }, 
                { x: 0, opacity: 1, duration: 1.5, ease: 'power3.out', delay: 0.4 }
            );
        }
    }

    function nextSlide() {
        let next = (currentSlide + 1) % totalSlides;
        goToSlide(next);
    }

    function startInterval() {
        slideInterval = setInterval(nextSlide, 5000); // 5 seconds interval
    }

    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            clearInterval(slideInterval);
            goToSlide(index);
            startInterval();
        });
    });

    startInterval();
}

// ==========================================
// 6. Auto Scroll Rooms Carousel
// ==========================================
function initAutoScrollRooms() {
    const track = document.querySelector('.rooms-carousel');
    if (!track || track.children.length === 0) return;

    // Clone items twice to guarantee we have enough width to seamlessly loop
    const items = Array.from(track.children);
    [1, 2].forEach(() => {
        items.forEach(item => {
            let clone = item.cloneNode(true);
            track.appendChild(clone);
        });
    });

    let tween = gsap.to(track, {
        xPercent: -(100 / 3),
        ease: "none",
        duration: 25, 
        repeat: -1
    });

    track.addEventListener('mouseenter', () => tween.pause());
    track.addEventListener('mouseleave', () => tween.play());
}


// ==========================================
// 7. API Integration (Rooms, Booking, Content)
// ==========================================

const API_BASE = 'http://localhost:3000/api';

async function fetchRooms() {
    try {
        const res = await fetch(`${API_BASE}/rooms`);
        const rooms = await res.json();
        
        const carousel = document.querySelector('.rooms-carousel');
        const grid = document.querySelector('.rooms-grid');
        const roomSelect = document.getElementById('booking-room');
        
        if(carousel) carousel.innerHTML = '';
        if(grid) grid.innerHTML = '';
        if(roomSelect) roomSelect.innerHTML = '<option value="">Select a room...</option>';
        
        rooms.forEach((room) => {
            const imgPath = room.image_path || 'images/modern_hotel_suite.png';
            
            // Carousel Item
            if(carousel) {
                const carouselItem = document.createElement('div');
                carouselItem.className = 'room-card-carousel';
                carouselItem.innerHTML = `
                    <div class="room-image-frame">
                        <img src="${imgPath}" alt="${room.name}" class="suite-carousel-img">
                    </div>
                    <div class="room-info">
                        <h3 class="room-name">${room.name}</h3>
                        <p class="room-details">${room.description} &bull; $${room.price_per_night}/night</p>
                    </div>
                `;
                carousel.appendChild(carouselItem);
            }
            
            // Grid Item
            if(grid) {
                const gridItem = document.createElement('div');
                gridItem.className = 'room-grid-card';
                gridItem.innerHTML = `
                    <img src="${imgPath}" alt="${room.name}" class="grid-img">
                    <div class="grid-content">
                        <h3>${room.name}</h3>
                        <p>${room.description}</p>
                        <a href="#" class="link-btn light-link open-booking" data-id="${room.id}">Reserve <span class="arrow">→</span></a>
                    </div>
                `;
                grid.appendChild(gridItem);
            }
            
            // Select Option
            if(roomSelect) {
                const option = document.createElement('option');
                option.value = room.id;
                option.textContent = `${room.name} - $${room.price_per_night}/night`;
                option.dataset.price = room.price_per_night;
                roomSelect.appendChild(option);
            }
        });
        
        // Re-init auto scroll after populating
        if(carousel) initAutoScrollRooms();
        
        // Bind reserve buttons
        document.querySelectorAll('.open-booking').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                roomSelect.value = btn.dataset.id;
                openBookingModal();
            });
        });
        
    } catch(err) {
        console.error("Error fetching rooms", err);
    }
}


// Ensure "Reserve" in navbar opens modal too
document.querySelectorAll('.nav-btn, .link-btn').forEach(btn => {
    if(btn.textContent.includes('Reserve')) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openBookingModal();
        });
    }
});

function openBookingModal() {
    document.getElementById('booking-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

document.getElementById('close-booking')?.addEventListener('click', () => {
    document.getElementById('booking-modal').classList.remove('active');
    document.body.style.overflow = '';
});

// Booking Form Logic
const form = document.getElementById('booking-form');
const checkinInput = document.getElementById('booking-checkin');
const checkoutInput = document.getElementById('booking-checkout');
const roomSelect = document.getElementById('booking-room');
const statusDiv = document.getElementById('availability-status');
const submitBtn = document.getElementById('submit-booking-btn');
const totalSpan = document.getElementById('summary-total');

let currentBasePrice = 0;
let appliedPromo = null;

if(form) {
    // Check availability on date or room change
    const checkAvailability = async () => {
        const room_id = roomSelect.value;
        const check_in = checkinInput.value;
        const check_out = checkoutInput.value;
        
        if(room_id && roomSelect.options[roomSelect.selectedIndex]) {
            currentBasePrice = parseFloat(roomSelect.options[roomSelect.selectedIndex].dataset.price || 0);
        }
        
        if(!room_id || !check_in || !check_out) {
            statusDiv.textContent = '';
            submitBtn.disabled = true;
            updatePrice();
            return;
        }

        if(new Date(check_in) >= new Date(check_out)) {
            statusDiv.textContent = 'Check-out must be after check-in';
            statusDiv.className = 'availability-status unavailable';
            submitBtn.disabled = true;
            totalSpan.textContent = '$0.00';
            return;
        }
        
        statusDiv.textContent = 'Checking availability...';
        statusDiv.className = 'availability-status';

        try {
            const res = await fetch(`${API_BASE}/availability`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room_id, check_in, check_out })
            });
            const data = await res.json();
            
            if(data.available) {
                statusDiv.textContent = 'Room is available!';
                statusDiv.className = 'availability-status available';
                submitBtn.disabled = false;
                updatePrice();
            } else {
                statusDiv.textContent = 'Room is not available for these dates.';
                statusDiv.className = 'availability-status unavailable';
                submitBtn.disabled = true;
                totalSpan.textContent = '$0.00';
            }
        } catch(err) {
            statusDiv.textContent = 'Error checking availability.';
            statusDiv.className = 'availability-status unavailable';
        }
    };
    
    roomSelect.addEventListener('change', checkAvailability);
    checkinInput.addEventListener('change', checkAvailability);
    checkoutInput.addEventListener('change', checkAvailability);

    // Apply Promo
    document.getElementById('apply-promo-btn').addEventListener('click', async () => {
        const code = document.getElementById('booking-promo').value;
        const promoStatus = document.getElementById('promo-status');
        if(!code) return;
        
        try {
            const res = await fetch(`${API_BASE}/check-promo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            const data = await res.json();
            
            if(data.valid) {
                appliedPromo = data.discount_percent;
                promoStatus.textContent = `Promo applied! ${data.discount_percent}% off`;
                promoStatus.className = 'promo-status success';
                updatePrice();
            } else {
                appliedPromo = null;
                promoStatus.textContent = data.message;
                promoStatus.className = 'promo-status error';
                updatePrice();
            }
        } catch(err) {
            promoStatus.textContent = "Error applying promo.";
            promoStatus.className = 'promo-status error';
        }
    });

    function updatePrice() {
        const t1 = new Date(checkinInput.value);
        const t2 = new Date(checkoutInput.value);
        if(isNaN(t1) || isNaN(t2) || t1 >= t2) return;
        
        const days = Math.max(1, Math.ceil((t2.getTime() - t1.getTime()) / (1000 * 3600 * 24)));
        let total = currentBasePrice * days;
        if(appliedPromo) {
            total = total * (1 - (appliedPromo/100));
        }
        totalSpan.textContent = `$${total.toFixed(2)}`;
    }
    
    // Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            room_id: roomSelect.value,
            check_in: checkinInput.value,
            check_out: checkoutInput.value,
            guest_name: document.getElementById('booking-name').value,
            guest_email: document.getElementById('booking-email').value,
            guest_phone: document.getElementById('booking-phone').value,
            promo_code: appliedPromo ? document.getElementById('booking-promo').value : null
        };
        
        submitBtn.disabled = true;
        submitBtn.textContent = "Processing...";
        
        try {
            const res = await fetch(`${API_BASE}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if(data.success) {
                alert(`Booking confirmed! Total: $${data.total_price.toFixed(2)}. An email will be sent to the admin.`);
                document.getElementById('booking-modal').classList.remove('active');
                document.body.style.overflow = '';
                form.reset();
                totalSpan.textContent = "$0.00";
                appliedPromo = null;
                statusDiv.textContent = "";
                document.getElementById('promo-status').textContent = "";
                checkAvailability(); // Refresh to block off dates immediately
            } else {
                alert(data.error || "Booking failed.");
            }
        } catch(err) {
            alert("An error occurred during booking.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Confirm Booking";
        }
    });
}

// Initial API Load
document.addEventListener("DOMContentLoaded", async () => {
    fetchRooms();
    
    // Hamburger Menu Mobile Toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if(hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('toggle');
        });
        
        // Close menu when clicking a link
        document.querySelectorAll('.nav-link, .nav-btn').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                hamburger.classList.remove('toggle');
            });
        });
    }

    // Fetch Site Content for Whatsapp
    try {
        const res = await fetch(`${API_BASE}/content`);
        const content = await res.json();
        
        // Update WhatsApp links globally
        const waFloat = document.querySelector('.whatsapp-float');
        if(waFloat && content.whatsapp_number) {
            waFloat.href = `https://wa.me/${content.whatsapp_number.replace(/\s+/g, '')}`;
        }
        
    } catch(err) {
        console.error(err);
    }
});
