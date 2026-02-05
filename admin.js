// Replace with your project values (same as script.js)
const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// In a real app, admin auth would use Supabase Auth or server; here we use a simple password check.
const ADMIN_PASSWORD_HASH = "CHANGE_THIS_SIMPLE_HASH";

// VERY simple hash (not secure, only for demo)
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h.toString();
}

const loginSection = document.getElementById("admin-login-section");
const ordersSection = document.getElementById("admin-orders-section");
const loginForm = document.getElementById("admin-login-form");
const loginError = document.getElementById("admin-login-error");
const ordersList = document.getElementById("orders-list");

// Check localStorage
const storedToken = localStorage.getItem("admin-logged-in");
if (storedToken === ADMIN_PASSWORD_HASH) {
  showOrders();
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const pwd = document.getElementById("admin-password").value;
  if (simpleHash(pwd) === ADMIN_PASSWORD_HASH) {
    localStorage.setItem("admin-logged-in", ADMIN_PASSWORD_HASH);
    showOrders();
  } else {
    loginError.textContent = "Incorrect password.";
  }
});

async function showOrders() {
  loginSection.classList.add("hidden");
  ordersSection.classList.remove("hidden");
  await loadOrders();
}

async function loadOrders() {
  ordersList.innerHTML = "Loading...";

  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    ordersList.textContent = "Error loading orders.";
    return;
  }

  if (!data || data.length === 0) {
    ordersList.textContent = "No orders yet.";
    return;
  }

  ordersList.innerHTML = "";
  data.forEach(order => {
    const card = document.createElement("div");
    card.className = "order-card";

    const meta = document.createElement("div");
    meta.className = "order-meta";
    meta.innerHTML = `
      <span>#${order.id}</span>
      <span>${new Date(order.created_at).toLocaleString()}</span>
    `;

    const body = document.createElement("div");
    const qty = order.items && order.items[0] ? order.items[0].quantity : "?";

    body.innerHTML = `
      <p><strong>Email:</strong> ${order.customer_email}</p>
      <p><strong>Phone:</strong> ${order.phone || "-"}</p>
      <p><strong>Quantity:</strong> ${qty}</p>
      <p><strong>Promo:</strong> ${order.promo_code || "-"}</p>
      <p><strong>Discount:</strong> ${order.discount_amount.toFixed(2)} AED</p>
      <p><strong>Total:</strong> ${order.total_price_aed.toFixed(2)} AED</p>
    `;

    const actions = document.createElement("div");
    actions.className = "order-actions";

    const frontBtn = document.createElement("button");
    frontBtn.className = "secondary-btn";
    frontBtn.textContent = "Download front photo";
    frontBtn.addEventListener("click", () => downloadFile(order.front_photo_path));

    const backBtn = document.createElement("button");
    backBtn.className = "secondary-btn";
    backBtn.textContent = "Download back photo";
    backBtn.addEventListener("click", () => downloadFile(order.back_photo_path));

    actions.appendChild(frontBtn);
    actions.appendChild(backBtn);

    card.appendChild(meta);
    card.appendChild(body);
    card.appendChild(actions);
    ordersList.appendChild(card);
  });
}

// Download from storage
async function downloadFile(path) {
  const { data, error } = await supabaseClient
    .storage
    .from("order-photos")
    .download(path);

  if (error) {
    console.error(error);
    alert("Could not download file.");
    return;
  }

  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = path.split("/").pop();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
