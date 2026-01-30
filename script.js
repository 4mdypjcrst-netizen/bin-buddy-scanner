// AI Waste Scanner Script

// DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startScanBtn = document.getElementById('startScan');
const stopScanBtn = document.getElementById('stopScan');
const resultDiv = document.getElementById('result');
const confidenceDiv = document.getElementById('confidence');
const wasteInfoDiv = document.getElementById('wasteInfo');
const pointsSpan = document.getElementById('points');
const badgesSpan = document.getElementById('badges');
const leaderboardUl = document.getElementById('leaderboard');
const registrationSection = document.getElementById('registration');
const scannerSection = document.getElementById('scanner');
const registrationForm = document.getElementById('registrationForm');
const userNameInput = document.getElementById('userName');
const userClassInput = document.getElementById('userClass');
const userStatusDiv = document.getElementById('userStatus');
const userDisplaySpan = document.getElementById('userDisplay');
const editProfileBtn = document.getElementById('editProfileBtn');
const switchUserBtn = document.getElementById('switchUserBtn');

// Global variables
let stream;
let model;
let scanning = false;
let points = parseInt(localStorage.getItem('points')) || 0;
let badges = parseInt(localStorage.getItem('badges')) || 0;
let leaderboard = JSON.parse(localStorage.getItem('leaderboard')) || [];

// Automatic scanning variables
let autoScanActive = false;
let lastScanTime = 0;
let referenceFrame = null;
let autoScanInterval = null;
const SCAN_COOLDOWN = 3000; // 3 seconds between auto-scans
const MOTION_THRESHOLD = 50000; // Threshold for detecting object changes

// User management variables
let currentUser = null;
const STORAGE_KEY = 'wasteScannerData';

// Initialize user data storage
function getUserData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        return JSON.parse(data);
    }
    return {
        currentUser: null,
        users: {}
    };
}

// Save user data
function saveUserData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Get unique username from name
function generateUsername(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString().slice(-4);
}

// Register new user
function registerUser(name, userClass) {
    const data = getUserData();
    const username = generateUsername(name);
    
    data.users[username] = {
        username: username,
        name: name,
        class: userClass,
        points: 0,
        badges: 0,
        history: [],
        createdAt: Date.now()
    };
    
    data.currentUser = username;
    saveUserData(data);
    
    return data.users[username];
}

// Get current user
function getCurrentUser() {
    const data = getUserData();
    if (data.currentUser && data.users[data.currentUser]) {
        return data.users[data.currentUser];
    }
    return null;
}

// Update current user's points and badges
function updateUserProgress(points, badges) {
    const data = getUserData();
    if (data.currentUser && data.users[data.currentUser]) {
        data.users[data.currentUser].points = points;
        data.users[data.currentUser].badges = badges;
        saveUserData(data);
    }
}

// Add to user history
function addToUserHistory(type, confidence) {
    const data = getUserData();
    if (data.currentUser && data.users[data.currentUser]) {
        data.users[data.currentUser].history.push({
            type: type,
            confidence: confidence,
            timestamp: Date.now()
        });
        saveUserData(data);
    }
}

// Update user profile
function updateUserProfile(name, userClass) {
    const data = getUserData();
    if (data.currentUser && data.users[data.currentUser]) {
        data.users[data.currentUser].name = name;
        data.users[data.currentUser].class = userClass;
        saveUserData(data);
    }
}

// Switch user
function switchUser(username) {
    const data = getUserData();
    if (data.users[username]) {
        data.currentUser = username;
        saveUserData(data);
        return data.users[username];
    }
    return null;
}

// Clear current user (logout)
function logoutUser() {
    const data = getUserData();
    data.currentUser = null;
    saveUserData(data);
    currentUser = null;
}

// Waste category information
const wasteCategories = {
    'Organic': {
        description: 'Biodegradable waste from natural sources',
        examples: ['Food scraps', 'Yard waste', 'Paper products', 'Cardboard'],
        color: '#4CAF50',
        points: 5
    },
    'Inorganic': {
        description: 'Non-biodegradable materials that can be recycled',
        examples: ['Plastic containers', 'Glass bottles', 'Metal cans', 'Electronics'],
        color: '#2196F3',
        points: 10
    },
    'Radioactive': {
        description: 'Materials contaminated with radioactive substances',
        examples: ['Nuclear waste', 'Medical isotopes', 'Contaminated equipment'],
        color: '#ff9800',
        points: 20
    }
};

// Initialize the app
async function init() {
    try {
        // Load TensorFlow.js model (using MobileNet for demo - replace with waste classification model)
        model = await tf.loadLayersModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json');
        console.log('Model loaded successfully');
    } catch (error) {
        console.error('Error loading model:', error);
        resultDiv.textContent = 'Error loading AI model. Please refresh the page.';
    }

    // Check if user is already registered
    const userData = getUserData();
    if (userData.currentUser && userData.users[userData.currentUser]) {
        // User exists, show scanner
        currentUser = userData.users[userData.currentUser];
        showScanner();
    } else {
        // No user, show registration
        showRegistration();
    }
    
    updateUI();
}

