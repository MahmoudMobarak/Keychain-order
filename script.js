/*************************************************
 * 1. CONFIG – FILL THESE IN
 *************************************************/

// Supabase
const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN";

// EmailJS – from your EmailJS dashboard
// Service ID: from “Email Services”
// Template IDs: from “Email Templates” for customer & admin
const EMAILJS_SERVICE_ID = "service_zlh57wd";
const EMAILJS_TEMPLATE_CUSTOMER = "template_hu5h00o";
const EMAILJS_TEMPLATE_ADMIN = "template_i0rlm7u";

/*************************************************
 * 1. CONFIG – FILL THESE IN
 *************************************************/
const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN";
const EMAILJS_SERVICE_ID = "service_zlh57wd";
const EMAILJS_TEMPLATE_CUSTOMER = "template_hu5h00o";
const EMAILJS_TEMPLATE_ADMIN = "template_i0rlm7u";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const PRICE_PER_ITEM = 4;

/*************************************************
 * 2. SCROLL ANIMATIONS + BUTTON FIXES
 *************************************************/
function smoothScrollTo(targetId) {
  const target = document.getElementById(targetId);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Fix ALL "Order Now" and "Customize" buttons
document.addEventListener('DOMContentLoaded', function() {
  // Navigation links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      smoothScrollTo(targetId);
    });
  });

  // All CTA buttons
  document.querySelectorAll('[data-scroll]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-scroll');
      smoothScrollTo(targetId);
    });
  });

  // Animate feature cards on scroll
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card = entry.target;
        const animation = card.getAttribute('data-animation') || 'slide';
        card.classList.add('animate-' + animation);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.feature-card').forEach(card => {
    observer.observe(card);
  });

  // Initial price calculation
  updateTotal();
});

/*************************************************
 * 3. PRICE + PROMO LOGIC
 *************************************************/
const qtyInput = document.getElementById("item-quantity");
const totalPriceText = document.getElementById("total-price");
const baseTotalText = document.getElementById("base-total");
const discountTotalText = document.getElementById("discount-total");
const promoInput = document.getElementById("promo-code");
const promoMessage = document.getElementById("promo-message");

let appliedPromo = null;

function updateTotal() {
  const qty = Math.min(Math.max(parseInt(qtyInput.value || "1", 10), 1), 10);
  qtyInput.value = qty;
  
  const baseTotal = qty * PRICE_PER_ITEM;
  let discount = 0;

  if (appliedPromo) {
    if (appliedPromo.discount_type === "percent") {
      discount = (baseTotal * appliedPromo.discount_value) / 100;
    } else {
      discount = appliedPromo.discount_value;
    }
    discount = Math.min(discount, baseTotal);
  }

  const finalTotal = baseTotal - discount;
  
  baseTotalText.textContent = `${baseTotal.toFixed(2)} AED`;
  discountTotalText.textContent = `-${discount.toFixed(2)} AED`;
  totalPriceText.textContent = `${finalTotal.toFixed(2)} AED`;
  
  return { qty, baseTotal, discount, finalTotal };
}

qtyInput.addEventListener("input", updateTotal);

document.getElementById("apply-promo-btn").addEventListener("click", async () => {
  const code = promoInput.value.trim();
  appliedPromo = null;
  promoMessage.textContent = "";
  promoMessage.className = "";

  if (!code) {
    promoMessage.textContent = "Enter promo code";
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();

    if (error || !data) {
      promoMessage.textContent = "Invalid promo code";
      promoMessage.className = "error";
    } else {
      appliedPromo = data;
      promoMessage.textContent = `✓ ${data.description}`;
      promoMessage.className = "success";
      updateTotal();
    }
  } catch (err) {
    promoMessage.textContent = "Error checking code";
    promoMessage.className = "error";
  }
});

/*************************************************
 * 4. SUPABASE UPLOAD + ORDER
 *************************************************/
async function uploadPhoto(file, folder) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  
  const { data, error } = await supabaseClient
    .storage
    .from("order-photos")
    .upload(fileName, file);

  if (error) throw error;
  return data.path;
}

const orderForm = document.getElementById("order-form");
const formError = document.getElementById("form-error");

orderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";
  formError.className = "";

  const name = document.getElementById("customer-name").value.trim();
  const email = document.getElementById("customer-email").value.trim();
  const phone = document.getElementById("customer-phone").value.trim();
  const frontFile = document.getElementById("front-photo").files[0];
  const backFile = document.getElementById("back-photo").files[0];

  if (!name || !email || !frontFile || !backFile) {
    formError.textContent = "Please fill all required fields";
    formError.className = "error";
    return;
  }

  const { qty, baseTotal, discount, finalTotal } = updateTotal();
  const promoCode = appliedPromo ? appliedPromo.code : null;

  try {
    // Show loading
    orderForm.querySelector('.cta-primary').textContent = "Processing...";
    
    // Upload photos
    const frontPath = await uploadPhoto(frontFile, "front");
    const backPath = await uploadPhoto(backFile, "back");

    // Save order
    const orderPayload = {
      customer_name: name,
      customer_email: email,
      phone: phone || null,
      items: [{ quantity: qty, unit_price: PRICE_PER_ITEM }],
      promo_code: promoCode,
      discount_amount: discount,
      total_price_aed: finalTotal,
      front_photo_path: frontPath,
      back_photo_path: backPath
    };

    const { data: order, error } = await supabaseClient
      .from("orders")
      .insert(orderPayload)
      .select()
      .single();

    if (error) throw error;

    // Send emails
    await sendEmailsWithEmailJS(order);

    // Show receipt
    showReceiptModal(order);
    orderForm.reset();
    updateTotal();

  } catch (err) {
    console.error(err);
    formError.textContent = "Order failed. Try again.";
    formError.className = "error";
  } finally {
    orderForm.querySelector('.cta-primary').textContent = "Place Order";
  }
});

/*************************************************
 * 5. EMAILJS
 *************************************************/
async function sendEmailsWithEmailJS(order) {
  const qty = order.items[0]?.quantity || 1;

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CUSTOMER, {
      to_name: order.customer_name,
      order_id: order.id,
      quantity: qty,
      total_price: order.total_price_aed.toFixed(2)
    });

    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ADMIN, {
      order_id: order.id,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.phone || "-",
      quantity: qty,
      total_price: order.total_price_aed.toFixed(2),
      promo_code: order.promo_code || "-"
    });
  } catch (error) {
    console.error("Email failed:", error);
  }
}

/*************************************************
 * 6. RECEIPT MODAL (NOW WORKS!)
 *************************************************/
const receiptModal = document.getElementById("receipt-modal");
const closeReceiptBtn = document.querySelector(".modal-close");
const downloadPdfBtn = document.getElementById("download-pdf");

function showReceiptModal(order) {
  document.getElementById("receipt-order-id").textContent = order.id;
  document.getElementById("receipt-name").textContent = order.customer_name;
  document.getElementById("receipt-email").textContent = order.customer_email;
  document.getElementById("receipt-phone").textContent = order.phone || "-";
  document.getElementById("receipt-quantity").textContent = order.items[0]?.quantity || "?";
  document.getElementById("receipt-promo").textContent = order.promo_code || "-";
  document.getElementById("receipt-total").textContent = `${order.total_price_aed.toFixed(2)} AED`;
  
  receiptModal.classList.add("show");
}

closeReceiptBtn.addEventListener("click", () => {
  receiptModal.classList.remove("show");
});

receiptModal.addEventListener("click", (e) => {
  if (e.target === receiptModal) {
    receiptModal.classList.remove("show");
  }
});

downloadPdfBtn.addEventListener("click", () => {
  if (!window.jspdf) {
    alert("PDF loading...");
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  const orderId = document.getElementById("receipt-order-id").textContent;
  const name = document.getElementById("receipt-name").textContent;
  const email = document.getElementById("receipt-email").textContent;
  const total = document.getElementById("receipt-total").textContent;

  doc.setFontSize(20);
  doc.text("Order Receipt", 20, 30);
  doc.setFontSize(16);
  doc.text(`Order #${orderId}`, 20, 50);
  doc.text(`Name: ${name}`, 20, 70);
  doc.text(`Email: ${email}`, 20, 90);
  doc.text(`Total: ${total}`, 20, 120);
  
  doc.save(`receipt-${orderId}.pdf`);
});
