const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN";
const EMAILJS_PUBLIC_KEY = "wFE7Ll5cDKSxM4Zfs";
const EMAILJS_SERVICE_ID = "service_zlh57wd";
const EMAILJS_TEMPLATE_CUSTOMER = "template_hu5h00o";
const EMAILJS_TEMPLATE_ADMIN = "template_i0rlm7u";

const { createClient } = supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize EmailJS
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

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    const orderForm = document.getElementById('orderForm');
    const quantitySlider = document.getElementById('quantity');
    const qtyDisplay = document.getElementById('qtyDisplay');
    const quantityText = document.getElementById('quantity');
    const promoInput = document.getElementById('promoCode');
    
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute('href'));
            target.scrollIntoView({ behavior: 'smooth' });
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // Quantity slider
    quantitySlider.addEventListener('input', updatePricing);
    promoInput.addEventListener('input', updatePricing);

    // File uploads
    document.getElementById('frontPhoto').addEventListener('change', handlePhotoUpload);
    document.getElementById('backPhoto').addEventListener('change', handlePhotoUpload);

    // Form submission
    orderForm.addEventListener('submit', handleOrderSubmit);

    updatePricing();
});

function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = e.target.id === 'frontPhoto' ? 
            document.getElementById('frontPreview') : 
            document.getElementById('backPreview');
        const zone = e.target.id === 'frontPhoto' ? 
            document.getElementById('frontZone') : 
            document.getElementById('backZone');
            
        preview.src = e.target.result;
        preview.style.display = 'block';
        zone.classList.add('has-image');

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
    const promoCode = document.getElementById('promoCode').value.toUpperCase();
    
    document.getElementById('qtyDisplay').textContent = qty;
    document.getElementById('quantity').nextElementSibling.querySelector('.quantity-display').textContent = `${qty} Keychain${qty > 1 ? 's' : ''} - ${qty * 4} AED`;
    
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

    // Validation
    if (!formData.name || !formData.email || !frontPhotoFile || !backPhotoFile) {
        alert('Please fill all required fields and upload both photos.');
        return;
    }

    if (!validateEmail(formData.email)) {
        alert('Please enter a valid email address.');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const loader = submitBtn.querySelector('.loader');
    const btnText = submitBtn.querySelector('span');
    
    submitBtn.disabled = true;
    loader.style.display = 'block';
    btnText.textContent = 'Processing...';

    try {
        // Calculate pricing
        const basePrice = 4;
        const subtotal = basePrice * formData.quantity;
        let discountAmount = 0;
        
        if (PROMO_CODES[formData.promoCode]) {
            discountAmount = subtotal * PROMO_CODES[formData.promoCode];
        }
        
        const totalPrice = subtotal - discountAmount;

        // Upload photos
        const timestamp = Date.now();
        const frontPath = `order_${timestamp}_front.jpg`;
        const backPath = `order_${timestamp}_back.jpg`;

        const frontUpload = await supabase.storage
            .from('order-photos')
            .upload(frontPath, frontPhotoFile, { upsert: true });

        const backUpload = await supabase.storage
            .from('order-photos')
            .upload(backPath, backPhotoFile, { upsert: true });

        if (frontUpload.error) throw new Error('Front photo upload failed');
        if (backUpload.error) throw new Error('Back photo upload failed');

        // Save order
        const { data: order, error } = await supabase
            .from('orders')
            .insert([{
                customer_name: formData.name,
                customer_email: formData.email,
                phone: formData.phone || null,
                items: [{ quantity: formData.quantity, price: basePrice }],
                promo_code: formData.promoCode || null,
                discount_amount: discountAmount,
                total_price_aed: totalPrice
            }])
            .select('id')
            .single();

        if (error) throw error;

        currentOrderId = order.id;

        // Send emails (optional - won't break if EmailJS not configured)
        try {
            await sendCustomerEmail(formData, totalPrice, discountAmount);
            await sendAdminEmail(formData, totalPrice, discountAmount, order.id);
        } catch (emailError) {
            console.warn('Email sending failed:', emailError);
        }

        // Show receipt
        showReceipt(formData, totalPrice, order.id);

    } catch (error) {
        console.error('Order error:', error);
        alert(`Order failed: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        loader.style.display = 'none';
        btnText.textContent = 'Place Secure Order';
    }
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendCustomerEmail(formData, totalPrice, discountAmount) {
    const params = {
        to_name: formData.name,
        to_email: formData.email,
        order_id: currentOrderId,
        quantity: formData.quantity,
        total: totalPrice.toFixed(2),
        discount: discountAmount > 0 ? `${(discountAmount/(totalPrice+discountAmount)*100).toFixed(0)}%` : 'None'
    };
    return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CUSTOMER, params);
}

async function sendAdminEmail(formData, totalPrice, discountAmount, orderId) {
    const params = {
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone || 'N/A',
        quantity: formData.quantity,
        total: totalPrice.toFixed(2),
        order_id: orderId,
        promo_code: formData.promoCode || 'None'
    };
    return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ADMIN, params);
}

function showReceipt(formData, totalPrice, orderId) {
    document.getElementById('receiptName').textContent = formData.name;
    document.getElementById('receiptEmail').textContent = formData.email;
    document.getElementById('receiptPhone').textContent = formData.phone || 'Not provided';
    document.getElementById('receiptQuantity').textContent = formData.quantity;
    document.getElementById('receiptTotal').textContent = `${totalPrice.toFixed(2)} AED`;
    document.getElementById('orderNumber').textContent = `#${orderId}`;
    document.getElementById('receiptFront').src = URL.createObjectURL(frontPhotoFile);
    document.getElementById('receiptBack').src = URL.createObjectURL(backPhotoFile);
    
    document.getElementById('receiptModal').style.display = 'flex';
}

function closeReceipt() {
    document.getElementById('receiptModal').style.display = 'none';
    document.getElementById('orderForm').reset();
    // Reset uploads
    document.querySelectorAll('.upload-zone').forEach((zone, i) => {
        zone.classList.remove('has-image');
        zone.querySelector('.upload-preview').style.display = 'none';
        zone.querySelector('.upload-content').style.display = 'block';
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
        await html2canvas(receipt, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 10, 10, 190, 277);
            doc.save(`keycraft-order-${currentOrderId}.pdf`);
        });
    } catch (error) {
        console.error('PDF generation failed:', error);
        alert('PDF download failed. Please try again.');
    }
}
