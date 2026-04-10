const mongoose = require("mongoose");

const usageSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now
    },
    amountUsed: {
      type: Number,
      required: true,
      min: 0
    },
    source: {
      type: String,
      default: "manual"
    },
    note: {
      type: String,
      default: ""
    }
  },
  { _id: true }
);

const refillSchema = new mongoose.Schema(
  {
    bookingDate: {
      type: Date
    },
    deliveryDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ["booked", "delivered", "cancelled"],
      default: "booked"
    },
    vendor: {
      type: String,
      default: "Demo Gas Agency"
    },
    bookingReference: {
      type: String,
      default: ""
    }
  },
  { _id: true }
);

const lpgSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    householdName: {
      type: String,
      default: ""
    },
    cylinderCapacity: {
      type: Number,
      required: true,
      default: 14.2,
      min: 1
    },
    lastRefillDate: {
      type: Date,
      default: Date.now
    },
    usageLogs: {
      type: [usageSchema],
      default: []
    },
    refillHistory: {
      type: [refillSchema],
      default: []
    },
    currentStatus: {
      type: String,
      enum: ["active", "low", "critical", "booked", "empty"],
      default: "active"
    },
    lowGasThreshold: {
      type: Number,
      default: 2
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("LPG", lpgSchema);