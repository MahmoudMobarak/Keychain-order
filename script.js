// CONFIG - REPLACE WITH YOUR ACTUAL CREDENTIALS
const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN";
const EMAILJS_PUBLIC_KEY = "wFE7Ll5cDKSxM4Zfs";
const EMAILJS_SERVICE_ID = "service_zlh57wd";
const EMAILJS_TEMPLATE_CUSTOMER = "template_hu5h00o";
const EMAILJS_TEMPLATE_ADMIN = "template_i0rlm7u";

const { createClient } = supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
emailjs.init(EMAILJS_PUBLIC_KEY);

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
    console.log('✅ KeyCraft loaded successfully');

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
            document.getElementById(targetId).scrollIntoView({ behavior: 'smooth' });
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // Quantity buttons (+/- only)
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

    // Photo uploads - BIG CLICKABLE AREAS
    setupPhotoUpload('frontUpload', 'frontPhoto', 'frontPreview', 'frontStatus');
    setupPhotoUpload('backUpload', 'backPhoto', 'backPreview', 'backStatus');

    // Form submission
    document.getElementById('orderForm').addEventListener('submit', handleOrder);

    // Pricing updates
    document.getElementById('promoCode').addEventListener('input', updatePricing);
    
    updatePricing();
});

function setupPhotoUpload(containerId, inputId, previewId, statusId) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const status = document.getElementById(statusId);

    // Make ENTIRE AREA clickable
    container.addEventListener('click', () => input.click());
    
    input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(ev) {
                preview.src = ev.target.result;
                container.classList.add('uploaded');
                status.textContent = '✅ Photo uploaded successfully';
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
    console.log('🚀 Processing order...');

    const formData = {
        name: document.getElementById('customerName').value.trim(),
        email: document.getElementById('customerEmail').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        quantity: parseInt(document.getElementById('quantity').value),
        promoCode: document.getElementById('promoCode').value.toUpperCase().trim()
    };

    // Validation
    if (!formData.name || !formData.email || !frontPhotoFile || !backPhotoFile) {
        alert('Please fill all required fields and upload both photos');
        return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        alert('Please enter a valid email address');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('span');
    const loader = submitBtn.querySelector('.loader');
    
    submitBtn.disabled = true;
    loader.style.display = 'block';
    btnText.textContent = 'Processing...';

    try {
        console.log('📤 Uploading photos to Supabase...');
        const timestamp = Date.now();
        const frontPath = `order_${timestamp}_front.jpg`;
        const backPath = `order_${timestamp}_back.jpg`;

        // Upload front photo
        const frontUpload = await supabase.storage
            .from('order-photos')
            .upload(frontPath, frontPhotoFile, { upsert: true });

        // Upload back photo
        const backUpload = await supabase.storage
            .from('order-photos')
            .upload(backPath, backPhotoFile, { upsert: true });

        if (frontUpload.error || backUpload.error) {
            throw new Error('Photo upload failed: ' + (frontUpload.error?.message || backUpload.error?.message));
        }

        // Calculate final pricing
        const subtotal = formData.quantity * 4;
        const discountAmount = PROMO_CODES[formData.promoCode] ? subtotal * PROMO_CODES[formData.promoCode] : 0;
        const totalPrice = subtotal - discountAmount;

        console.log('💾 Saving order to Supabase...');
        // Save complete order to database
        const { data: order, error } = await supabase
            .from('orders')
            .insert([{
                customer_name: formData.name,
                customer_email: formData.email,
                phone: formData.phone || null,
                quantity: formData.quantity,
                promo_code: formData.promoCode || null,
                subtotal: subtotal,
                discount_amount: discountAmount,
                total_price_aed: totalPrice,
                front_photo_path: frontPath,
                back_photo_path: backPath,
                status: 'pending',
                created_at: new Date().toISOString()
            }])
            .select('id')
            .single();

        if (error) throw error;

        currentOrderId = order.id;
        console.log('✅ Order saved! ID:', order.id);

        // Send EmailJS notifications
        await sendEmailNotifications(formData, order.id, totalPrice, discountAmount);

        // Show professional receipt
        showReceipt(formData, order.id, totalPrice, discountAmount);

    } catch (error) {
        console.error('❌ Order error:', error);
        alert('Order failed: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        loader.style.display = 'none';
        btnText.textContent = 'Place Order';
    }
}

async function sendEmailNotifications(formData, orderId, totalPrice, discountAmount) {
    console.log('📧 Sending EmailJS notifications...');

    // Customer email
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CUSTOMER, {
        order_id: orderId,
        customer_name: formData.name,
        customer_email: formData.email,
        quantity: formData.quantity,
        total_price: totalPrice.toFixed(2),
        promo_code: formData.promoCode || 'None'
    });

    // Admin email
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ADMIN, {
        order_id: orderId,
        customer_name: formData.name,
        customer_email: formData.email,
        phone: formData.phone || 'Not provided',
        quantity: formData.quantity,
        subtotal: (formData.quantity * 4).toFixed(2),
        discount: discountAmount.toFixed(2),
        total_price: totalPrice.toFixed(2),
        promo_code: formData.promoCode || 'None'
    });

    console.log('✅ Both emails sent successfully');
}

function showReceipt(formData, orderId, totalPrice, discountAmount) {
    document.getElementById('receiptCustomer').textContent = formData.name;
    document.getElementById('receiptEmail').textContent = formData.email;
    document.getElementById('receiptPhone').textContent = formData.phone || 'Not provided';
    document.getElementById('receiptQty').textContent = formData.quantity;
    document.getElementById('receiptSubtotal').textContent = (formData.quantity * 4).toFixed(2) + ' AED';
    
    if (discountAmount > 0) {
        document.getElementById('receiptDiscountRow').style.display = 'flex';
        document.getElementById('receiptDiscount').textContent = `-${discountAmount.toFixed(2)} AED`;
    }
    
    document.getElementById('receiptTotal').textContent = totalPrice.toFixed(2) + ' AED';
    document.getElementById('orderId').textContent = `#${orderId}`;
    
    document.getElementById('receiptFront').src = URL.createObjectURL(frontPhotoFile);
    document.getElementById('receiptBack').src = URL.createObjectURL(backPhotoFile);
    
    document.getElementById('receiptModal').style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent background scroll
}

function closeModal() {
    document.getElementById('receiptModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('orderForm').reset();
    document.querySelectorAll('.photo-upload-area').forEach(el => {
        el.classList.remove('uploaded');
        el.querySelector('.photo-preview').style.display = 'none';
        el.querySelector('.upload-status').style.display = 'none';
    });
    frontPhotoFile = null;
    backPhotoFile = null;
    currentOrderId = null;
    updatePricing();
}

async function downloadPDF() {
    const receipt = document.querySelector('.receipt-card');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    try {
        const canvas = await html2canvas(receipt, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: receipt.scrollWidth,
            height: receipt.scrollHeight
        });
        
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210;
        const pageHeight = 295;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            doc.addPage();
            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        doc.save(`KeyCraft-Order-${currentOrderId}.pdf`);
        console.log('✅ PDF downloaded');
    } catch (e) {
        console.error('PDF error:', e);
        alert('PDF generation failed, please try again');
    }
}
