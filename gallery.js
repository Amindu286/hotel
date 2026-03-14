(() => {
// Initial API Load for Gallery Page
document.addEventListener("DOMContentLoaded", () => {
    fetchGalleryPage();
});

const API_BASE = 'http://localhost:3000/api';

async function fetchGalleryPage() {
    try {
        const res = await fetch(`${API_BASE}/gallery`);
        const images = await res.json();
        
        const grid = document.getElementById('gallery-grid');
        const filters = document.getElementById('gallery-filters');
        if(!grid) return;
        
        // Check URL for filter param, default to 'all'
        const urlParams = new URLSearchParams(window.location.search);
        let currentFilter = urlParams.get('filter') || 'all';

        // Initial Filter Activation
        if(filters) {
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active');
                if (b.dataset.filter === currentFilter) {
                    b.classList.add('active');
                }
            });
        }
        
        function renderGallery(filterParam = 'all') {
            grid.innerHTML = '';
            images.forEach(img => {
                if(filterParam === 'all' || img.category === filterParam) {
                    const item = document.createElement('div');
                    item.className = 'gallery-item';
                    item.innerHTML = `
                        <img src="${img.image_path}" alt="${img.caption || img.category}">
                        <div class="caption">${img.caption || img.category}</div>
                    `;
                    grid.appendChild(item);
                }
            });
        }
        
        // Render Initial Grid based on query param
        renderGallery(currentFilter);
        
        // Handle In-Page Filter Clicks
        if(filters) {
            filters.addEventListener('click', (e) => {
                if(e.target.tagName === 'BUTTON') {
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    const newFilter = e.target.dataset.filter;
                    renderGallery(newFilter);
                    
                    // Update URL without reloading page
                    const newUrl = new URL(window.location);
                    newUrl.searchParams.set('filter', newFilter);
                    if(newFilter === 'all') newUrl.searchParams.delete('filter');
                    window.history.pushState({}, '', newUrl);
                }
            });
        }

        // Fetch Whatsapp
        const contentRes = await fetch(`${API_BASE}/content`);
        const content = await contentRes.json();
        const waFloat = document.querySelector('.whatsapp-float');
        if(waFloat && content.whatsapp_number) {
            waFloat.href = `https://wa.me/${content.whatsapp_number.replace(/\s+/g, '')}`;
        }
        
    } catch(err) {
        console.error("Error fetching gallery", err);
    }
}
})();
