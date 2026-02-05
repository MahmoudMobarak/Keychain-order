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
 * 2. SETUP CLIENTS / CONSTANTS
 *************************************************/

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PRICE_PER_ITEM = 4; // AED

/*************************************************
 * 3. HELPER FUNCTIONS
 *************************************************/

// Simple email regex
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/*************************************************
 * 4. NAVIGATION (SWITCH PAGES)
 *************************************************/

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-target");
    if (!targetId) return;
    document.querySelectorAll(".page-section").forEach(sec => {
      sec.classList.toggle("active", sec.id === targetId);
    });
  });
});

// Any “Order now” button
document.querySelectorAll("button[data-target='order-section']").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".page-section").forEach(sec => {
      sec.classList.toggle("active", sec.id === "order-section");
    });
  });
});

/*************************************************
 * 5. PRICE + PROMO CODE LOGIC
 *************************************************/

const qtyInput = document.getElementById("item-quantity");
const totalPriceText = document.getElementById("total-price");
const promoInput = document.getElementById("promo-code");
const promoMessage = document.getElementById("promo-message");

let appliedPromo = null;

function updateTotal() {
  const qty = Math.min(Math.max(parseInt(qtyInput.value || "1", 10), 1), 10);
  qtyInput.value = qty;
  let baseTotal = qty * PRICE_PER_ITEM;
  let discount = 0;

  if (appliedPromo) {
    if (appliedPromo.discount_type === "percent") {
      discount = (baseTotal * appliedPromo.discount_value) / 100;
    } else if (appliedPromo.discount_type === "fixed") {
      discount = appliedPromo.discount_value;
    }
    if (discount > baseTotal) discount = baseTotal;
  }

  const finalTotal = baseTotal - discount;
  totalPriceText.textContent = `Total: ${finalTotal.toFixed(2)} AED`;
  return { qty, baseTotal, discount, finalTotal };
}

qtyInput.addEventListener("input", updateTotal);

// Apply promo code (reads from Supabase table promo_codes)
document.getElementById("apply-promo-btn").addEventListener("click", async () => {
  const code = promoInput.value.trim();
  appliedPromo = null;
  promoMessage.textContent = "";

  if (!code) {
    promoMessage.textContent = "No promo code entered.";
    return;
  }

  const { data, error } = await supabaseClient
    .from("promo_codes")
    .select("*")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    promoMessage.textContent = "Promo code not valid.";
  } else {
    appliedPromo = data;
    promoMessage.textContent = `Promo applied: ${data.description} (${data.discount_type} ${data.discount_value})`;
    updateTotal();
  }
});

/*************************************************
 * 6. FILE UPLOAD TO SUPABASE STORAGE
 *************************************************/

async function uploadPhoto(file, folder) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${fileExt}`;

  const { data, error } = await supabaseClient
    .storage
    .from("order-photos") // bucket name
    .upload(fileName, file);

  if (error) throw error;
  return data.path; // stored path
}

/*************************************************
 * 7. FORM SUBMIT + SAVE ORDER + SEND EMAILS
 *************************************************/

const orderForm = document.getElementById("order-form");
const formError = document.getElementById("form-error");

orderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";

  const name = document.getElementById("customer-name").value.trim();
  const email = document.getElementById("customer-email").value.trim();
  const phone = document.getElementById("customer-phone").value.trim();
  const frontFile = document.getElementById("front-photo").files[0];
  const backFile = document.getElementById("back-photo").files[0];

  if (!name) {
    formError.textContent = "Please enter your name.";
    return;
  }
  if (!isValidEmail(email)) {
    formError.textContent = "Please enter a valid email.";
    return;
  }
  if (!frontFile || !backFile) {
    formError.textContent = "Please upload both front and back photos.";
    return;
  }

  const { qty, baseTotal, discount, finalTotal } = updateTotal();
  const promoCode = appliedPromo ? appliedPromo.code : null;

  try {
    // 1) Upload images
    const frontPath = await uploadPhoto(frontFile, "front");
    const backPath = await uploadPhoto(backFile, "back");

    // 2) Insert order in Supabase
    const orderPayload = {
      customer_name: name,      // make sure this column exists in your orders table
      customer_email: email,
      phone: phone || null,
      items: [{ quantity: qty, unit_price: PRICE_PER_ITEM }],
      promo_code: promoCode,
      discount_amount: discount,
      total_price_aed: finalTotal,
      front_photo_path: frontPath,
      back_photo_path: backPath
    };

    const { data, error } = await supabaseClient
      .from("orders")
      .insert(orderPayload)
      .select()
      .single();

    if (error) throw error;

    // 3) Send emails via EmailJS
    await sendEmailsWithEmailJS(data);

    // 4) Show receipt
    showReceiptModal(data);

  } catch (err) {
    console.error(err);
    formError.textContent = "Something went wrong. Please try again.";
  }
});

/*************************************************
 * 8. EMAILJS – SEND CUSTOMER + ADMIN EMAILS
 *************************************************/

async function sendEmailsWithEmailJS(order) {
  const qty = order.items && order.items[0] ? order.items[0].quantity : "?";

  // Customer email
  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CUSTOMER, {
    to_name: order.customer_name,
    order_id: order.id,
    quantity: qty,
    total_price: order.total_price_aed.toFixed(2)
  });

  // Admin email
  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ADMIN, {
    order_id: order.id,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_phone: order.phone || "-",
    quantity: qty,
    total_price: order.total_price_aed.toFixed(2),
    promo_code: order.promo_code || "-"
  });
}

/*************************************************
 * 9. RECEIPT MODAL + PDF DOWNLOAD
 *************************************************/

const receiptModal = document.getElementById("receipt-modal");
const closeReceiptBtn = document.getElementById("close-receipt");
const downloadPdfBtn = document.getElementById("download-pdf-btn");

function showReceiptModal(order) {
  document.getElementById("receipt-order-id").textContent = order.id;
  document.getElementById("receipt-name").textContent = order.customer_name;
  document.getElementById("receipt-email").textContent = order.customer_email;
  document.getElementById("receipt-phone").textContent = order.phone || "-";

  const qty = order.items && order.items[0] ? order.items[0].quantity : "?";
  document.getElementById("receipt-quantity").textContent = qty;
  document.getElementById("receipt-promo").textContent = order.promo_code || "-";
  document.getElementById("receipt-discount").textContent = (order.discount_amount || 0).toFixed(2);
  document.getElementById("receipt-total").textContent = order.total_price_aed.toFixed(2);

  receiptModal.classList.remove("hidden");
}

closeReceiptBtn.addEventListener("click", () => {
  receiptModal.classList.add("hidden");
});

// jsPDF is loaded via CDN in index.html (window.jspdf)
downloadPdfBtn.addEventListener("click", () => {
  if (!window.jspdf) {
    alert("PDF library still loading, please try again.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const orderId = document.getElementById("receipt-order-id").textContent;
  const name = document.getElementById("receipt-name").textContent;
  const email = document.getElementById("receipt-email").textContent;
  const phone = document.getElementById("receipt-phone").textContent;
  const qty = document.getElementById("receipt-quantity").textContent;
  const promo = document.getElementById("receipt-promo").textContent;
  const discount = document.getElementById("receipt-discount").textContent;
  const total = document.getElementById("receipt-total").textContent;

  let y = 20;
  doc.setFontSize(16);
  doc.text("Order receipt", 20, y);
  y += 10;
  doc.setFontSize(
