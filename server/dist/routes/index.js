"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const setup_routes_1 = __importDefault(require("./setup.routes"));
const users_routes_1 = __importDefault(require("./users.routes"));
const comuni_routes_1 = __importDefault(require("./comuni.routes"));
const templates_routes_1 = __importDefault(require("./templates.routes"));
const notifications_routes_1 = __importDefault(require("./notifications.routes"));
const router = express_1.default.Router();
// Setup routes
router.use('/setup', setup_routes_1.default);
// Aggiungiamo un endpoint di test anche qui
router.get('/routes-test', (req, res) => {
    res.json({ message: 'Routes are loaded correctly' });
});
// Register routes
router.use('/users', users_routes_1.default);
router.use('/templates', templates_routes_1.default);
router.use('/notifications', notifications_routes_1.default);
// Comuni routes
router.use('/comuni', comuni_routes_1.default);
// Log delle route registrate
console.log('Routes registered:');
console.log('- /api/routes-test');
console.log('- /api/users/...');
console.log('- /api/templates/...');
console.log('- /api/notifications/...');
exports.default = router;
