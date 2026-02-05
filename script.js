const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN";
const EMAILJS_PUBLIC_KEY = "wFE7Ll5cDKSxM4Zfs";
const EMAILJS_SERVICE_ID = "service_zlh57wd";
const EMAILJS_TEMPLATE_CUSTOMER = "template_hu5h00o";
const EMAILJS_TEMPLATE_ADMIN = "template_i0rlm7u";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
let orderSubtotal = 0;

document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initQuantityControls();
    initPhotoUploads();
    initFormSubmission();
    updatePricing();
});

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
        let qty = parseInt(document.getElementById('quantitySlider').value);
        if (qty > 1) {
            document.getElementById('quantitySlider').value = qty - 1;
            document.getElementById('quantityDisplay').textContent = qty - 1;
            updatePricing();
        }
    });

    document.getElementById('qtyPlus').addEventListener('click', () => {
        let qty = parseInt(document.getElementById('quantitySlider').value);
        if (qty < 10) {
            document.getElementById('quantitySlider').value = qty + 1;
            document.getElementById('quantityDisplay').textContent = qty + 1;
            updatePricing();
        }
    });

    document.getElementById('quantitySlider').addEventListener('input', (e) => {
        document.getElementById('quantityDisplay').textContent = e.target.value;
        updatePricing();
    });

    document.getElementById('promoCode').addEventListener('input', updatePricing);
}

function initPhotoUploads() {
    document.getElementById('frontPhoto').addEventListener('change', handlePhotoUpload);
    document.getElementById('backPhoto').addEventListener('change', handlePhotoUpload);
}

function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Image size must be less than 5MB');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(ev) {
        const preview = e.target.id === 'frontPhoto' ? 
            document.getElementById('frontPreview') : 
            document.getElementById('backPreview');
        const uploadContainer = e.target.closest('.photo-upload');
        
        preview.src = ev.target.result;
        uploadContainer.classList.add('has-image');
        
        if (e.target.id === 'frontPhoto') {
            frontPhotoFile = file;
        } else {
            backPhotoFile = file;
        }
    };
    reader.readAsDataURL(file);
}

function updatePricing() {
    const quantity = parseInt(document.getElementById('quantitySlider').value);
    const promoCode = document.getElementById('promoCode').value.toUpperCase().trim();
    
    orderSubtotal = quantity * 4;
    let discountAmount = 0;
    
    if (PROMO_CODES[promoCode]) {
        discountAmount = orderSubtotal * PROMO_CODES[promoCode];
        document.getElementById('discountRow').style.display = 'flex';
        document.getElementById('discountAmount').textContent = `-${discountAmount.toFixed(2)} AED`;
    } else {
        document.getElementById('discountRow').style.display = 'none';
    }
    
    const total = orderSubtotal - discountAmount;
    document.getElementById('subtotal').textContent = `${orderSubtotal.toFixed(2)} AED`;
    document.getElementById('totalAmount').textContent = `${total.toFixed(2)} AED`;
}

function initFormSubmission() {
    document.getElementById('orderForm').addEventListener('submit', handleSubmit);
}

