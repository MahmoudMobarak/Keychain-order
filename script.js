const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN";
const EMAILJS_PUBLIC_KEY = "wFE7Ll5cDKSxM4Zfs";
const EMAILJS_SERVICE_ID = "service_zlh57wd";
const EMAILJS_TEMPLATE_CUSTOMER = "template_hu5h00o";
const EMAILJS_TEMPLATE_ADMIN = "template_i0rlm7u";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

emailjs.init(EMAILJS_SERVICE_ID);

const PROMO_CODES = { 'SUMMER20': 0.2, 'STUDENT10': 0.1, 'FIRSTORDER': 0.15, 'IGCSE': 0.25 };

let frontPhotoFile = null;
let backPhotoFile = null;
let currentOrderId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initCanvasBackground();
    initScrollAnimations();
    initNavigation();
    initQuantityControls();
    initForm();
    updatePricing();
});

function initCanvasBackground() {
    const canvas = document.getElementById('bgCanvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
    
    const particles = [];
    for (let i = 0; i < 80; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            radius: Math.random() * 2 + 0.5
        });
    }
    
    function animate() {
        ctx.fillStyle = 'rgba(10, 10, 10, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 212, 255, ${0.3 - p.radius * 0.1})`;
            ctx.fill();
        });
        
        requestAnimationFrame(animate);
    }
    animate();
}

function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            document.getElementById(targetId).scrollIntoView({ behavior: 'smooth' });
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

function initQuantityControls() {
    document.getElementById('qtyMinus').addEventListener('click', () => {
        let qty = parseInt(document.getElementById('quantity').value);
        if (qty > 1) {
            document.getElementById('quantity').value = qty - 1;
            updatePricing();
        }
    });
    
    document.getElementById('qtyPlus').addEventListener('click', () => {
        let qty = parseInt(document.getElementById('quantity').value);
        if (qty < 10) {
            document.getElementById('quantity').value = qty + 1;
            updatePricing();
        }
    });
    
    document.getElementById('quantity').addEventListener('input', updatePricing);
    document.getElementById('promoCode').addEventListener('input', updatePricing);
}

function initForm() {
    document.getElementById('frontPhoto').addEventListener('change', handlePhotoUpload);
    document.getElementById('backPhoto').addEventListener('change', handlePhotoUpload);
    
    document.getElementById('orderForm').addEventListener('submit', handleOrderSubmit);
}

function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        const preview = e.target.id === 'frontPhoto' ? 
            document.getElementById('frontPreview') : 
            document.getElementById('backPreview');
        const card = e.target.closest('.upload-card');
        
        preview.src = ev.target.result;
        card.classList.add('has-image');
        
        if (e.target.id === 'frontPhoto') {
            frontPhotoFile = file;
        } else {
            backPhotoFile = file;
        }
    };
    reader.readAsDataURL(file);
}

function updatePricing() {
    const qty = parseInt(document.getElementById('quantity').value);
    const promoCode = document.getElementById('promoCode').value.toUpperCase().trim();
    
    const subtotal = qty * 4;
    let discount = 0;
    
    if (PROMO_CODES[promoCode]) {
        discount = subtotal * PROMO_CODES[promoCode];
        document.getElementById('discountRow').style.display = 'flex';
        document.getElementById('discountAmount').textContent = `-${discount.toFixed(2)} AED`;
    } else {
        document.getElementById('discountRow').style.display = 'none';
    }
    
    const total = subtotal - discount;
    document.getElementById('subtotal').textContent = `${subtotal.toFixed(2)} AED`;
    document.getElementById('totalAmount').textContent = `${total.toFixed(2)} AED`;
}

async function handleOrderSubmit(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('customerName').value.trim(),
        email: document.getElementById('customerEmail').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        quantity: parseInt(document.getElementById('quantity').value),
        promoCode: document.getElementById('promoCode').value.toUpperCase().trim()
    };

    if (!formData.name || !formData.email || !frontPhotoFile || !backPhotoFile) {
        alert('Please complete all fields and upload both photos.');
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        alert('Please enter a valid email.');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const loader = document.querySelector('.loader');
    const btnText = submitBtn.firstChild;

    submitBtn.disabled = true;
    loader.style.display = 'block';
    btnText.textContent = 'Processing...';

    try {
        const subtotal = formData.quantity * 4;
        const discount = PROMO_CODES[formData.promoCode] ? subtotal * PROMO_CODES[formData.promoCode] : 0;
        const total = subtotal - discount;

        // Upload photos
        const timestamp = Date.now();
        const frontPath = `${timestamp}_front.jpg`;
        const backPath = `${timestamp}_back.jpg`;

        const frontUpload = await supabaseClient.storage
            .from('order-photos')
            .upload(frontPath, frontPhotoFile);

        const backUpload = await supabaseClient.storage
            .from('order-photos')
            .upload(backPath, backPhotoFile);

        if (frontUpload.error || backUpload.error) {
            throw new Error('Photo upload failed');
        }

        // Save order
        const { data: order, error } = await supabaseClient
            .from('orders')
            .insert([{
                customer_name: formData.name,
                customer_email: formData.email,
                phone: formData.phone || null,
                items: [{ quantity: formData.quantity, price: 4 }],
                promo_code: formData.promoCode || null,
                discount_amount: discount,
                total_price_aed: total,
                front_photo_path: frontPath,
                back_photo_path: backPath
            }])
            .select('id')
            .single();

        if (error) throw error;

        currentOrderId = order.id;

        // Show receipt
        showReceipt(formData, total, order.id);

    } catch (error) {
        console.error(error);
        alert('Order failed: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        loader.style.display = 'none';
        btnText.textContent = 'Place Order';
    }
}

function showReceipt(formData, total, orderId) {
    document.getElementById('receiptName').textContent = formData.name;
    document.getElementById('receiptEmail').textContent = formData.email;
    document.getElementById('receiptTotal').textContent = `${total.toFixed(2)} AED`;
    document.getElementById('orderNumber').textContent = `#${orderId}`;
    document.getElementById('receiptFront').src = URL.createObjectURL(frontPhotoFile);
    document.getElementById('receiptBack').src = URL.createObjectURL(backPhotoFile);
    
    document.getElementById('receiptModal').style.display = 'flex';
}

function closeReceipt() {
    document.getElementById('receiptModal').style.display = 'none';
    document.getElementById('orderForm').reset();
    document.querySelectorAll('.upload-card').forEach(card => {
        card.classList.remove('has-image');
    });
    frontPhotoFile = null;
    backPhotoFile = null;
    updatePricing();
}

async function downloadPDF() {
    const receipt = document.getElementById('receiptContent');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    try {
        const canvas = await html2canvas(receipt, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 10, 10, 190, 277);
        doc.save(`keycraft-order-${currentOrderId}.pdf`);
    } catch (e) {
        console.error('PDF failed:', e);
        alert('PDF download failed');
    }
}
