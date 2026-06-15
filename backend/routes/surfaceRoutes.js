const express = require("express");
const router = express.Router();
const surfaceController = require("../controllers/surfaceController");

router.get("/:name", surfaceController.getSurfaceData);

module.exports = router;
