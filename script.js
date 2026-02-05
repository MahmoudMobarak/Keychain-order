// Replace with your project values
const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PRICE_PER_ITEM = 4; // AED

// Simple email regex
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Switch between Product and Order sections
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-target");
    document.querySelectorAll(".page-section").forEach(sec => {
      sec.classList.toggle("active", sec.id === targetId);
    });
  });
});

// "Order now" button in product section
document.querySelectorAll("button[data-target='order-section']").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".page-section").forEach(sec => {
      sec.classList.toggle("active", sec.id === "order-section");
    });
  });
});

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

// Apply promo
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

// Upload file to Supabase Storage
async function uploadPhoto(file, folder) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const { data, error } = await supabaseClient
    .storage
    .from("order-photos")
    .upload(fileName, file);

  if (error) {
    throw error;
  }
  return data.path; // store the path in DB
}

// Handle order form
const orderForm = document.getElementById("order-form");
const formError = document.getElementById("form-error");

orderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";

  const email = document.getElementById("customer-email").value.trim();
  const phone = document.getElementById("customer-phone").value.trim();
  const frontFile = document.getElementById("front-photo").files[0];
  const backFile = document.getElementById("back-photo").files[0];

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
    // upload images
    const frontPath = await uploadPhoto(frontFile, "front");
    const backPath = await uploadPhoto(backFile, "back");

    // create order row
    const orderPayload = {
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

    // Show receipt modal
    showReceiptModal(data);

    // Call a serverless function URL to send emails
    // Replace with your own serverless endpoint if you create one.
    // await fetch("https://YOUR-FUNCTION-URL/send-order-emails", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ order: data })
    // });

  } catch (err) {
    console.error(err);
    formError.textContent = "Something went wrong. Please try again.";
  }
});

// Receipt modal logic
const receiptModal = document.getElementById("receipt-modal");
const closeReceiptBtn = document.getElementById("close-receipt");
const downloadPdfBtn = document.getElementById("download-pdf-btn");

function showReceiptModal(order) {
  document.getElementById("receipt-order-id").textContent = order.id;
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

// Load jsPDF from CDN for PDF export
const jsPdfScript = document.createElement("script");
jsPdfScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
document.head.appendChild(jsPdfScript);

downloadPdfBtn.addEventListener("click", () => {
  if (!window.jspdf) {
    alert("PDF library still loading, please try again.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const orderId = document.getElementById("receipt-order-id").textContent;
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
  doc.setFontSize(12);
  doc.text(`Order number: ${orderId}`, 20, y); y += 8;
  doc.text(`Email: ${email}`, 20, y); y += 8;
  doc.text(`Phone: ${phone}`, 20, y); y += 8;
  doc.text(`Quantity: ${qty}`, 20, y); y += 8;
  doc.text(`Promo code: ${promo}`, 20, y); y += 8;
  doc.text(`Discount: ${discount} AED`, 20, y); y += 8;
  doc.text(`Total: ${total} AED`, 20, y); y += 8;

  doc.save(`order-${orderId}.pdf`);
});
