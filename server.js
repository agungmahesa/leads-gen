require('dotenv').config();
const fs = require('fs');
const { createGenAI } = require("@google/genai");

const Baileys = require("@whiskeysockets/baileys");
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    jidDecode 
} = Baileys;
const jwt = require("jsonwebtoken");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const qrcode = require("qrcode");
const pino = require("pino");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.json());

// ─── Enable CORS for Frontend Fetch Requests ──────
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});
// ─── Authentication Middleware ────────────────────
const verifyToken = (req, res, next) => {
    const bearerHeader = req.headers['authorization'];
    if (typeof bearerHeader !== 'undefined') {
        const token = bearerHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, authData) => {
            if (err) res.sendStatus(403);
            else next();
        });
    } else {
        res.sendStatus(403);
    }
};

// ─── Auth API Routes ──────────────────────────────
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.APP_USERNAME && password === process.env.APP_PASSWORD) {
        const token = jwt.sign({ user: username }, process.env.JWT_SECRET || 'secret', { expiresIn: '12h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: "Invalid username or password" });
    }
});

let aiConfig = { isActive: false, geminiKey: '', prompt: '' };
try {
  if (fs.existsSync('ai-config.json')) {
    aiConfig = JSON.parse(fs.readFileSync('ai-config.json', 'utf8'));
  }
} catch (e) {}

app.get('/api/ai-config', verifyToken, (req, res) => res.json(aiConfig));
app.post('/api/ai-config', verifyToken, (req, res) => {
  aiConfig = { ...aiConfig, ...req.body };
  fs.writeFileSync('ai-config.json', JSON.stringify(aiConfig));
  res.json({ success: true });
});

let sysConfig = {};
try {
  if (fs.existsSync('sys-config.json')) {
    sysConfig = JSON.parse(fs.readFileSync('sys-config.json', 'utf8'));
  }
} catch(e) {}

function getAirtableConfig() {
  return {
    airtableKey: sysConfig.airtableKey || process.env.AIRTABLE_KEY || '',
    airtableBase: sysConfig.airtableBase || process.env.AIRTABLE_BASE || '',
    airtableTable: sysConfig.airtableTable || process.env.AIRTABLE_TABLE || ''
  };
}

app.get('/api/config', verifyToken, (req, res) => {
    res.json(getAirtableConfig());
});

app.post('/api/config', verifyToken, (req, res) => {
    sysConfig = { ...sysConfig, ...req.body };
    fs.writeFileSync('sys-config.json', JSON.stringify(sysConfig));
    res.json({ success: true });
});

