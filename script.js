const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN";
const EMAILJS_PUBLIC_KEY = "wFE7Ll5cDKSxM4Zfs";
const EMAILJS_SERVICE_ID = "service_zlh57wd";
const EMAILJS_TEMPLATE_CUSTOMER = "template_hu5h00o";
const EMAILJS_TEMPLATE_ADMIN = "template_i0rlm7u";
const ADMIN_PASSWORD = '123';

const { createClient } = supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize EmailJS
emailjs.init(EMAILJS_SERVICE_ID);

// Promo codes (discounts)
const PROMO_CODES = {
    'SUMMER20': 0.2,  // 20% off
    'STUDENT10': 0.1, // 10% off
    'FIRSTORDER': 0.15 // 15% off
};

let currentOrderId = null;
let frontPhotoFile = null;
let backPhotoFile = null;

// DOM Elements
const orderForm = document.getElementById('orderForm');
const submitBtn = document.getElementById('submitBtn');
const loader = document.getElementById('loader');
const navLinks = document.querySelectorAll('.nav-link');
const uploadAreas = document.querySelectorAll('.upload-area');

// Navigation
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        document.getElementById(targetId).scrollIntoView({ behavior: 'smooth' });
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
    });
});

// File Upload Handling
document.getElementById('frontPhoto').addEventListener('change', handleFileUpload);
document.getElementById('backPhoto').addEventListener('change', handleFileUpload);

function handleFileUpload(e) {
    const file = e.target.files[0];
    const uploadArea = e.target.closest('.upload-area');
    
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            uploadArea.innerHTML = '';
            uploadArea.appendChild(img);
            uploadArea.classList.add('has-image');
            
            if (e.target.id === 'frontPhoto') {
                frontPhotoFile = file;
            } else {
                backPhotoFile = file;
            }
        };
        reader.readAsDataURL(file);
    }
}

// Email Validation
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Form Submission
orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('customerName').value.trim(),
        email: document.getElementById('customerEmail').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        quantity: parseInt(document.getElementById('quantity').value),
        promoCode: document.getElementById('promoCode').value.trim().toUpperCase()
    };

    // Validation
    if (!validateEmail(formData.email)) {
        alert('Please enter a valid email address.');
        return;
    }
    
    if (!frontPhotoFile || !backPhotoFile) {
        alert('Please upload both front and back photos.');
        return;
    }

    showLoader(true);

    try {
        // Calculate price
        const basePrice = 4; // AED per keychain
        let totalPrice = basePrice * formData.quantity;
        let discountAmount = 0;

        // Apply promo code
        if (PROMO_CODES[formData.promoCode]) {
            discountAmount = totalPrice * PROMO_CODES[formData.promoCode];
            totalPrice -= discountAmount;
        }

        // Upload photos to Supabase Storage
        const frontPath = `${Date.now()}_front_${frontPhotoFile.name}`;
        const backPath = `${Date.now()}_back_${backPhotoFile.name}`;

        const frontUpload = await supabase.storage
            .from('order-photos')
            .upload(frontPath, frontPhotoFile);

        const backUpload = await supabase.storage
            .from('order-photos')
            .upload(backPath, backPhotoFile);

        if (frontUpload.error || backUpload.error) {
            throw new Error('Photo upload failed');
        }

        // Insert order to database
        const { data: order, error: dbError } = await supabase
            .from('orders')
            .insert([{
                customer_name: formData.name,
                customer_email: formData.email,
                phone: formData.phone || null,
                items: [{ quantity: formData.quantity, price: basePrice }],
                promo_code: formData.promoCode || null,
                discount_amount: discountAmount,
                total_price_aed: totalPrice,
                front_photo_path: frontPath,
                back_photo_path: backPath
            }])
            .select('id')
            .single();

        if (dbError) throw dbError;

        currentOrderId = order.id;

        // Send emails
        await sendConfirmationEmail(formData, totalPrice, discountAmount);
        await sendAdminEmail(formData, totalPrice, discountAmount, order.id);

        // Show receipt
        showReceipt(formData, totalPrice, discountAmount, order.id);
        
    } catch (error) {
        console.error('Order error:', error);
        alert('Order failed. Please try again.');
    } finally {
        showLoader(false);
    }
});

async function sendConfirmationEmail(formData, totalPrice, discountAmount) {
    const templateParams = {
        to_name: formData.name,
        to_email: formData.email,
        order_id: currentOrderId,
        quantity: formData.quantity,
        total_price: totalPrice.toFixed(2),
        discount: discountAmount > 0 ? `${(discountAmount/totalPrice*100).toFixed(0)}%` : 'None'
    };

    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CUSTOMER, templateParams);
}

async function sendAdminEmail(formData, totalPrice, discountAmount, orderId) {
    const templateParams = {
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone || 'Not provided',
        quantity: formData.quantity,
        total_price: totalPrice.toFixed(2),
        order_id: orderId,
        promo_code: formData.promoCode || 'None'
    };

    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ADMIN, templateParams);
}

function showReceipt(formData, totalPrice, discountAmount, orderId) {
    document.getElementById('receiptName').textContent = formData.name;
    document.getElementById('receiptEmail').textContent = formData.email;
    document.getElementById('receiptPhone').textContent = formData.phone || 'Not provided';
    document.getElementById('receiptQty').textContent = formData.quantity;
    document.getElementById('receiptTotal').textContent = `${totalPrice.toFixed(2)} AED`;
    document.getElementById('orderNumber').textContent = `#${orderId}`;
    
    // Show photo placeholders
    document.getElementById('receiptPhotos').innerHTML = `
        <img src="${URL.createObjectURL(frontPhotoFile)}" alt="Front">
        <img src="${URL.createObjectURL(backPhotoFile)}" alt="Back">
    `;
    
    document.getElementById('receiptModal').style.display = 'flex';
}

function showLoader(show) {
    submitBtn.disabled = show;
    loader.style.display = show ? 'block' : 'none';
    submitBtn.querySelector('span').textContent = show ? '' : 'Place Order';
}

function closeModal() {
    document.getElementById('receiptModal').style.display = 'none';
    orderForm.reset();
    document.querySelectorAll('.upload-area').forEach(area => {
        area.innerHTML = '<input type="file" accept="image/*" required><p>📸 Front/Back Photo</p>';
        area.classList.remove('has-image');
    });
    frontPhotoFile = null;
    backPhotoFile = null;
}

function downloadReceipt() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Order Receipt', 20, 30);
    doc.setFontSize(16);
    doc.text(`Order #${currentOrderId}`, 20, 50);
    
    const receipt = document.getElementById('receipt');
    doc.html(receipt.innerHTML, {
        callback: function (doc) {
            doc.save(`order-${currentOrderId}.pdf`);
        },
        x: 10,
        y: 70,
        width: 190,
        windowWidth: 800
    });
}
