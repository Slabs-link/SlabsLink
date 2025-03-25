"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getComuneByCode = exports.searchComuniByName = exports.getAllComuni = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Get all comuni
const getAllComuni = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Leggi i dati dal file JSON
        const comuniPath = path_1.default.join(process.cwd(), 'src', 'data', 'comuni.json');
        if (!fs_1.default.existsSync(comuniPath)) {
            return res.status(404).json({ message: 'Comuni data file not found' });
        }
        const comuniData = fs_1.default.readFileSync(comuniPath, 'utf8');
        const comuni = JSON.parse(comuniData);
        return res.json(comuni);
    }
    catch (error) {
        console.error('Error getting comuni:', error);
        return res.status(500).json({
            message: 'Error retrieving comuni',
            error: error.message
        });
    }
});
exports.getAllComuni = getAllComuni;
// Search comuni by name
const searchComuniByName = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ message: 'Search query is required' });
        }
        // Leggi i dati dal file JSON
        const comuniPath = path_1.default.join(process.cwd(), 'src', 'data', 'comuni.json');
        if (!fs_1.default.existsSync(comuniPath)) {
            return res.status(404).json({ message: 'Comuni data file not found' });
        }
        const comuniData = fs_1.default.readFileSync(comuniPath, 'utf8');
        const comuni = JSON.parse(comuniData);
        // Filtra i comuni in base alla query
        const searchQuery = query.toString().toLowerCase();
        const filteredComuni = comuni.filter((comune) => comune.nome.toLowerCase().includes(searchQuery));
        return res.json(filteredComuni);
    }
    catch (error) {
        console.error('Error searching comuni:', error);
        return res.status(500).json({
            message: 'Error searching comuni',
            error: error.message
        });
    }
});
exports.searchComuniByName = searchComuniByName;
// Get comune by code
const getComuneByCode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { code } = req.params;
        // Leggi i dati dal file JSON
        const comuniPath = path_1.default.join(process.cwd(), 'src', 'data', 'comuni.json');
        if (!fs_1.default.existsSync(comuniPath)) {
            return res.status(404).json({ message: 'Comuni data file not found' });
        }
        const comuniData = fs_1.default.readFileSync(comuniPath, 'utf8');
        const comuni = JSON.parse(comuniData);
        // Trova il comune con il codice specificato
        const comune = comuni.find((c) => c.codice === code);
        if (!comune) {
            return res.status(404).json({ message: 'Comune not found' });
        }
        return res.json(comune);
    }
    catch (error) {
        console.error('Error getting comune:', error);
        return res.status(500).json({
            message: 'Error retrieving comune',
            error: error.message
        });
    }
});
exports.getComuneByCode = getComuneByCode;