// ── Pull config from Production Railway (local-only convenience endpoint) ──
app.post('/api/sync-from-prod', async (req, res) => {
    const prodUrl = 'https://leads-gen-production-461b.up.railway.app';
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    try {
        const result = await fetch(`${prodUrl}/api/config`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!result.ok) {
            return res.status(result.status).json({ error: 'Failed to fetch config from production' });
        }
        const data = await result.json();
        // Save to local sys-config.json
        sysConfig = { ...sysConfig, ...data };
        fs.writeFileSync('sys-config.json', JSON.stringify(sysConfig));
        console.log('✅ Successfully synced config from production Railway!');
        res.json({ success: true, keys: Object.keys(data) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/chats', verifyToken, async (req, res) => {
    const sys = getAirtableConfig();
    const baseId = sys.airtableBase;
    const tableId = sys.airtableTable;
    const apiKey = sys.airtableKey;
    if (!baseId || !tableId || !apiKey) return res.json({ chats: [] });

    try {
        const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}?maxRecords=100&sort%5B0%5D%5Bfield%5D=phone&sort%5B0%5D%5Bdirection%5D=desc`;
        const rt = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` }});
        const data = await rt.json();
        if (!data.records) return res.json({ chats: [] });

        const chats = data.records.filter(r => r.fields.Chat_History || r.fields.chat_history).map(r => ({
            id: r.id,
            name: r.fields.name || r.fields.business_name || 'Customer',
            phone: r.fields.phone,
            history: r.fields.Chat_History || r.fields.chat_history || "",
            aiActive: r.fields.AI_Active !== false && r.fields.ai_active !== false
        }));
        res.json({ chats });
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.post('/api/manual-reply', verifyToken, async (req, res) => {
    const { recordId, text } = req.body;
    if (!socket || connectionStatus !== "connected") return res.status(500).json({error:"WA Offline"});
    
    const sys = getAirtableConfig();
    const baseId = sys.airtableBase;
    const tableId = sys.airtableTable;
    const apiKey = sys.airtableKey;

    try {
        // Fetch specific record
        const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}/${recordId}`;
        const rt = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` }});
        const data = await rt.json();
        
        let phone = data.fields.phone;
        let chatHistory = data.fields.Chat_History || data.fields.chat_history || "";
        
        // Ensure +62 format for JID
        let formattedPhone = String(phone).replace(/\D/g, "");
        if (formattedPhone.startsWith("0")) formattedPhone = "62" + formattedPhone.slice(1);
        if (!formattedPhone.endsWith("@s.whatsapp.net")) formattedPhone += "@s.whatsapp.net";

        // Send WA
        await socket.sendMessage(formattedPhone, { text });

        // Update Airtable: Add to history & Disable AI
        chatHistory += `\nHuman: ${text}`;
        const updatePayload = { fields: {} };
        if (data.fields.chat_history !== undefined) updatePayload.fields.chat_history = chatHistory;
        else updatePayload.fields.Chat_History = chatHistory;
        
        if (data.fields.ai_active !== undefined) updatePayload.fields.ai_active = false;
        else updatePayload.fields.AI_Active = false;

        await fetch(url, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
        });

        res.json({ success: true });
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.post('/api/generate-intro', verifyToken, async (req, res) => {
    const { leadData, goalPrompt } = req.body;
    if (!aiConfig.geminiKey) return res.status(400).json({ error: "Gemini Key belum di set di menu AI Agent" });

    try {
        const client = createGenAI({ apiKey: aiConfig.geminiKey });
        
        const sysPrompt = `Anda adalah AI Copywriter profesional. Tugas Anda MENGHASILKAN PESAN WHATSAPP PERTAMA (Outreach) yang sangat personal. Tidak boleh ada tempat kosong seperti [Nama], isi semua berdasarkan data jika ada.
        
Data Tujuan (Lead):
Nama: ${leadData.name}
Kategori Bisnis: ${leadData.category}
Alamat: ${leadData.address}
Rating: ${leadData.rating}

Goal / Instruksi Pesan: ${goalPrompt}

PENTING: Jangan tambahkan kata "Subject:" atau "Text:". Berikan langsung isi pesannya saja.`;

        const response = await client.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [sysPrompt]
        });

        if (!response || !response.text) {
          throw new Error("AI tidak memberikan respon teks");
        }

        res.json({ message: response.text.trim() });
    } catch (e) {
        console.error("AI Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Protect all HTML files except login.html from direct access
app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html') {
        // Enforce login via frontend redirect or serve index directly.
        // Frontend app.js will handle token verification redirect.
        next();
    } else {
        next();
    }
});

// ─── Static Files (UI) ────────────────────────────
// Serve frontend via Express to bypass Safari "file:///" limitations
app.use(express.static(__dirname));

// ─── Manual CORS Middleware ───────────────────────
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

const PORT = process.env.PORT || 3001;
const AUTH_PATH = path.join(__dirname, "auth");
const logger = pino({ level: "info" });

let socket;
let qrCodeData = null;
let connectionStatus = "disconnected";

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);
    const { version } = await fetchLatestBaileysVersion();

    socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: "silent" }),
        browser: ["LeadGenDashboard", "Chrome", "1.0"]
    });

