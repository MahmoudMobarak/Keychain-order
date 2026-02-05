// 1. PROJECT CONFIG
const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co";
const SUPABASE_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN";
const EMAILJS_KEY = "wFE7Ll5cDKSxM4Zfs";
const EMAILJS_SERVICE = "service_zlh57wd";
const EMAILJS_TEMPLATE = "template_hu5h00o";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
emailjs.init(EMAILJS_KEY);

// 2. SCROLL REVEAL ENGINE
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('active');
    });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

function scrollToSection(id) {
    document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
}

// 3. PRICE ENGINE
function updatePrice() {
    const qty = document.getElementById('quantity').value;
    const final = qty * 4;
    document.getElementById('final-price').innerText = final.toFixed(2) + " AED";
    return final;
}

// 4. SUBMIT LOGIC
document.getElementById('orderForm').addEventListener('submit', async function(e) {
    e.preventDefault(); // STOPS PAGE REFRESH
    
    const btn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const loader = document.getElementById('loader');
    
    btn.disabled = true;
    btnText.classList.add('hidden');
    loader.classList.remove('hidden');

    try {
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const qty = document.getElementById('quantity').value;
        const front = document.getElementById('front-file').files[0];
        const back = document.getElementById('back-file').files[0];

        // A. Upload Photos to Supabase Storage
        const upload = async (file, name) => {
            const ext = file.name.split('.').pop();
            const path = `${Date.now()}-${name}.${ext}`;
            const { data, error } = await supabase.storage.from('order-photos').upload(path, file);
            if(error) throw error;
            return path;
        }

        const frontPath = await upload(front, 'front');
        const backPath = await upload(back, 'back');

        // B. Save to Database
        const { data: order, error: dbErr } = await supabase.from('orders').insert([{
            customer_email: email,
            phone: phone,
            quantity: qty,
            total_price: qty * 4,
            front_image: frontPath,
            back_image: backPath
        }]).select().single();

        if(dbErr) throw dbErr;

        // C. Send Confirmation Email
        await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
            order_id: order.id,
            customer_email: email,
            total_price: (qty * 4) + " AED"
        });

        // D. Show Modal
        document.getElementById('r-id').innerText = order.id;
        document.getElementById('r-qty').innerText = qty;
        document.getElementById('r-total').innerText = (qty * 4) + " AED";
        document.getElementById('receipt-modal').classList.remove('hidden');

    } catch (err) {
        alert("Error processing order: " + err.message);
    } finally {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
    }
});

// 5. PDF GENERATOR
function downloadReceipt() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const id = document.getElementById('r-id').innerText;
    
    doc.setFontSize(22);
    doc.text("ENTERPRISE RECEIPT", 20, 30);
    doc.setFontSize(12);
    doc.text(`Order: #${id}`, 20, 50);
    doc.text(`Quantity: ${document.getElementById('r-qty').innerText}`, 20, 60);
    doc.text(`Total: ${document.getElementById('r-total').innerText}`, 20, 70);
    doc.save(`Receipt_${id}.pdf`);
}
