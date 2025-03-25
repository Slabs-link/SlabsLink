"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const comuni_sqlite_controller_1 = require("../controllers/comuni-sqlite.controller");
const router = express_1.default.Router();
// GET all comuni
router.get('/', comuni_sqlite_controller_1.getAllComuni);
// Add a test endpoint
router.get('/test', (req, res) => {
    res.json({ message: 'Comuni routes are working correctly' });
});
exports.default = router;
