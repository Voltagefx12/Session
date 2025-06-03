// ./server.js
const express = require('express');
const http = require = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { startWhatsAppSession } = require('./session_generator');
const { PhoneNumber } = require('libphonenumber-js');
const chalk = require('chalk');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

io.on('connection', (socket) => {
    console.log(chalk.green(`Client connected: ${socket.id}`));

    socket.on('start-session', async (data) => {
        const { phoneNumber: rawPhoneNumber } = data;
        let formattedNumber = rawPhoneNumber.replace(/[^0-9]/g, '');

        try {
            const parsedNumber = PhoneNumber(formattedNumber);
            if (!parsedNumber.isValid()) {
                socket.emit('error', 'Invalid phone number format. Please include country code.');
                return;
            }
            formattedNumber = parsedNumber.format('E.164').replace('+', '');
        } catch (e) {
            socket.emit('error', 'Invalid phone number format. Please include country code (e.g., 234...).');
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
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
    console.log(chalk.cyan(`Server running on http://localhost:${PORT}`));
    console.log(chalk.green('Go to your browser and open the link above to generate session ID.'));
});

process.on('SIGINT', () => {
    console.log(chalk.yellow('SIGINT received. Shutting down server...'));
    server.close(() => {
        console.log(chalk.green('Server gracefully shut down.'));
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('SIGTERM received. Shutting down server...'));
    server.close(() => {
        console.log(chalk.green('Server gracefully shut down.'));
        process.exit(0);
    });
});