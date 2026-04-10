const API_BASE_URL = "https://smart-lpg-devops.onrender.com";
fetch(`${API_BASE_URL}/api/whatever`)
let usageChartInstance = null;

function getUserId() {
  return document.getElementById("userId").value.trim();
}

function showMessage(message, type = "info") {
  const box = document.getElementById("messageBox");
  box.classList.remove("hidden", "bg-red-100", "text-red-700", "bg-green-100", "text-green-700", "bg-blue-100", "text-blue-700", "bg-yellow-100", "text-yellow-800");

  if (type === "error") {
    box.classList.add("bg-red-100", "text-red-700");
  } else if (type === "success") {
    box.classList.add("bg-green-100", "text-green-700");
  } else if (type === "warn") {
    box.classList.add("bg-yellow-100", "text-yellow-800");
  } else {
    box.classList.add("bg-blue-100", "text-blue-700");
  }

  box.textContent = message;
  box.classList.remove("hidden");
}

function clearMessage() {
  const box = document.getElementById("messageBox");
  box.classList.add("hidden");
  box.textContent = "";
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("en-IN");
}

function formatShortDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toDateString();
}

async function handleResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

async function initializeUser() {
  try {
    clearMessage();

    const userId = getUserId();
    const householdName = document.getElementById("householdName").value.trim();
    const cylinderCapacity = Number(document.getElementById("cylinderCapacity").value);

    if (!userId) {
      showMessage("Enter a valid user ID first.", "error");
      return;
    }

    const response = await fetch(`${API}/initialize-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId,
        householdName,
        cylinderCapacity
      })
    });

    const data = await handleResponse(response);
    showMessage(data.message, "success");
    await loadDashboard();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function addUsage() {
  try {
    clearMessage();

    const userId = getUserId();
    const amountUsed = Number(document.getElementById("usageAmount").value);
    const note = document.getElementById("usageNote").value.trim();

    if (!userId) {
      showMessage("User ID is required.", "error");
      return;
    }

    if (!Number.isFinite(amountUsed) || amountUsed <= 0) {
      showMessage("Usage amount must be greater than 0.", "error");
      return;
    }

    const response = await fetch(`${API}/add-usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId,
        amountUsed,
        note
      })
    });

    const data = await handleResponse(response);
    document.getElementById("usageAmount").value = "";
    document.getElementById("usageNote").value = "";
    showMessage(data.message, "success");
    await loadDashboard();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function bookRefill() {
  try {
    clearMessage();

    const userId = getUserId();
    const vendor = document.getElementById("vendorName").value.trim();

    if (!userId) {
      showMessage("User ID is required.", "error");
      return;
    }

    const response = await fetch(`${API}/book-refill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId,
        vendor
      })
    });

    const data = await handleResponse(response);
    showMessage(data.message, "success");
    await loadDashboard();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function confirmRefill() {
  try {
    clearMessage();

    const userId = getUserId();

    if (!userId) {
      showMessage("User ID is required.", "error");
      return;
    }

    const response = await fetch(`${API}/confirm-refill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId
      })
    });

    const data = await handleResponse(response);
    showMessage(data.message, "success");
    await loadDashboard();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function updateAlertBanner(summary) {
  const banner = document.getElementById("alertBanner");
  banner.classList.add("hidden");
  banner.className = "hidden rounded-2xl px-5 py-4 font-medium";

  if (summary.alerts.empty) {
    banner.classList.remove("hidden");
    banner.classList.add("bg-red-100", "text-red-700");
    banner.textContent = "Gas level is effectively empty. Immediate refill is required.";
    return;
  }

  if (summary.alerts.critical) {
    banner.classList.remove("hidden");
    banner.classList.add("bg-orange-100", "text-orange-700");
    banner.textContent = "Critical gas level detected. Delivery should be arranged urgently.";
    return;
  }

  if (summary.alerts.lowGas) {
    banner.classList.remove("hidden");
    banner.classList.add("bg-yellow-100", "text-yellow-800");
    banner.textContent = "Low gas alert. Refill should be booked soon.";
    return;
  }

  if (summary.currentStatus === "booked") {
    banner.classList.remove("hidden");
    banner.classList.add("bg-blue-100", "text-blue-700");
    banner.textContent = "A refill has been booked and is awaiting delivery.";
  }
}

