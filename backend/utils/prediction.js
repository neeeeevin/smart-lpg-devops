function round(value, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

function formatDateISO(date) {
  if (!date) return null;
  return new Date(date).toISOString();
}

function getCurrentCycleUsageLogs(data) {
  const refillDate = new Date(data.lastRefillDate);
  return (data.usageLogs || []).filter((log) => new Date(log.date) >= refillDate);
}

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function calculateSummary(data) {
  if (!data) {
    throw new Error("No LPG profile found");
  }

  const now = new Date();
  const refillDate = new Date(data.lastRefillDate);
  const currentCycleLogs = getCurrentCycleUsageLogs(data).sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const totalUsageCurrentCycle = currentCycleLogs.reduce(
    (sum, log) => sum + Number(log.amountUsed || 0),
    0
  );

  const daysSinceLastRefill = Math.max(
    1,
    Math.ceil((now - refillDate) / (1000 * 60 * 60 * 24))
  );

  const avgDailyConsumption = totalUsageCurrentCycle / daysSinceLastRefill;
  const remainingGas = Math.max(0, data.cylinderCapacity - totalUsageCurrentCycle);

  let predictedDaysLeft = null;
  let predictedRefillDate = null;

  if (avgDailyConsumption > 0) {
    predictedDaysLeft = Math.floor(remainingGas / avgDailyConsumption);
    predictedRefillDate = new Date(now);
    predictedRefillDate.setDate(predictedRefillDate.getDate() + predictedDaysLeft);
  }

  const lowThreshold = Number(data.lowGasThreshold || 2);

  let status = "active";
  if (remainingGas <= 0.3) {
    status = "empty";
  } else if (remainingGas <= 1) {
    status = "critical";
  } else if (remainingGas <= lowThreshold) {
    status = "low";
  }

  const latestBooked = [...(data.refillHistory || [])]
    .reverse()
    .find((item) => item.status === "booked");

  if (latestBooked && status !== "empty") {
    status = "booked";
  }

  const { start, end } = getMonthRange(now);
  const monthlyUsageLogs = (data.usageLogs || []).filter((log) => {
    const d = new Date(log.date);
    return d >= start && d <= end;
  });

  const monthlyUsage = monthlyUsageLogs.reduce(
    (sum, log) => sum + Number(log.amountUsed || 0),
    0
  );

  const projectedMonthlyUsage =
    avgDailyConsumption > 0
      ? avgDailyConsumption * new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      : 0;

  const usageTrend = [...currentCycleLogs]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-10)
    .map((log) => ({
      date: new Date(log.date).toLocaleDateString("en-IN"),
      amountUsed: round(Number(log.amountUsed || 0))
    }));

  let efficiencyScore = 100;
  if (avgDailyConsumption > 0.8) efficiencyScore = 45;
  else if (avgDailyConsumption > 0.6) efficiencyScore = 60;
  else if (avgDailyConsumption > 0.4) efficiencyScore = 75;
  else if (avgDailyConsumption > 0.25) efficiencyScore = 88;

  const insights = [];

  if (currentCycleLogs.length === 0) {
    insights.push("No usage logs found yet. Add LPG usage to start prediction analytics.");
  } else {
    insights.push(
      `Average consumption is ${round(avgDailyConsumption)} kg/day over the current refill cycle.`
    );

    if (predictedRefillDate) {
      insights.push(
        `At the current burn rate, the next refill is expected around ${new Date(
          predictedRefillDate
        ).toDateString()}.`
      );
    }

    if (remainingGas <= lowThreshold && remainingGas > 0.3) {
      insights.push("Low gas detected. A refill should be booked soon.");
    }

    if (remainingGas <= 1) {
      insights.push("Critical level reached. This household may run out of gas very soon.");
    }

    if (projectedMonthlyUsage > data.cylinderCapacity) {
      insights.push(
        "Projected monthly usage exceeds the cylinder capacity, which indicates frequent refills may be needed."
      );
    }

    if (latestBooked) {
      insights.push("A refill has already been booked and is waiting for delivery confirmation.");
    }
  }

  return {
    userId: data.userId,
    householdName: data.householdName,
    cylinderCapacity: round(data.cylinderCapacity),
    daysSinceLastRefill,
    totalUsageCurrentCycle: round(totalUsageCurrentCycle),
    avgDailyConsumption: round(avgDailyConsumption),
    remainingGas: round(remainingGas),
    predictedDaysLeft,
    predictedRefillDate: formatDateISO(predictedRefillDate),
    monthlyUsage: round(monthlyUsage),
    projectedMonthlyUsage: round(projectedMonthlyUsage),
    lowGasThreshold: round(lowThreshold),
    currentStatus: status,
    efficiencyScore,
    usageCount: currentCycleLogs.length,
    latestBooking:
      latestBooked
        ? {
            bookingDate: formatDateISO(latestBooked.bookingDate),
            vendor: latestBooked.vendor,
            bookingReference: latestBooked.bookingReference,
            status: latestBooked.status
          }
        : null,
    usageTrend,
    alerts: {
      lowGas: remainingGas <= lowThreshold && remainingGas > 0.3,
      critical: remainingGas <= 1 && remainingGas > 0.3,
      empty: remainingGas <= 0.3
    },
    insights
  };
}

module.exports = calculateSummary;