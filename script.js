// --- 1. CANVAS SETUP ---
const canvas = document.getElementById('swarmCanvas');
const ctx = canvas.getContext('2d');
canvas.width = Math.min(window.innerWidth - 40, 1000);
canvas.height = Math.min(window.innerHeight - 300, 550);


// --- 2. DRONE CLASS DEFINITION ---
class Drone {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = 12; // Slightly larger to fit text
        this.status = 'HEALTHY'; // 'HEALTHY', 'JAMMED', or 'HIJACKED'
        this.jammedDuration = 5 * 60; // 5 seconds at 60 frames per second
        this.recoveryTimer = 0;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
    }

    draw() {
        // Draw the circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        switch (this.status) {
            case 'HEALTHY': ctx.fillStyle = '#28a745'; break;
            case 'JAMMED': ctx.fillStyle = '#dc3545'; break;
            case 'HIJACKED': ctx.fillStyle = '#6f42c1'; break;
        }
        ctx.fill();
        ctx.closePath();
        
        // --- NEW: Draw the drone ID text ---
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.id, this.x, this.y);
    }

    update() {
        if (this.status === 'JAMMED') {
            this.recoveryTimer--;
            if (this.recoveryTimer <= 0) {
                this.status = 'HEALTHY';
            }
        }
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < this.radius || this.x > canvas.width - this.radius) this.vx *= -1;
        if (this.y < this.radius || this.y > canvas.height - this.radius) this.vy *= -1;
    }
}


// --- 3. SWARM INITIALIZATION ---
const swarm = [];
const numDrones = 25;
const communicationRange = 150;
for (let i = 0; i < numDrones; i++) {
    swarm.push(new Drone(i, Math.random() * (canvas.width - 20) + 10, Math.random() * (canvas.height - 20) + 10));
}
const startDrone = swarm[0];
const endDrone = swarm[numDrones - 1];
let currentPath = null;


// --- 4. PATHFINDING ALGORITHM (BFS) ---
function findShortestPath(graph, startId, endId) {
    if (!graph[startId] || !graph[endId]) return null;
    const queue = [ [startId] ];
    const visited = new Set([startId]);
    while (queue.length > 0) {
        const path = queue.shift();
        const nodeId = path[path.length - 1];
        if (nodeId === endId) return path;
        (graph[nodeId] || []).forEach(neighbor => {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                const newPath = [...path, neighbor];
                queue.push(newPath);
            }
        });
    }
    return null;
}


// --- 5. MAIN ANIMATION LOOP ---
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fullAdjacencyList = {};
    const trustedAdjacencyList = {};
    swarm.forEach(drone => {
        fullAdjacencyList[drone.id] = [];
        if (drone.status === 'HEALTHY') trustedAdjacencyList[drone.id] = [];
    });
    for (let i = 0; i < swarm.length; i++) {
        for (let j = i + 1; j < swarm.length; j++) {
            const d1 = swarm[i];
            const d2 = swarm[j];
            const distance = Math.hypot(d1.x - d2.x, d1.y - d2.y);
            if (distance < communicationRange) {
                if (d1.status !== 'JAMMED' && d2.status !== 'JAMMED') {
                    fullAdjacencyList[d1.id].push(d2.id);
                    fullAdjacencyList[d2.id].push(d1.id);
                }
                if (d1.status === 'HEALTHY' && d2.status === 'HEALTHY') {
                    trustedAdjacencyList[d1.id].push(d2.id);
                    trustedAdjacencyList[d2.id].push(d1.id);
                }
            }
        }
    }
    
    ctx.strokeStyle = 'rgba(139, 148, 158, 0.2)';
    ctx.lineWidth = 1;
    for (const id in fullAdjacencyList) {
        const drone1 = swarm[id];
        fullAdjacencyList[id].forEach(neighborId => {
            const drone2 = swarm[neighborId];
            ctx.beginPath();
            ctx.moveTo(drone1.x, drone1.y);
            ctx.lineTo(drone2.x, drone2.y);
            ctx.stroke();
        });
    }
    
    currentPath = findShortestPath(trustedAdjacencyList, startDrone.id, endDrone.id);
    if (currentPath) {
        ctx.strokeStyle = '#28a745';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        for (let i = 0; i < currentPath.length - 1; i++) {
            const drone1 = swarm[currentPath[i]];
            const drone2 = swarm[currentPath[i + 1]];
            ctx.beginPath();
            ctx.moveTo(drone1.x, drone1.y);
            ctx.lineTo(drone2.x, drone2.y);
            ctx.stroke();
        }
    }
    
    swarm.forEach(drone => { drone.update(); drone.draw(); });
    
    ctx.fillStyle = '#c9d1d9';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START', startDrone.x, startDrone.y - 22);
    ctx.fillText('END', endDrone.x, endDrone.y + 22);
    
    requestAnimationFrame(animate);
}