// Show registration form
function showRegistration() {
    registrationSection.style.display = 'block';
    scannerSection.style.display = 'none';
    userStatusDiv.style.display = 'none';
}

// Show scanner section
function showScanner() {
    registrationSection.style.display = 'none';
    scannerSection.style.display = 'block';
    userStatusDiv.style.display = 'block';
    
    // Update user display
    const user = getCurrentUser();
    if (user) {
        userDisplaySpan.textContent = `👤 ${user.name} (${user.class})`;
        
        // Load user's points and badges
        points = user.points || 0;
        badges = user.badges || 0;
        pointsSpan.textContent = points;
        badgesSpan.textContent = badges;
    }
}

// Handle registration form submission
function handleRegistration(event) {
    event.preventDefault();
    
    const name = userNameInput.value.trim();
    const userClass = userClassInput.value.trim();
    
    if (!name || !userClass) {
        alert('Please fill in all fields!');
        return;
    }
    
    // Register new user
    const user = registerUser(name, userClass);
    currentUser = user;
    
    // Show scanner
    showScanner();
    
    alert(`Welcome, ${name}! Your account has been created.`);
}

// Start camera
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        startScanBtn.disabled = true;
        stopScanBtn.disabled = false;
    } catch (error) {
        console.error('Error accessing camera:', error);
        resultDiv.textContent = 'Error accessing camera. Please allow camera permissions.';
    }
}

// Stop camera
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        startScanBtn.disabled = false;
        startScanBtn.textContent = 'Start Scanning';
        stopScanBtn.disabled = true;
        stopScanBtn.textContent = 'Stop Scanning';
        scanning = false;
    }
}

// Classify image
async function classifyImage() {
    if (!model || !scanning) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Preprocess image for MobileNet
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tfImage = tf.browser.fromPixels(imageData).resizeNearestNeighbor([224, 224]).toFloat();
    const offset = tf.scalar(127.5);
    const normalized = tfImage.sub(offset).div(offset);
    const batched = normalized.expandDims(0);

    // Predict
    const predictions = await model.predict(batched).data();
    
    // Get top prediction and confidence
    const predictionArray = Array.from(predictions);
    const maxConfidence = Math.max(...predictionArray);
    const topPrediction = predictionArray.indexOf(maxConfidence);

    // For demo purposes, simulate waste classification with 3 categories
    // Map MobileNet predictions to our 3 categories
    const wasteTypes = ['Organic', 'Inorganic', 'Radioactive'];
    const classifiedType = wasteTypes[topPrediction % wasteTypes.length];
    
    // Calculate confidence percentage (for demo, scale MobileNet confidence to percentage)
    const confidencePercentage = Math.round(maxConfidence * 100);

    // Display results
    displayClassificationResult(classifiedType, confidencePercentage);

    // Award points
    awardPoints(classifiedType);

    // Continue scanning
    if (scanning) {
        setTimeout(classifyImage, 2000); // Classify every 2 seconds
    }
}

// Display classification result with confidence and info
function displayClassificationResult(type, confidence) {
    // Update main result
    resultDiv.textContent = `Detected: ${type}`;
    resultDiv.style.color = wasteCategories[type].color;
    
    // Show and update confidence display
    confidenceDiv.style.display = 'block';
    confidenceDiv.textContent = `Confidence: ${confidence}%`;
    
    // Add confidence level class
    confidenceDiv.className = '';
    if (confidence >= 70) {
        confidenceDiv.classList.add('high');
        resultDiv.classList.add('detection-high');
    } else if (confidence >= 40) {
        confidenceDiv.classList.add('medium');
        resultDiv.classList.add('detection-medium');
    } else {
        confidenceDiv.classList.add('low');
        resultDiv.classList.add('detection-low');
    }
    
    // Reset animation classes after delay
    setTimeout(() => {
        resultDiv.classList.remove('detection-high', 'detection-medium', 'detection-low');
    }, 2000);

    // Show waste info panel
    wasteInfoDiv.style.display = 'block';
    wasteInfoDiv.className = `waste-info-panel ${type.toLowerCase()}`;
    
    const categoryInfo = wasteCategories[type];
    wasteInfoDiv.innerHTML = `
        <h4>${type} Waste Information</h4>
        <p><strong>Description:</strong> ${categoryInfo.description}</p>
        <p><strong>Examples:</strong></p>
        <ul>
            ${categoryInfo.examples.map(example => `<li>${example}</li>`).join('')}
        </ul>
        <p><strong>Points Earned:</strong> ${categoryInfo.points}</p>
    `;
    
    // Add to user history
    addToUserHistory(type, confidence);
}

