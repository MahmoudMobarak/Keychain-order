// CONFIGURATION - PASTE YOUR KEYS HERE
const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN"; 
const EMAILJS_KEY = "wFE7Ll5cDKSxM4Zfs"; // Public Key
const EMAILJS_SERVICE = "service_zlh57wd";
const EMAILJS_TEMPLATE_CUSTOMER = "template_hu5h00o";
const EMAILJS_TEMPLATE_ADMIN = "template_i0rlm7u";

// Initialize
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
emailjs.init(EMAILJS_KEY);

const PRICE_PER_ITEM = 4;
let currentDiscount = 0;
let currentOrderData = null;

// Smooth Scroll
function scrollToSection(id) {
    document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
}

// Price Logic
function updatePrice() {
    const qty = document.getElementById('quantity').value;
    const basePrice = qty * PRICE_PER_ITEM;
    const total = basePrice - currentDiscount;
    const final = total > 0 ? total : 0;
    
    document.getElementById('final-price').innerText = final.toFixed(2) + " AED";
    return final;
}

// Promo Code Logic
async function checkPromo() {
    const code = document.getElementById('promo').value.trim();
    const status = document.getElementById('promo-status');
    
    if(!code) return;

    const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .eq('active', true)
        .single();

    if (data) {
        if(data.discount_type === 'percent') {
            const qty = document.getElementById('quantity').value;
            currentDiscount = (qty * PRICE_PER_ITEM) * (data.discount_value / 100);
        } else {
            currentDiscount = data.discount_value;
        }
        status.innerText = "Discount Applied!";
        status.className = "success-text";
        updatePrice();
    } else {
        currentDiscount = 0;
        status.innerText = "Invalid Code";
        status.className = "error-text";
        updatePrice();
    }
}

// Helper: Upload File
async function uploadFile(file) {
    const fileName = `${Date.now()}_${file.name.replace(/\s/g, '')}`;
    const { data, error } = await supabase.storage
        .from('order-photos')
        .upload(fileName, file);
        
    if (error) throw error;
    return data.path;
}

// Form Submission
document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnText = document.getElementById('btn-text');
    const loader = document.getElementById('loader');
    const errorMsg = document.getElementById('error-msg');

    // UI Loading State
    btnText.classList.add('hidden');
    loader.classList.remove('hidden');
    errorMsg.innerText = "";

    try {
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const qty = document.getElementById('quantity').value;
        const frontFile = document.getElementById('front-file').files[0];
        const backFile = document.getElementById('back-file').files[0];

        // 1. Upload Photos
        const frontPath = await uploadFile(frontFile);
        const backPath = await uploadFile(backFile);

        // 2. Insert Order to DB
        const finalPrice = updatePrice();
        const { data: order, error } = await supabase
            .from('orders')
            .insert({
                customer_name: name,
                customer_email: email,
                phone: phone,
                items: { quantity: qty },
                total_price_aed: finalPrice,
                front_photo_path: frontPath,
                back_photo_path: backPath
            })
            .select()
            .single();

        if (error) throw error;

        currentOrderData = order;

        // 3. Send Emails (Background)
        const emailData = {
            order_id: order.id,
            to_name: name,
            customer_email: email,
            total_price: finalPrice,
            quantity: qty
        };

        emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE_CUSTOMER, emailData);
        emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE_ADMIN, emailData);

        // 4. Show Receipt
        showReceipt(order);
        document.getElementById('orderForm').reset();

    } catch (err) {
        console.error(err);
        errorMsg.innerText = "Something went wrong. Please check your internet or try again.";
    } finally {
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
    }
});

// Modal Functions
function showReceipt(order) {
    document.getElementById('r-name').innerText = order.customer_name;
    document.getElementById('r-id').innerText = order.id;
    document.getElementById('r-qty').innerText = order.items.quantity;
    document.getElementById('r-total').innerText = order.total_price_aed + " AED";
    
    const modal = document.getElementById('receipt-modal');
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('receipt-modal').classList.add('hidden');
}

function downloadReceipt() {
    if(!currentOrderData) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.text("Keychain Order Receipt", 20, 30);
    
    doc.setFontSize(14);
    doc.text(`Order ID: #${currentOrderData.id}`, 20, 50);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 60);
    doc.text(`Customer: ${currentOrderData.customer_name}`, 20, 70);
    
    doc.text("-----------------------------------", 20, 80);
    doc.text(`Quantity: ${currentOrderData.items.quantity}`, 20, 90);
    doc.text(`Total Paid: ${currentOrderData.total_price_aed} AED`, 20, 100);
    
    doc.save(`Receipt_${currentOrderData.id}.pdf`);
}
