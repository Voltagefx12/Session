// ./session_generator.js
const { modul } = require('./module'); // Assumes module.js is in the same directory
const {
    default: XeonBotIncConnect,
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    PHONENUMBER_MCC,
} = require("baileys");
const pino = require("pino");
const NodeCache = require("node-cache");
const path = require('path');
const fs = require('fs').promises; // Use promises version of fs for async operations
const { Boom } = require('@hapi/boom'); // Correct import for Boom

// This function will establish the Baileys connection and emit events
async function startWhatsAppSession(phoneNumber, emitEvent) {
    // Create a unique session folder for each phone number
    const sessionPath = path.join(__dirname, 'sessions', phoneNumber);
    await fs.mkdir(sessionPath, { recursive: true }); // Ensure session directory exists

    const { saveCreds, state } = await useMultiFileAuthState(sessionPath);
    const msgRetryCounterCache = new NodeCache();

    const LordVoltage = XeonBotIncConnect({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // We'll handle QR/pairing code via web
        mobile: false, // Assuming not using mobile API for this purpose
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        browser: ['Chrome (Linux)', ''], // Generic browser
        patchMessageBeforeSending: (message) => {
            const requiresPatch = !!(
                message.buttonsMessage ||
                message.templateMessage ||
                message.listMessage
            );
            if (requiresPatch) {
                message = {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadataVersion: 2,
                                deviceListMetadata: {},
                            },
                            ...message,
                        },
                    },
                };
            }
            return message;
        },
        getMessage: async (key) => {
            // This is for fetching messages needed by Baileys, can be simplified for session gen
            return { conversation: "Spark Md" };
        },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
    });

    LordVoltage.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr, isNewLogin } = update;

        if (qr) {
            emitEvent('qr', { qr }); // Emit QR code data (base64 image) to the client
        }

        if (connection === 'open') {
            console.log('Baileys connection opened for', phoneNumber);
            emitEvent('status', 'CONNECTED');
            // After successful connection, the creds are ready.
            // Read the creds.json file and send its content.
            try {
                const credsData = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
                emitEvent('session-id', { sessionId: JSON.parse(credsData) }); // Send the JSON content
                // Disconnect after sending the session ID, as this bot isn't meant to stay online.
                await LordVoltage.logout(); // Log out from WhatsApp
                emitEvent('status', 'DISCONNECTED_AFTER_SESSION_ID');
            } catch (error) {
                console.error("Error reading creds.json:", error);
                emitEvent('error', 'Failed to read session ID after connection. Try again.');
                await LordVoltage.end(); // Ensure Baileys instance is ended
            }
            return; // Exit after successful connection and session ID emission
        }

        if (connection === 'close') {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason === DisconnectReason.badSession) {
                console.error(`Bad Session File, Please Delete Session and Scan Again`);
                emitEvent('error', 'Bad Session File. Please try again or clear previous session for this number.');
            } else if (reason === DisconnectReason.connectionClosed) {
                console.warn("Connection closed, trying again...");
            } else if (reason === DisconnectReason.connectionLost) {
                console.warn("Connection Lost from Server, trying again...");
            } else if (reason === DisconnectReason.connectionReplaced) {
                console.error("Connection Replaced, Another New Session Opened, Please Close Current Session First");
                emitEvent('error', 'Connection replaced. Another session opened. Try again.');
            } else if (reason === DisconnectReason.loggedOut) {
                console.error(`Device Logged Out, Please Scan Again And Run.`);
                emitEvent('error', 'Logged out. Please generate a new session.');
            } else if (reason === DisconnectReason.restartRequired) {
                console.warn("Restart Required, Restarting connection process...");
            } else if (reason === DisconnectReason.timedOut) {
                console.error("Connection TimedOut, Please try again.");
                emitEvent('error', 'Connection timed out. Please try again.');
            } else {
                console.error(`Unknown Disconnect Reason: <span class="math-inline">\{reason\}\|</span>{connection}`);
                emitEvent('error', `Unknown disconnection: ${reason}. Try again.`);
            }
            // Ensure the socket is closed if there's a fatal error or completion
            if (connection === 'close' && reason !== DisconnectReason.connectionClosed && reason !== DisconnectReason.connectionLost && reason !== DisconnectReason.restartRequired) {
                 await LordVoltage.end(); // End the Baileys instance if connection is definitively closed
                 emitEvent('complete', 'Connection attempt finished with error.');
            }
        }
    });

    LordVoltage.ev.on('creds.update', saveCreds);

    // Request pairing code if not registered
    if (!LordVoltage.authState.creds.registered) {
        // No need to validate phone number format here again, as it's done in server.js
        try {
            const code = await LordVoltage.requestPairingCode(phoneNumber);
            emitEvent('pairing-code', { code: code?.match(/.{1,4}/g)?.join("-") || code });
            emitEvent('status', 'Awaiting WhatsApp scan...');
        } catch (error) {
            console.error('Error requesting pairing code:', error);
            emitEvent('error', 'Failed to request pairing code. Make sure the number is valid and not already connected on another device/session.');
            await LordVoltage.end(); // End if request fails
        }
    } else {
        // If already registered (e.g., session file exists), just connect
        console.log('Already registered for', phoneNumber, '. Attempting to connect.');
        emitEvent('status', 'Existing session found. Attempting to connect...');
    }
}

module.exports = { startWhatsAppSession };