// Motion detection for automatic scanning
function detectMotion() {
    if (!scanning || !autoScanActive || !video.videoWidth) return;
    
    const currentTime = Date.now();
    
    // Check cooldown period
    if (currentTime - lastScanTime < SCAN_COOLDOWN) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Create reference frame if doesn't exist
    if (!referenceFrame) {
        referenceFrame = imageData;
        return;
    }
    
    // Calculate motion between frames
    const motionScore = calculateMotionScore(referenceFrame, imageData);
    
    // If significant motion detected, trigger scan
    if (motionScore > MOTION_THRESHOLD) {
        console.log('Motion detected, scanning...');
        lastScanTime = currentTime;
        classifyImage();
    }
    
    // Update reference frame periodically
    if (currentTime % 5000 < 100) {
        referenceFrame = imageData;
    }
}

// Calculate motion score between two frames
function calculateMotionScore(frame1, frame2) {
    const data1 = frame1.data;
    const data2 = frame2.data;
    let score = 0;
    
    // Sample every 16th pixel for performance (224x224 grid)
    const width = frame1.width;
    const height = frame1.height;
    const step = 4; // Check every 4th pixel
    
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const i = (y * width + x) * 4;
            
            // Calculate RGB difference
            const rDiff = Math.abs(data1[i] - data2[i]);
            const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
            const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);
            
            score += rDiff + gDiff + bDiff;
        }
    }
    
    return score;
}

// Start automatic scanning mode
function startAutoScan() {
    autoScanActive = true;
    referenceFrame = null;
    lastScanTime = 0;
    
    // Update button states
    startScanBtn.textContent = '🔄 Auto Scan Active';
    stopScanBtn.textContent = 'Stop Scanning';
    resultDiv.textContent = 'Point waste at camera for automatic detection...';
    resultDiv.style.color = '#666';
    
    // Start motion detection loop
    autoScanInterval = setInterval(detectMotion, 500); // Check every 500ms
}

// Stop automatic scanning mode
function stopAutoScan() {
    autoScanActive = false;
    if (autoScanInterval) {
        clearInterval(autoScanInterval);
        autoScanInterval = null;
    }
    referenceFrame = null;
}

// Award points and badges
function awardPoints(type) {
    const pointsEarned = wasteCategories[type].points;
    points += pointsEarned;
    
    // Check for badges
    if (points >= 50 && badges < 1) {
        badges = 1;
    } else if (points >= 100 && badges < 2) {
        badges = 2;
    } else if (points >= 200 && badges < 3) {
        badges = 3;
    }

    // Save to localStorage (legacy support)
    localStorage.setItem('points', points);
    localStorage.setItem('badges', badges);
    
    // Save to user data (persistent)
    updateUserProgress(points, badges);

    updateUI();
}

// Update UI
function updateUI() {
    pointsSpan.textContent = points;
    badgesSpan.textContent = badges;

    // Update leaderboard (simple demo - in real app, this would be server-side)
    leaderboard.push({ name: 'You', points: points });
    leaderboard.sort((a, b) => b.points - a.points);
    leaderboard = leaderboard.slice(0, 5); // Top 5
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard));

    leaderboardUl.innerHTML = '';
    leaderboard.forEach((entry, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${entry.name}: ${entry.points} points`;
        leaderboardUl.appendChild(li);
    });
}

// Event listeners
startScanBtn.addEventListener('click', async () => {
    await startCamera();
    scanning = true;
    // Use automatic scanning instead of manual
    startAutoScan();
});

stopScanBtn.addEventListener('click', () => {
    stopAutoScan(); // Stop auto scanning first
    stopCamera(); // Then stop camera
});

// Registration form submission
registrationForm.addEventListener('submit', handleRegistration);

// Edit profile button
editProfileBtn.addEventListener('click', () => {
    const user = getCurrentUser();
    if (user) {
        const newName = prompt('Enter your name:', user.name);
        const newClass = prompt('Enter your class:', user.class);
        
        if (newName && newClass) {
            updateUserProfile(newName, newClass);
            showScanner(); // Refresh display
            alert('Profile updated successfully!');
        }
    }
});

// Switch user button
switchUserBtn.addEventListener('click', () => {
    const data = getUserData();
    const usernames = Object.keys(data.users);
    
    if (usernames.length <= 1) {
        // Only current user, ask to register new
        if (confirm('No other users found. Register as a new user?')) {
            showRegistration();
            registrationForm.reset();
        }
    } else {
        // Show user selection
        let message = 'Select a user to switch to:\n';
        usernames.forEach((username, index) => {
            if (username !== data.currentUser) {
                const user = data.users[username];
                message += `${index + 1}. ${user.name} (${user.class}) - ${user.points} points\n`;
            }
        });
        
        const choice = prompt(message + '\nEnter number (or 0 to register new user):');
        
        if (choice === '0') {
            showRegistration();
            registrationForm.reset();
        } else {
            const selectedIndex = parseInt(choice) - 1;
            const filteredUsernames = usernames.filter(u => u !== data.currentUser);
            
            if (selectedIndex >= 0 && selectedIndex < filteredUsernames.length) {
                const user = switchUser(filteredUsernames[selectedIndex]);
                if (user) {
                    currentUser = user;
                    showScanner();
                    alert(`Switched to ${user.name}!`);
                }
            }
        }
    }
});

// Initialize on page load
init();