// socket.ev.on("creds.update", saveCreds); // Moved below

    socket.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCodeData = await qrcode.toDataURL(qr);
            connectionStatus = "waiting_scan";
            io.emit("qr", qrCodeData);
            io.emit("status", connectionStatus);
        }

        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            connectionStatus = "disconnected";
            qrCodeData = null;
            io.emit("status", connectionStatus);
            console.log("Connection closed. Reconnecting:", shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === "open") {
            connectionStatus = "connected";
            qrCodeData = null;
            io.emit("status", "connected");
            console.log("WhatsApp Connected!");
        }
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type === "notify") {
            for (const msg of messages) {
                // Ignore empty, system, or our own outgoing messages (so AI doesn't loop)
                if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.fromMe) continue;
                
                const remoteJid = msg.key.remoteJid;
                const phoneNum = remoteJid.split('@')[0];
                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
                if (!text || !aiConfig.isActive || !aiConfig.geminiKey) continue;

                const sys = getAirtableConfig();
                const baseId = sys.airtableBase;
                const tableId = sys.airtableTable;
                const apiKey = sys.airtableKey;
                if (!baseId || !tableId || !apiKey) continue;

                try {
                    // Cek apakah nomor ini adalah Leads di Airtable (+62...)
                    const airtablePhone = "+" + phoneNum;
                    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}?filterByFormula=${encodeURIComponent(`{phone}='${airtablePhone}'`)}`;
                    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` }});
                    const data = await res.json();
                    
                    if (!data.records || data.records.length === 0) continue; // Bukan Leads
                    
                    const record = data.records[0];
                    // Manual Override Check: Kalau checkbox AI_Active di un-check oleh admin, AI diam.
                    // Default true jika kolom belum disentuh (undefined)
                    const aiActiveValue = record.fields.AI_Active !== undefined ? record.fields.AI_Active : record.fields.ai_active;
                    if (aiActiveValue === false) continue;

                    let chatHistory = record.fields.Chat_History || record.fields.chat_history || "";
                    chatHistory += `\nCustomer: ${text}`;

                    // Panggil Gemini AI
                    const ai = new GoogleGenAI({ apiKey: aiConfig.geminiKey });
                    
                    // Kita bangun instruksi + memori percakapan
                    const aiPrompt = `${aiConfig.prompt}\n\nPENTING: Selalu merespon secara singkat layaknya chat WhatsApp. Ini adalah histori percakapan Anda dengan pelanggan ini:\n${chatHistory}\nAI:`;
                    
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: aiPrompt,
                    });
                    const aiReply = response.text.trim();
                    
                    // Balas pesan ke pelanggan
                    await socket.sendMessage(remoteJid, { text: aiReply });
                    chatHistory += `\nAI: ${aiReply}`;

                    // Simpan memori chat ke Airtable
                    // Support using the exact casing the user created
                    const updatePayload = { fields: {} };
                    if (record.fields.chat_history !== undefined) updatePayload.fields.chat_history = chatHistory;
                    else updatePayload.fields.Chat_History = chatHistory;

                    await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}/${record.id}`, {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatePayload)
                    });
                } catch(e) {
                    console.error("AI Reply Error: ", e.message);
                }
            }
        }
    });
}

// ─── Protected API Endpoints ──────────────────────

app.post("/send-message", verifyToken, async (req, res) => {
    const { phone, message } = req.body;

    if (!socket || connectionStatus !== "connected") {
        return res.status(500).json({ error: "WhatsApp not connected" });
    }

    if (!phone || !message) {
        return res.status(400).json({ error: "Phone and Message are required" });
    }

    try {
        // Simple phone format fixing (remove +, add 62 if needed)
        // Cast to String first to prevent crashing if Airtable returns a raw integer
        let formattedPhone = String(phone).replace(/\D/g, "");
        if (formattedPhone.startsWith("0")) {
            formattedPhone = "62" + formattedPhone.slice(1);
        }
        if (!formattedPhone.endsWith("@s.whatsapp.net")) {
            formattedPhone += "@s.whatsapp.net";
        }

        const result = await socket.sendMessage(formattedPhone, { text: message });
        res.json({ success: true, result });
    } catch (err) {
        logger.error(err, "Send Error");
        res.status(500).json({ error: err.message });
    }
});

app.get("/status", (req, res) => {
    res.json({ status: connectionStatus, qr: qrCodeData });
});

// REST fallbacks for WA actions (used when WebSocket is unavailable)
app.post('/api/logout-wa', verifyToken, async (req, res) => {
    try {
        if (socket) {
            await socket.logout();
            if (fs.existsSync(AUTH_PATH)) fs.rmSync(AUTH_PATH, { recursive: true, force: true });
        }
        connectionStatus = 'disconnected';
        io.emit('status', 'disconnected');
        connectToWhatsApp();
        res.json({ success: true, message: 'Logged out. Scan QR to reconnect.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reconnect-wa', verifyToken, (req, res) => {
    try {
        if (connectionStatus === 'disconnected') connectToWhatsApp();
        res.json({ success: true, message: 'Reconnect triggered.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Airtable Proxy API ─────────────────────────────
// Airtable strictly blocks CORS for PATs from local/file origins, so we must proxy requests through backend.
app.post('/api/airtable-sync', verifyToken, async (req, res) => {
    const { apiKey, baseId, tableName, records } = req.body;
    if (!apiKey || !baseId || !tableName || !records) return res.status(400).json({ error: 'Missing Airtable credentials or records.' });
    
    try {
        const AIRTABLE_URL = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
        const result = await fetch(AIRTABLE_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ records })
        });
        const data = await result.json();
        if (!result.ok) {
            return res.status(result.status).json({ error: data?.error?.message || data?.error?.type || result.statusText });
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/airtable-fetch', verifyToken, async (req, res) => {
    const { apiKey, baseId, tableName, offset, filterByFormula } = req.body;
    if (!apiKey || !baseId || !tableName) return res.status(400).json({ error: 'Missing Airtable credentials.' });
    
    try {
        const urlObj = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
        if (offset) urlObj.searchParams.append('offset', offset);
        if (filterByFormula) urlObj.searchParams.append('filterByFormula', filterByFormula);
        
        const result = await fetch(urlObj.toString(), {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const data = await result.json();
        if (!result.ok) {
            return res.status(result.status).json({ error: data?.error?.message || data?.error?.type || result.statusText });
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/airtable-update', verifyToken, async (req, res) => {
    const { apiKey, baseId, tableName, records } = req.body;
    if (!apiKey || !baseId || !tableName || !records) return res.status(400).json({ error: 'Missing Airtable credentials or records.' });
    
    try {
        const AIRTABLE_URL = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
        const result = await fetch(AIRTABLE_URL, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ records })
        });
        const data = await result.json();
        if (!result.ok) {
            return res.status(result.status).json({ error: data?.error?.message || data?.error?.type || result.statusText });
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Socket.io Logic ──────────────────────────────

io.on("connection", (client) => {
    console.log("Dashboard client connected to WebSocket");
    client.emit("status", connectionStatus);
    if (qrCodeData) client.emit("qr", qrCodeData);

    client.on("reconnect-wa", () => {
        if (connectionStatus === "disconnected") {
            connectToWhatsApp();
        }
    });

    client.on("logout", async () => {
        try {
            if (socket) {
                await socket.logout();
                if (fs.existsSync(AUTH_PATH)) {
                    fs.rmSync(AUTH_PATH, { recursive: true, force: true });
                }
                connectionStatus = "disconnected";
                io.emit("status", "disconnected");
                console.log("Logged out and session cleared.");
                connectToWhatsApp();
            }
        } catch (err) {
            console.error("Logout error:", err);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
    connectToWhatsApp();
});