async function handleSubmit(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('customerName').value.trim(),
        email: document.getElementById('customerEmail').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        quantity: parseInt(document.getElementById('quantitySlider').value),
        promoCode: document.getElementById('promoCode').value.toUpperCase().trim()
    };

    // Validation
    if (!formData.name || !formData.email) {
        alert('Please fill in all required fields');
        return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        alert('Please enter a valid email address');
        return;
    }
    
    if (!frontPhotoFile || !backPhotoFile) {
        alert('Please upload both front and back photos');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('span');
    const loader = document.querySelector('.button-loader');
    
    submitBtn.disabled = true;
    loader.style.display = 'inline-block';
    btnText.textContent = 'Processing Order...';

    try {
        // Calculate final pricing
        const discountAmount = PROMO_CODES[formData.promoCode] ? orderSubtotal * PROMO_CODES[formData.promoCode] : 0;
        const totalPrice = orderSubtotal - discountAmount;

        // 1. Upload photos to Supabase Storage
        const timestamp = Date.now();
        const frontFileName = `order_${timestamp}_front_${frontPhotoFile.name}`;
        const backFileName = `order_${timestamp}_back_${backPhotoFile.name}`;

        const frontUpload = await supabase.storage
            .from('order-photos')
            .upload(frontFileName, frontPhotoFile, { upsert: true });

        const backUpload = await supabase.storage
            .from('order-photos')
            .upload(backFileName, backPhotoFile, { upsert: true });

        if (frontUpload.error) throw new Error('Front photo upload failed: ' + frontUpload.error.message);
        if (backUpload.error) throw new Error('Back photo upload failed: ' + backUpload.error.message);

        // 2. Save order to database with ALL customer info
        const { data: order, error: dbError } = await supabase
            .from('orders')
            .insert([{
                customer_name: formData.name,
                customer_email: formData.email,
                phone: formData.phone || null,
                items: [{
                    name: 'Custom Photo Keychain (3×4.78cm)',
                    quantity: formData.quantity,
                    price_per_unit: 4,
                    total: orderSubtotal
                }],
                promo_code: formData.promoCode || null,
                discount_amount: discountAmount,
                total_price_aed: totalPrice,
                front_photo_path: frontFileName,
                back_photo_path: backFileName,
                status: 'pending'
            }])
            .select('id, created_at')
            .single();

        if (dbError) throw new Error('Database error: ' + dbError.message);

        currentOrderId = order.id;

        // 3. Send confirmation emails
        await sendCustomerEmail(formData, totalPrice, discountAmount);
        await sendAdminEmail(formData, totalPrice, discountAmount, order.id);

        // 4. Show beautiful receipt
        showReceipt(formData, orderSubtotal, discountAmount, totalPrice, order.id);

        console.log('✅ Order saved successfully:', order);
        console.log('📸 Photos saved:', frontFileName, backFileName);

    } catch (error) {
        console.error('❌ Order failed:', error);
        alert('Order failed: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        loader.style.display = 'none';
        btnText.textContent = 'Place Order';
    }
}

async function sendCustomerEmail(formData, totalPrice, discountAmount) {
    try {
        const templateParams = {
            to_name: formData.name,
            to_email: formData.email,
            order_id: currentOrderId,
            quantity: formData.quantity,
            subtotal: orderSubtotal.toFixed(2),
            discount: discountAmount > 0 ? discountAmount.toFixed(2) : 0,
            total: totalPrice.toFixed(2)
        };
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CUSTOMER, templateParams);
        console.log('✅ Customer email sent');
    } catch (e) {
        console.warn('⚠️ Customer email failed:', e);
    }
}

async function sendAdminEmail(formData, totalPrice, discountAmount, orderId) {
    try {
        const templateParams = {
            customer_name: formData.name,
            customer_email: formData.email,
            customer_phone: formData.phone || 'Not provided',
            order_id: orderId,
            quantity: formData.quantity,
            subtotal: orderSubtotal.toFixed(2),
            discount: discountAmount > 0 ? discountAmount.toFixed(2) : 0,
            total: totalPrice.toFixed(2),
            front_photo: `${SUPABASE_URL}/storage/v1/object/public/order-photos/order_${Date.now()}_front.jpg`,
            back_photo: `${SUPABASE_URL}/storage/v1/object/public/order-photos/order_${Date.now()}_back.jpg`
        };
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ADMIN, templateParams);
        console.log('✅ Admin email sent');
    } catch (e) {
        console.warn('⚠️ Admin email failed:', e);
    }
}

function showReceipt(formData, subtotal, discountAmount, totalPrice, orderId) {
    document.getElementById('receiptName').textContent = formData.name;
    document.getElementById('receiptEmail').textContent = formData.email;
    document.getElementById('receiptPhone').textContent = formData.phone || 'Not provided';
    document.getElementById('receiptQuantity').textContent = formData.quantity;
    document.getElementById('receiptSubtotal').textContent = `${subtotal.toFixed(2)} AED`;
    document.getElementById('receiptTotal').textContent = `${totalPrice.toFixed(2)} AED`;
    document.getElementById('orderNumber').textContent = `ORDER #${orderId}`;
    
    if (discountAmount > 0) {
        document.getElementById('receiptDiscountRow').style.display = 'flex';
        document.getElementById('receiptDiscount').textContent = `-${discountAmount.toFixed(2)} AED`;
    }
    
    document.getElementById('receiptFrontPhoto').src = URL.createObjectURL(frontPhotoFile);
    document.getElementById('receiptBackPhoto').src = URL.createObjectURL(backPhotoFile);
    
    document.getElementById('receiptModal').style.display = 'flex';
}

function closeReceipt() {
    document.getElementById('receiptModal').style.display = 'none';
    document.getElementById('orderForm').reset();
    document.querySelectorAll('.photo-upload').forEach(el => el.classList.remove('has-image'));
    document.querySelectorAll('.photo-preview').forEach(el => el.style.display = 'none');
    frontPhotoFile = null;
    backPhotoFile = null;
    updatePricing();
}

async function downloadReceipt() {
    const receiptContent = document.querySelector('.receipt-container');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    try {
        const canvas = await html2canvas(receiptContent, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: receiptContent.scrollWidth,
            height: receiptContent.scrollHeight
        });
        
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 10, 10, 190, 277);
        doc.save(`KeyCraft-Order-${currentOrderId}.pdf`);
    } catch (error) {
        console.error('PDF Error:', error);
        alert('PDF generation failed. Please try again.');
    }
}
