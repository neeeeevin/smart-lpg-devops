const express = require("express");
const router = express.Router();
const LPG = require("../models/LPG");
const calculateSummary = require("../utils/prediction");

function createBookingReference() {
  return `LPG-${Date.now().toString().slice(-6)}`;
}

router.post("/initialize-user", async (req, res) => {
  try {
    const { userId, householdName, cylinderCapacity } = req.body;

    if (!userId || typeof userId !== "string" || !userId.trim()) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    const normalizedUserId = userId.trim();

    let profile = await LPG.findOne({ userId: normalizedUserId });

    if (profile) {
      return res.json({
        message: "User already exists",
        profile
      });
    }

    profile = new LPG({
      userId: normalizedUserId,
      householdName: householdName?.trim() || normalizedUserId,
      cylinderCapacity: Number(cylinderCapacity) || 14.2,
      lastRefillDate: new Date(),
      usageLogs: [],
      refillHistory: [],
      currentStatus: "active",
      lowGasThreshold: 2
    });

    await profile.save();

    res.status(201).json({
      message: "User initialized successfully",
      profile
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to initialize user", error: error.message });
  }
});

router.post("/add-usage", async (req, res) => {
  try {
    const { userId, amountUsed, note, date } = req.body;

    if (!userId || typeof userId !== "string" || !userId.trim()) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    const usageValue = Number(amountUsed);

    if (!Number.isFinite(usageValue) || usageValue <= 0) {
      return res.status(400).json({ message: "amountUsed must be a positive number" });
    }

    const profile = await LPG.findOne({ userId: userId.trim() });

    if (!profile) {
      return res.status(404).json({ message: "User not found. Initialize user first." });
    }

    profile.usageLogs.push({
      date: date ? new Date(date) : new Date(),
      amountUsed: usageValue,
      note: note || "",
      source: "manual"
    });

    await profile.save();

    const summary = calculateSummary(profile);

    await LPG.updateOne(
      { _id: profile._id },
      { $set: { currentStatus: summary.currentStatus } }
    );

    res.json({
      message: "Usage added successfully",
      summary
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add usage", error: error.message });
  }
});

router.post("/book-refill", async (req, res) => {
  try {
    const { userId, vendor } = req.body;

    if (!userId || typeof userId !== "string" || !userId.trim()) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    const profile = await LPG.findOne({ userId: userId.trim() });

    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }

    const alreadyBooked = [...profile.refillHistory]
      .reverse()
      .find((item) => item.status === "booked");

    if (alreadyBooked) {
      return res.status(400).json({
        message: "A refill is already booked and not yet delivered"
      });
    }

    profile.refillHistory.push({
      bookingDate: new Date(),
      status: "booked",
      vendor: vendor?.trim() || "Demo Gas Agency",
      bookingReference: createBookingReference()
    });

    profile.currentStatus = "booked";

    await profile.save();

    res.json({
      message: "Refill booked successfully",
      refillHistory: profile.refillHistory
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to book refill", error: error.message });
  }
});

router.post("/confirm-refill", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId || typeof userId !== "string" || !userId.trim()) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    const profile = await LPG.findOne({ userId: userId.trim() });

    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }

    const bookedIndex = [...profile.refillHistory]
      .map((item, index) => ({ item, index }))
      .reverse()
      .find(({ item }) => item.status === "booked");

    if (!bookedIndex) {
      return res.status(400).json({ message: "No booked refill found to confirm" });
    }

    profile.refillHistory[bookedIndex.index].status = "delivered";
    profile.refillHistory[bookedIndex.index].deliveryDate = new Date();

    profile.lastRefillDate = new Date();
    profile.usageLogs = [];
    profile.currentStatus = "active";

    await profile.save();

    const summary = calculateSummary(profile);

    res.json({
      message: "Refill confirmed and cycle reset successfully",
      summary,
      refillHistory: profile.refillHistory
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to confirm refill", error: error.message });
  }
});

router.get("/summary/:userId", async (req, res) => {
  try {
    const profile = await LPG.findOne({ userId: req.params.userId.trim() });

    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }

    const summary = calculateSummary(profile);

    if (profile.currentStatus !== summary.currentStatus) {
      profile.currentStatus = summary.currentStatus;
      await profile.save();
    }

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: "Failed to get summary", error: error.message });
  }
});

router.get("/prediction/:userId", async (req, res) => {
  try {
    const profile = await LPG.findOne({ userId: req.params.userId.trim() });

    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }

    const summary = calculateSummary(profile);

    res.json({
      avgDailyConsumption: summary.avgDailyConsumption,
      remainingGas: summary.remainingGas,
      predictedDaysLeft: summary.predictedDaysLeft,
      predictedRefillDate: summary.predictedRefillDate,
      currentStatus: summary.currentStatus,
      alerts: summary.alerts,
      insights: summary.insights
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to get prediction", error: error.message });
  }
});

router.get("/history/:userId", async (req, res) => {
  try {
    const profile = await LPG.findOne({ userId: req.params.userId.trim() });

    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }

    const usageLogs = [...profile.usageLogs]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((log) => ({
        id: log._id,
        date: log.date,
        amountUsed: log.amountUsed,
        note: log.note,
        source: log.source
      }));

    const refillHistory = [...profile.refillHistory]
      .sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate))
      .map((refill) => ({
        id: refill._id,
        bookingDate: refill.bookingDate,
        deliveryDate: refill.deliveryDate,
        status: refill.status,
        vendor: refill.vendor,
        bookingReference: refill.bookingReference
      }));

    res.json({
      usageLogs,
      refillHistory
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to get history", error: error.message });
  }
});

router.get("/health", async (_req, res) => {
  res.json({
    status: "ok",
    service: "smart-lpg-backend",
    time: new Date().toISOString()
  });
});

module.exports = router;