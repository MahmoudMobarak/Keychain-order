// REPLACE THESE WITH YOUR ACTUAL SUPABASE KEYS
const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co";
const SUPABASE_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. Smooth Reveal Animations on Scroll
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('active');
    });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// 2. Smooth Scroll Function
function scrollToSection(id) {
    document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
}

// 3. Price Calculation
function updatePrice() {
    const qty = document.getElementById('quantity').value;
    const total = qty * 4;
    document.getElementById('final-price').innerText = total.toFixed(2) + " AED";
}

// 4. Handle Order Submission (THE FIX)
document.getElementById('orderForm').addEventListener('submit', async function(e) {
    e.preventDefault(); // This stops the page from jumping to top
    
    const btn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const loader = document.getElementById('loader');
    
    // UI Feedback
    btn.disabled = true;
    btnText.classList.add('hidden');
    loader.classList.remove('hidden');

    try {
        const email = document.getElementById('email').value;
        const qty = document.getElementById('quantity').value;
        const frontImg = document.getElementById('front-file').files[0];
        const backImg = document.getElementById('back-file').files[0];

        // LOGIC: In a real app, you would upload to Supabase Storage here
        // For now, we simulate a successful order
        
        const orderId = Math.floor(1000 + Math.random() * 9000);

        // Show Receipt Modal
        document.getElementById('r-id').innerText = orderId;
        document.getElementById('r-qty').innerText = qty;
        document.getElementById('r-total').innerText = (qty * 4) + " AED";
        
        document.getElementById('receipt-modal').classList.remove('hidden');

    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
    }
});

// 5. PDF Receipt Generator
function downloadReceipt() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const id = document.getElementById('r-id').innerText;
    
    doc.setFontSize(20);
    doc.text("Enterprise Keychain Receipt", 20, 20);
    doc.setFontSize(12);
    doc.text(`Order Number: #${id}`, 20, 40);
    doc.text(`Quantity: ${document.getElementById('r-qty').innerText}`, 20, 50);
    doc.text(`Total Paid: ${document.getElementById('r-total').innerText}`, 20, 60);
    doc.text("Thank you for supporting our IGCSE project!", 20, 80);
    
    doc.save(`Receipt_Order_${id}.pdf`);
}
