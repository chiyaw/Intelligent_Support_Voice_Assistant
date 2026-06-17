const express = require("express");
const cors = require("cors");
const supportRoutes = require("./routes/support");
const constants = require("./config/constants");

const app = express();

app.use(cors({
  origin: constants.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use("/api", supportRoutes);

app.listen(constants.PORT, () => {
  console.log(`🚀 Server running seamlessly on port ${constants.PORT}`);
});