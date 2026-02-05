const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN";
const EMAILJS_PUBLIC_KEY = "wFE7Ll5cDKSxM4Zfs";
const EMAILJS_SERVICE_ID = "service_zlh57wd";
const EMAILJS_TEMPLATE_CUSTOMER = "template_hu5h00o";
const EMAILJS_TEMPLATE_ADMIN = "template_i0rlm7u";
const ADMIN_NOTIFY_EMAIL = "admin@example.com";
const PRICE_PER_ITEM = 4;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

const form = document.getElementById("order-form");
const qtyInput = document.getElementById("item-quantity");
const promoInput = document.getElementById("promo-code");
const promoMessage = document.getElementById("promo-message");
const formError = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");

const baseTotalEl = document.getElementById("base-total");
const discountTotalEl = document.getElementById("discount-total");
const totalPriceEl = document.getElementById("total-price");

let appliedPromo = null;

for (const trigger of document.querySelectorAll("[data-scroll]")) {
  trigger.addEventListener("click", () => {
    const target = document.getElementById(trigger.dataset.scroll);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function updateTotal() {
  const quantity = Math.min(Math.max(parseInt(qtyInput.value || "1", 10), 1), 10);
  qtyInput.value = quantity;

  const baseTotal = quantity * PRICE_PER_ITEM;
  let discount = 0;

  if (appliedPromo) {
    discount = appliedPromo.discount_type === "percent"
      ? (baseTotal * appliedPromo.discount_value) / 100
      : Number(appliedPromo.discount_value || 0);
    discount = Math.max(0, Math.min(discount, baseTotal));
  }

  const finalTotal = baseTotal - discount;
  baseTotalEl.textContent = `${baseTotal.toFixed(2)} AED`;
  discountTotalEl.textContent = `-${discount.toFixed(2)} AED`;
  totalPriceEl.textContent = `${finalTotal.toFixed(2)} AED`;

  return { quantity, baseTotal, discount, finalTotal };
}

qtyInput.addEventListener("input", updateTotal);

async function applyPromo() {
  const code = promoInput.value.trim();
  appliedPromo = null;
  promoMessage.textContent = "";

  if (!code) {
    promoMessage.textContent = "Enter a promo code.";
    promoMessage.className = "error";
    updateTotal();
    return;
  }

  const { data, error } = await supabaseClient
    .from("promo_codes")
    .select("code, description, discount_type, discount_value")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    promoMessage.textContent = "Invalid promo code.";
    promoMessage.className = "error";
    updateTotal();
    return;
  }

  appliedPromo = data;
  promoMessage.textContent = `Applied: ${data.description || data.code}`;
  promoMessage.className = "success";
  updateTotal();
}

document.getElementById("apply-promo-btn").addEventListener("click", () => {
  applyPromo().catch((error) => {
    console.error(error);
    promoMessage.textContent = "Could not validate promo code.";
    promoMessage.className = "error";
  });
});

async function uploadPhoto(file, folder) {
  const fileExt = file.name.split(".").pop();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const { data, error } = await supabaseClient.storage.from("order-photos").upload(path, file);
  if (error) throw error;
  return data.path;
}

async function sendEmails(order) {
  const quantity = order.items?.[0]?.quantity || 1;
  const total = Number(order.total_price_aed || 0).toFixed(2);

  await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CUSTOMER, {
    to_email: order.customer_email,
    order_id: order.id,
    quantity,
    total_price: `${total} AED`
  });

  await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ADMIN, {
    to_email: ADMIN_NOTIFY_EMAIL,
    order_id: order.id,
    customer_email: order.customer_email,
    customer_phone: order.phone || "-",
    quantity,
    total_price: `${total} AED`,
    promo_code: order.promo_code || "-"
  });
}

const modal = document.getElementById("receipt-modal");
const closeBtn = document.querySelector(".close-btn");

function showReceipt(order) {
  document.getElementById("receipt-order-id").textContent = order.id;
  document.getElementById("receipt-email").textContent = order.customer_email;
  document.getElementById("receipt-phone").textContent = order.phone || "-";
  document.getElementById("receipt-quantity").textContent = order.items?.[0]?.quantity || "1";
  document.getElementById("receipt-promo").textContent = order.promo_code || "-";
  document.getElementById("receipt-total").textContent = `${Number(order.total_price_aed || 0).toFixed(2)} AED`;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

closeBtn.addEventListener("click", () => {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  }
});

document.getElementById("download-pdf").addEventListener("click", () => {
  if (!window.jspdf) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const orderId = document.getElementById("receipt-order-id").textContent;
  const email = document.getElementById("receipt-email").textContent;
  const total = document.getElementById("receipt-total").textContent;

  doc.setFontSize(18);
  doc.text("Enterprise Keychain Receipt", 20, 20);
  doc.setFontSize(12);
  doc.text(`Order ID: ${orderId}`, 20, 35);
  doc.text(`Email: ${email}`, 20, 45);
  doc.text(`Total: ${total}`, 20, 55);
  doc.save(`receipt-${orderId}.pdf`);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";

  const email = document.getElementById("customer-email").value.trim();
  const phone = document.getElementById("customer-phone").value.trim();
  const frontPhoto = document.getElementById("front-photo").files[0];
  const backPhoto = document.getElementById("back-photo").files[0];

  if (!email || !frontPhoto || !backPhoto) {
    formError.textContent = "Please fill all required fields.";
    return;
  }

  const { quantity, discount, finalTotal } = updateTotal();

  submitBtn.disabled = true;
  submitBtn.textContent = "Processing...";

  try {
    const frontPath = await uploadPhoto(frontPhoto, "front");
    const backPath = await uploadPhoto(backPhoto, "back");

    const orderPayload = {
      customer_email: email,
      phone: phone || null,
      items: [{ quantity, unit_price: PRICE_PER_ITEM }],
      promo_code: appliedPromo?.code || null,
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

    try {
      await sendEmails(order);
    } catch (emailError) {
      console.error("Email send failed", emailError);
    }

    showReceipt(order);
    form.reset();
    appliedPromo = null;
    promoMessage.textContent = "";
    updateTotal();
  } catch (error) {
    console.error(error);
    formError.textContent = "Order failed. Check Supabase table/storage policies and EmailJS template fields.";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Place order";
  }
});

updateTotal();
