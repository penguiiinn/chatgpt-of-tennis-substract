const express = require("express");
const router = express.Router();
const h2hController = require("../controllers/h2hController");

router.get("/", h2hController.getComparison);

module.exports = router;
