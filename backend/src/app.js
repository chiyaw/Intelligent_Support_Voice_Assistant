const express = require("express");
const cors = require("cors");
const supportRoutes = require("./routes/support");
const constants = require("./config/constants");

const app = express();

app.use(cors());

app.use(express.json());
app.use("/api", supportRoutes);

app.listen(constants.PORT, () => {
  console.log(`🚀 Server running seamlessly on port ${constants.PORT}`);
});