// --- 6. EVENT LISTENERS FOR CONTROLS ---
const jamButton = document.getElementById('jam-button');
const hackButton = document.getElementById('hack-button');
const restoreButton = document.getElementById('restore-button');
const briefingButton = document.getElementById('ai-briefing-button');
const aiResponseDiv = document.getElementById('ai-response');

const jamIdInput = document.getElementById('jam-id-input');
const hackIdInput = document.getElementById('hack-id-input');

jamButton.addEventListener('click', () => {
    const targetIdStr = jamIdInput.value;
    let targetDrone = null;

    if (targetIdStr) { // If there's input, target specifically
        const targetId = parseInt(targetIdStr);
        if (!isNaN(targetId) && targetId >= 0 && targetId < numDrones) {
            targetDrone = swarm.find(d => d.id === targetId);
        }
    } else { // If input is empty, target randomly on the path
        if (currentPath && currentPath.length > 2) {
            const randomIndexInPath = Math.floor(Math.random() * (currentPath.length - 2)) + 1;
            const randomId = currentPath[randomIndexInPath];
            targetDrone = swarm.find(d => d.id === randomId);
        }
    }

    // Perform the action if a valid target was found
    if (targetDrone && targetDrone.status === 'HEALTHY' && targetDrone.id !== startDrone.id && targetDrone.id !== endDrone.id) {
        targetDrone.status = 'JAMMED';
        targetDrone.recoveryTimer = targetDrone.jammedDuration;
        jamIdInput.value = ''; // Clear input after action
    }
});

hackButton.addEventListener('click', () => {
    const targetIdStr = hackIdInput.value;
    let targetDrone = null;

    if (targetIdStr) { // If there's input, target specifically
        const targetId = parseInt(targetIdStr);
        if (!isNaN(targetId) && targetId >= 0 && targetId < numDrones) {
            targetDrone = swarm.find(d => d.id === targetId);
        }
    } else { // If input is empty, target randomly on the path
        if (currentPath && currentPath.length > 2) {
            const randomIndexInPath = Math.floor(Math.random() * (currentPath.length - 2)) + 1;
            const randomId = currentPath[randomIndexInPath];
            targetDrone = swarm.find(d => d.id === randomId);
        }
    }
    
    // Perform the action if a valid target was found
    if (targetDrone && targetDrone.status === 'HEALTHY' && targetDrone.id !== startDrone.id && targetDrone.id !== endDrone.id) {
        targetDrone.status = 'HIJACKED';
        hackIdInput.value = ''; // Clear input after action
    }
});

restoreButton.addEventListener('click', () => {
    swarm.forEach(drone => {
        drone.status = 'HEALTHY';
        drone.recoveryTimer = 0;
    });
});

briefingButton.addEventListener('click', getAIBriefing);


// --- 7. GEMINI API INTEGRATION ---
async function getAIBriefing() {
    briefingButton.disabled = true;
    aiResponseDiv.textContent = 'Analyzing swarm... Contacting HYDRA Command...';
    const healthyCount = swarm.filter(d => d.status === 'HEALTHY').length;
    const jammedCount = swarm.filter(d => d.status === 'JAMMED').length;
    const hijackedCount = swarm.filter(d => d.status === 'HIJACKED').length;
    const pathExists = currentPath !== null;

    const systemPrompt = `You are an AI military strategist named 'HYDRA Command'. Your mission is to analyze drone swarm data and provide a concise, tactical briefing in 2-3 sentences. Do not use markdown or lists. Be direct and authoritative.`;
    const userQuery = `Current Swarm Status Report:
- Total Drones: ${numDrones}
- Healthy: ${healthyCount}
- Jammed: ${jammedCount}
- Hijacked: ${hijackedCount}
- Primary Communication Link: ${pathExists ? 'Active' : 'Compromised'}

Provide your tactical assessment and one recommendation.`;
    
    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-0.5-20:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        aiResponseDiv.textContent = text || 'Could not retrieve briefing from HYDRA Command. Response was empty.';
    } catch (error) {
        console.error("Gemini API call failed:", error);
        aiResponseDiv.textContent = 'Error: Communication with HYDRA Command failed. Check console for details.';
    } finally {
        briefingButton.disabled = false;
    }
}

// Start the simulation
animate();
