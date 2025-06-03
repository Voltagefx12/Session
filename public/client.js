// ./public/client.js
const socket = io();

const phoneNumberInput = document.getElementById('phoneNumber');
const generateButton = document.getElementById('generateButton');
const clearButton = document.getElementById('clearButton');
const statusDiv = document.getElementById('status');
const qrCodeDiv = document.getElementById('qrCode');
const qrImage = document.getElementById('qrImage');
const pairingCodeDiv = document.getElementById('pairingCode');
const codeText = document.getElementById('codeText');
const sessionIdOutputDiv = document.getElementById('sessionIdOutput');
const sessionIdJsonTextarea = document.getElementById('sessionIdJson');

function resetUI() {
    qrCodeDiv.style.display = 'none';
    pairingCodeDiv.style.display = 'none';
    sessionIdOutputDiv.style.display = 'none';
    sessionIdJsonTextarea.value = '';
    generateButton.disabled = false;
    phoneNumberInput.disabled = false;
    clearButton.style.display = 'none';
    statusDiv.innerHTML = '<span class="info">Status: Ready.</span>';
}

generateButton.addEventListener('click', () => {
    const phoneNumber = phoneNumberInput.value.trim();
    if (phoneNumber) {
        resetUI(); // Clear previous state
        statusDiv.innerHTML = '<span class="info">Sending request...</span>';
        generateButton.disabled = true; // Disable button during process
        phoneNumberInput.disabled = true;

        socket.emit('start-session', { phoneNumber });
    } else {
        statusDiv.innerHTML = '<span class="error">Please enter a phone number.</span>';
    }
});

clearButton.addEventListener('click', () => {
    resetUI();
    phoneNumberInput.value = ''; // Also clear the input field
});

socket.on('status', (message) => {
    statusDiv.innerHTML = `<span class="info">Status: ${message}</span>`;
});

socket.on('qr', (data) => {
    statusDiv.innerHTML = '<span class="info">Status: Scan the QR code or use the pairing code.</span>';
    qrImage.src = data.qr;
    qrCodeDiv.style.display = 'block';
    clearButton.style.display = 'inline-block'; // Show clear button if QR/code appears
});

socket.on('pairing-code', (data) => {
    statusDiv.innerHTML = '<span class="info">Status: Use the pairing code to link your WhatsApp.</span>';
    codeText.textContent = data.code;
    pairingCodeDiv.style.display = 'block';
    clearButton.style.display = 'inline-block'; // Show clear button if QR/code appears
});

socket.on('session-id', (data) => {
    statusDiv.innerHTML = '<span class="success">Status: Session ID generated successfully!</span>';
    qrCodeDiv.style.display = 'none';
    pairingCodeDiv.style.display = 'none';
    sessionIdJsonTextarea.value = JSON.stringify(data.sessionId, null, 2);
    sessionIdOutputDiv.style.display = 'block';
    generateButton.disabled = false; // Re-enable button for new generation
    phoneNumberInput.disabled = false;
    clearButton.style.display = 'none'; // Hide clear button once session is generated
});

socket.on('error', (message) => {
    statusDiv.innerHTML = `<span class="error">Error: ${message}</span>`;
    generateButton.disabled = false; // Re-enable button on error
    phoneNumberInput.disabled = false;
    clearButton.style.display = 'inline-block'; // Show clear button on error
    qrCodeDiv.style.display = 'none';
    pairingCodeDiv.style.display = 'none';
    sessionIdOutputDiv.style.display = 'none';
});

socket.on('complete', (message) => {
    console.log("Connection process complete:", message);
});

// Function to copy session ID to clipboard
function copySessionId() {
    sessionIdJsonTextarea.select();
    sessionIdJsonTextarea.setSelectionRange(0, 99999); // For mobile devices

    try {
        document.execCommand('copy');
        alert('Session ID copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy. Please manually select and copy the text.');
    }
}