function updateCards(summary) {
  document.getElementById("remainingGasCard").textContent = `${summary.remainingGas} kg`;
  document.getElementById("avgUsageCard").textContent = `${summary.avgDailyConsumption} kg/day`;
  document.getElementById("refillDateCard").textContent = summary.predictedRefillDate
    ? formatShortDate(summary.predictedRefillDate)
    : "Not enough data";
  document.getElementById("statusCard").textContent = summary.currentStatus.toUpperCase();
  document.getElementById("monthlyUsageCard").textContent = `${summary.monthlyUsage} kg`;
  document.getElementById("efficiencyCard").textContent = `${summary.efficiencyScore}/100`;

  document.getElementById("userInfoUserId").textContent = summary.userId || "-";
  document.getElementById("userInfoHousehold").textContent = summary.householdName || "-";
  document.getElementById("userInfoCapacity").textContent = `${summary.cylinderCapacity} kg`;
  document.getElementById("userInfoDays").textContent = summary.daysSinceLastRefill ?? "-";
  document.getElementById("userInfoUsage").textContent = `${summary.totalUsageCurrentCycle} kg`;
  document.getElementById("userInfoProjected").textContent = `${summary.projectedMonthlyUsage} kg`;
}

function updateInsights(summary) {
  const insightsList = document.getElementById("insightsList");
  insightsList.innerHTML = "";

  (summary.insights || []).forEach((item) => {
    const li = document.createElement("li");
    li.className = "bg-slate-50 rounded-xl px-3 py-2";
    li.textContent = item;
    insightsList.appendChild(li);
  });
}

function updateUsageChart(summary) {
  const labels = (summary.usageTrend || []).map((item) => item.date);
  const values = (summary.usageTrend || []).map((item) => item.amountUsed);

  const ctx = document.getElementById("usageChart").getContext("2d");

  if (usageChartInstance) {
    usageChartInstance.destroy();
  }

  usageChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Usage (kg)",
          data: values,
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function renderUsageHistory(history) {
  const body = document.getElementById("usageHistoryBody");
  body.innerHTML = "";

  if (!history.length) {
    body.innerHTML = `
      <tr>
        <td colspan="4" class="py-4 text-slate-500">No usage history available.</td>
      </tr>
    `;
    return;
  }

  history.forEach((item) => {
    const row = document.createElement("tr");
    row.className = "border-b last:border-0";
    row.innerHTML = `
      <td class="py-3 pr-4">${formatDate(item.date)}</td>
      <td class="py-3 pr-4">${item.amountUsed} kg</td>
      <td class="py-3 pr-4">${item.note || "-"}</td>
      <td class="py-3 pr-4">${item.source || "-"}</td>
    `;
    body.appendChild(row);
  });
}

function renderRefillHistory(history) {
  const body = document.getElementById("refillHistoryBody");
  body.innerHTML = "";

  if (!history.length) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="py-4 text-slate-500">No refill history available.</td>
      </tr>
    `;
    return;
  }

  history.forEach((item) => {
    const row = document.createElement("tr");
    row.className = "border-b last:border-0";
    row.innerHTML = `
      <td class="py-3 pr-4">${item.bookingReference || "-"}</td>
      <td class="py-3 pr-4">${item.vendor || "-"}</td>
      <td class="py-3 pr-4">${formatDate(item.bookingDate)}</td>
      <td class="py-3 pr-4">${formatDate(item.deliveryDate)}</td>
      <td class="py-3 pr-4">${item.status}</td>
    `;
    body.appendChild(row);
  });
}

async function loadDashboard() {
  try {
    clearMessage();

    const userId = getUserId();

    if (!userId) {
      showMessage("Enter user ID to load dashboard.", "warn");
      return;
    }

    const [summaryResponse, historyResponse] = await Promise.all([
      fetch(`${API}/summary/${userId}`),
      fetch(`${API}/history/${userId}`)
    ]);

    const summary = await handleResponse(summaryResponse);
    const history = await handleResponse(historyResponse);

    updateCards(summary);
    updateAlertBanner(summary);
    updateInsights(summary);
    updateUsageChart(summary);
    renderUsageHistory(history.usageLogs || []);
    renderRefillHistory(history.refillHistory || []);

    showMessage("Dashboard loaded successfully.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

window.onload = () => {
  document.getElementById("userId").value = "user1";
};
