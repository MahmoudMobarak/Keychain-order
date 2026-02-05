const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN";
const EMAILJS_PUBLIC_KEY = "wFE7Ll5cDKSxM4Zfs";
const EMAILJS_SERVICE_ID = "service_zlh57wd";
const EMAILJS_TEMPLATE_CUSTOMER = "template_hu5h00o";
const EMAILJS_TEMPLATE_ADMIN = "template_i0rlm7u";

const { createClient } = supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
emailjs.init(EMAILJS_SERVICE_ID);

const PROMO_CODES = {
    'SUMMER20': 0.20,
    'STUDENT10': 0.10,
    'FIRSTORDER': 0.15,
    'IGCSE': 0.25
};

let frontPhotoFile = null;
let backPhotoFile = null;
let currentOrderId = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Page loaded - initializing...');
    
    // Scroll animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    });
    
    document.querySelectorAll('.animate, .animate-item').forEach(el => {
        observer.observe(el);
    });

    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            document.getElementById(targetId).scrollIntoView({ 
                behavior: 'smooth' 
            });
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // Quantity buttons
    document.getElementById('qtyMinus').addEventListener('click', () => {
        let qty = parseInt(document.getElementById('quantity').value);
        if (qty > 1) {
            document.getElementById('quantity').value = qty - 1;
            document.getElementById('qtyDisplay').textContent = qty - 1;
            updatePricing();
        }
    });

    document.getElementById('qtyPlus').addEventListener('click', () => {
        let qty = parseInt(document.getElementById('quantity').value);
        if (qty < 10) {
            document.getElementById('quantity').value = qty + 1;
            document.getElementById('qtyDisplay').textContent = qty + 1;
            updatePricing();
        }
    });

    // Photo uploads - CLICK ENTIRE AREA
    setupPhotoUpload('frontUpload', 'frontPhoto', 'frontPreview', 'frontStatus');
    setupPhotoUpload('backUpload', 'backPhoto', 'backPreview', 'backStatus');

    // Form submission
    document.getElementById('orderForm').addEventListener('submit', handleOrder);

    // Pricing updates
    document.getElementById('promoCode').addEventListener('input', updatePricing);
    
    updatePricing();
    console.log('✅ All event listeners attached');
});

function setupPhotoUpload(containerId, inputId, previewId, statusId) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const status = document.getElementById(statusId);

    // Click entire area
    container.addEventListener('click', () => input.click());
    input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(ev) {
                preview.src = ev.target.result;
                container.classList.add('uploaded');
                status.textContent = '✅ Photo uploaded';
                status.style.display = 'block';
                
                if (inputId === 'frontPhoto') {
                    frontPhotoFile = file;
                } else {
                    backPhotoFile = file;
                }
                console.log(`✅ ${inputId} uploaded`);
            };
            reader.readAsDataURL(file);
        }
    });
}

function updatePricing() {
    const qty = parseInt(document.getElementById('quantity').value);
    const promo = document.getElementById('promoCode').value.toUpperCase().trim();
    
    document.getElementById('qtyDisplay').textContent = qty;
    const subtotal = qty * 4;
    
    let discount = 0;
    if (PROMO_CODES[promo]) {
        discount = subtotal * PROMO_CODES[promo];
        document.getElementById('discountRow').style.display = 'flex';
        document.getElementById('discount').textContent = `-${discount.toFixed(2)} AED`;
    } else {
        document.getElementById('discountRow').style.display = 'none';
    }
    
    const total = subtotal - discount;
    document.getElementById('subtotal').textContent = `${subtotal.toFixed(2)} AED`;
    document.getElementById('total').textContent = `${total.toFixed(2)} AED`;
}

async function handleOrder(e) {
    e.preventDefault();
    console.log('🚀 Order started...');
    
    const formData = {
        name: document.getElementById('customerName').value.trim(),
        email: document.getElementById('customerEmail').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        quantity: parseInt(document.getElementById('quantity').value),
        promoCode: document.getElementById('promoCode').value.toUpperCase().trim()
    };

    // Validation
    if (!formData.name || !formData.email || !frontPhotoFile || !backPhotoFile) {
        alert('Please fill all fields and upload both photos');
        return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        alert('Please enter valid email');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('span');
    const loader = document.querySelector('.loader');
    
    submitBtn.disabled = true;
    loader.style.display = 'block';
    btnText.textContent = 'Processing...';

    try {
        console.log('📤 Uploading photos...');
        const timestamp = Date.now();
        const frontPath = `order_${timestamp}_front.jpg`;
        const backPath = `order_${timestamp}_back.jpg`;

        // Upload photos
        const frontUpload = await supabase.storage
            .from('order-photos')
            .upload(frontPath, frontPhotoFile);

        const backUpload = await supabase.storage
            .from('order-photos')
            .upload(backPath, backPhotoFile);

        if (frontUpload.error || backUpload.error) {
            throw new Error('Photo upload failed');
        }

        console.log('💾 Saving to database...');
        // Save order
        const { data: order, error } = await supabase
            .from('orders')
            .insert([{
                customer_name: formData.name,
                customer_email: formData.email,
                phone: formData.phone || null,
                items: [{quantity: formData.quantity, price: 4}],
                promo_code: formData.promoCode || null,
                discount_amount: PROMO_CODES[formData.promoCode] ? (formData.quantity * 4 * PROMO_CODES[formData.promoCode]) : 0,
                total_price_aed: formData.quantity * 4,
                front_photo_path: frontPath,
                back_photo_path: backPath
            }])
            .select('id')
            .single();

        if (error) throw error;

        currentOrderId = order.id;
        console.log('✅ Order saved! ID:', order.id);

        // Show receipt
        showReceipt(formData, order.id);
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Order failed: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        loader.style.display = 'none';
        btnText.textContent = 'Place Order';
    }
}

function showReceipt(formData, orderId) {
    document.getElementById('receiptCustomer').textContent = formData.name;
    document.getElementById('receiptEmail').textContent = formData.email;
    document.getElementById('receiptPhone').textContent = formData.phone || 'Not provided';
    document.getElementById('receiptQty').textContent = formData.quantity;
    document.getElementById('receiptSubtotal').textContent = (formData.quantity * 4).toFixed(2) + ' AED';
    document.getElementById('receiptTotal').textContent = (formData.quantity * 4).toFixed(2) + ' AED';
    document.getElementById('orderId').textContent = `#${orderId}`;
    
    document.getElementById('receiptFront').src = URL.createObjectURL(frontPhotoFile);
    document.getElementById('receiptBack').src = URL.createObjectURL(backPhotoFile);
    
    document.getElementById('receiptModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('receiptModal').style.display = 'none';
    document.getElementById('orderForm').reset();
    document.querySelectorAll('.photo-upload-area').forEach(el => {
        el.classList.remove('uploaded');
    });
    frontPhotoFile = null;
    backPhotoFile = null;
    updatePricing();
}

async function downloadPDF() {
    const receipt = document.querySelector('.receipt-card');
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
        doc.save(`KeyCraft-Order-${currentOrderId}.pdf`);
    } catch (e) {
        alert('PDF failed, please try again');
    }
}
