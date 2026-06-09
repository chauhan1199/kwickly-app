const mongoose = require("mongoose");
mongoose.connect("mongodb://127.0.0.1:27017/kwickly").then(async () => {
  const Customer = mongoose.model("Customer", new mongoose.Schema({}, {strict: false, collection: "customers"}));
  const date = new Date();
  date.setDate(date.getDate() + 30);
  await Customer.updateOne({ phone: "9274344111" }, { $set: { "subscription.planId": "monthly", "subscription.expiryDate": date, "subscription.isTrial": false } });
  console.log("Updated user plan to monthly!");
  process.exit(0);
});
