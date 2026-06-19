const express = require("express");
const cors = require("cors");
const supportRoutes = require("./routes/support");
const constants = require("./config/constants");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", supportRoutes);

app.get("/", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "API is running",
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({ 
    error: "Route not found",
    path: req.path 
  });
});

app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ 
    error: "Internal server error",
    message: err.message 
  });
});

module.exports = app;

if (process.env.NODE_ENV !== "production") {
  const PORT = constants.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}