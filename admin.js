const SUPABASE_URL = "https://pkzvftleoysldqmjdgds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginSection = document.getElementById("admin-login-section");
const ordersSection = document.getElementById("admin-orders-section");
const loginForm = document.getElementById("admin-login-form");
const loginError = document.getElementById("admin-login-error");
const ordersList = document.getElementById("orders-list");

const ADMIN_PASSWORD_HASH = window.ADMIN_PASSWORD_HASH || "CHANGE_ME";

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
}

async function downloadFile(path) {
  const { data, error } = await supabaseClient.storage.from("order-photos").download(path);
  if (error) {
    alert("Download failed");
    console.error(error);
    return;
  }

  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = path.split("/").pop();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function loadOrders() {
  ordersList.textContent = "Loading...";
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    ordersList.textContent = "Error loading orders.";
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    ordersList.textContent = "No orders yet.";
    return;
  }

  ordersList.innerHTML = "";
  for (const order of data) {
    const quantity = order.items?.[0]?.quantity ?? "?";
    const card = document.createElement("article");
    card.className = "order-card";
    card.innerHTML = `
      <h3>Order #${order.id}</h3>
      <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
      <p><strong>Email:</strong> ${order.customer_email}</p>
      <p><strong>Phone:</strong> ${order.phone || "-"}</p>
      <p><strong>Qty:</strong> ${quantity}</p>
      <p><strong>Promo:</strong> ${order.promo_code || "-"}</p>
      <p><strong>Discount:</strong> ${Number(order.discount_amount || 0).toFixed(2)} AED</p>
      <p><strong>Total:</strong> ${Number(order.total_price_aed || 0).toFixed(2)} AED</p>
    `;

    const actionWrap = document.createElement("div");
    actionWrap.className = "order-actions";

    const frontBtn = document.createElement("button");
    frontBtn.className = "secondary-btn";
    frontBtn.textContent = "Download front";
    frontBtn.addEventListener("click", () => downloadFile(order.front_photo_path));

    const backBtn = document.createElement("button");
    backBtn.className = "secondary-btn";
    backBtn.textContent = "Download back";
    backBtn.addEventListener("click", () => downloadFile(order.back_photo_path));

    actionWrap.append(frontBtn, backBtn);
    card.appendChild(actionWrap);
    ordersList.appendChild(card);
  }
}

function showOrders() {
  loginSection.classList.add("hidden");
  ordersSection.classList.remove("hidden");
  localStorage.setItem("admin-logged-in", ADMIN_PASSWORD_HASH);
  loadOrders().catch(console.error);
}

const storedToken = localStorage.getItem("admin-logged-in");
if (storedToken === ADMIN_PASSWORD_HASH && ADMIN_PASSWORD_HASH !== "CHANGE_ME") {
  showOrders();
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const password = document.getElementById("admin-password").value;

  if (ADMIN_PASSWORD_HASH === "CHANGE_ME") {
    loginError.textContent = "Set ADMIN_PASSWORD_HASH in admin-config.js first.";
    return;
  }

  if (simpleHash(password) === ADMIN_PASSWORD_HASH) {
    loginError.textContent = "";
    showOrders();
  } else {
    loginError.textContent = "Incorrect password.";
  }
});

document.getElementById("refresh-orders").addEventListener("click", () => {
  loadOrders().catch(console.error);
});
