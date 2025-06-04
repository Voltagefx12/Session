// ./server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { startWhatsAppSession } = require('./session_generator');
const { parsePhoneNumber } = require('libphonenumber-js'); // Changed from PhoneNumber
const chalk = require('chalk');

console.log('Server.js: Starting script execution.');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

io.on('connection', (socket) => {
    console.log(chalk.green(`Client connected: ${socket.id}`));
    console.log('Server.js: Socket.IO client connected.');

    socket.on('start-session', async (data) => {
        console.log('Server.js: Received start-session event.');
        const { phoneNumber: rawPhoneNumber } = data;
        let formattedNumber = rawPhoneNumber; // Keep rawPhoneNumber as it might have '+'

        try {
            let parsedNumber;
            // Attempt to parse with a default region (e.g., 'NG' for Nigeria) if no '+' is present
            if (!rawPhoneNumber.startsWith('+')) {
                parsedNumber = parsePhoneNumber(rawPhoneNumber, 'NG'); // Default region 'NG'
            } else {
                parsedNumber = parsePhoneNumber(rawPhoneNumber); // If '+' is present, parse universally
            }
            
            if (!parsedNumber || !parsedNumber.isValid()) {
                // Fallback: if it's still invalid, insist on E.164 format
                socket.emit('error', 'Invalid phone number format. Please include country code (e.g., +234...).');
                return;
            }
            // Format to E.164 (like +23480...) and then remove the '+' for the session generator
            formattedNumber = parsedNumber.format('E.164').replace('+', '');
        } catch (e) {
            console.error(chalk.red("Phone number parsing error:"), e); // Log the actual error for debugging
            socket.emit('error', 'Invalid phone number format. Please include country code (e.g., +234...).');
            return;
        }

        console.log(chalk.blue(`Attempting to generate session for: ${formattedNumber}`));
        socket.emit('status', `Initiating connection for ${formattedNumber}...`);

        const emitEventToClient = (eventName, payload) => {
            socket.emit(eventName, payload);
            console.log(chalk.yellow(`Emitted event '${eventName}' to client ${socket.id} for ${formattedNumber}`));
        };

        try {
            await startWhatsAppSession(formattedNumber, emitEventToClient);
        } catch (error) {
            console.error(chalk.red(`Error in session generation for ${formattedNumber}:`, error));
            socket.emit('error', `Server error during session generation: ${error.message}`);
        }
    });

    socket.on('disconnect', () => {
        console.log(chalk.red(`Client disconnected: ${socket.id}`));
        console.log('Server.js: Socket.IO client disconnected.');
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
    console.log(chalk.cyan(`Server running on http://localhost:${PORT}`));
    console.log('Server.js: HTTP server is listening.');
    console.log(chalk.green('Go to your browser and open the link above to generate session ID.'));
});