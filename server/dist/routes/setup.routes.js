"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const setup_sqlite_controller_1 = require("../controllers/setup-sqlite.controller");
const router = express_1.default.Router();
// Remove the duplicate endpoint and keep only the one that uses the controller
// router.post('/complete', (req, res) => { ... }); - REMOVE THIS DUPLICATE
router.get('/status', setup_sqlite_controller_1.checkSetupComplete);
router.post('/test-db-connection', setup_sqlite_controller_1.testDatabaseConnection);
router.post('/complete', setup_sqlite_controller_1.completeSetup);
exports.default = router;
