// --- 1. CANVAS SETUP ---
const canvas = document.getElementById('swarmCanvas');
const ctx = canvas.getContext('2d');
canvas.width = Math.min(window.innerWidth - 40, 1000);
canvas.height = Math.min(window.innerHeight - 300, 550);

// --- OBSTACLE DEFINITION ---
function randomObstacle(type, x = canvas.width + 80) {
    return {
        x: x,
        y: Math.random() * (canvas.height - 80) + 40,
        r: 30 + Math.random() * 20,
        type
    };
}
const obstacleTypes = ['tree', 'rock', 'tree', 'rock', 'tree', 'rock'];
let obstacles = obstacleTypes.map(type => randomObstacle(type));

// --- 2. DRONE CLASS DEFINITION ---
class Drone {
    constructor(id, x, y) {
        this.id = id;
        this.baseX = x;
        this.x = x;
        this.y = y;
        this.altitude = 100 + Math.random() * 50;
        this.radius = 12;
        this.status = 'HEALTHY';
        this.battery = 100;
        this.lidar = true;
        this.barometer = true;
        this.thermal = true;
        this.speed = 1.0 + Math.random() * 0.5;
        this.camera = true;
        this.distanceTravelled = 0;
        this.path = [{ x: this.x, y: this.y }];
        this.vy = 0;
        this.phase = Math.random() * Math.PI * 2; // For horizontal drift
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Body
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
        switch (this.status) {
            case 'HEALTHY': ctx.fillStyle = '#28a745'; break;
            case 'JAMMED': ctx.fillStyle = '#dc3545'; break;
            case 'HIJACKED': ctx.fillStyle = '#6f42c1'; break;
        }
        ctx.fill();
        ctx.closePath();

        // Rotors (propellers) - white
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-12, -6, 4, 0, Math.PI * 2); ctx.stroke(); ctx.closePath();
        ctx.beginPath(); ctx.arc(12, -6, 4, 0, Math.PI * 2); ctx.stroke(); ctx.closePath();
        ctx.beginPath(); ctx.arc(-12, 6, 4, 0, Math.PI * 2); ctx.stroke(); ctx.closePath();
        ctx.beginPath(); ctx.arc(12, 6, 4, 0, Math.PI * 2); ctx.stroke(); ctx.closePath();

        // Drone ID
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.id, 0, 0);

        ctx.restore();
    }

    update(swarm, frameCount) {
        // Gentle horizontal drift
        this.x = this.baseX + Math.sin(frameCount / 60 + this.phase) * 18;

        // Drones stay at fixed x position (left-middle), only drift up/down to avoid obstacles and other drones
        let avoidY = 0;
        for (const obs of obstacles) {
            const dx = obs.x - this.x;
            const dy = obs.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dx > 0 && dx < 80 && dist < obs.r + this.radius + 30) {
                // If obstacle is ahead and close, drift up or down smoothly
                avoidY += dy > 0 ? -1.2 : 1.2;
            }
        }

        // Drone-to-drone avoidance
        for (const other of swarm) {
            if (other !== this) {
                const dy = other.y - this.y;
                const dx = other.x - this.x;
                const dist = Math.hypot(dx, dy);
                if (Math.abs(dx) < 40 && dist < this.radius * 2.5) {
                    // If another drone is too close, drift away
                    avoidY += dy > 0 ? -1.5 : 1.5;
                }
            }
        }

        // Apply avoidance (limit vertical speed for smoothness)
        this.vy = Math.max(-2, Math.min(2, avoidY));
        this.y += this.vy;
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));
        this.battery = Math.max(0, this.battery - 0.01 * this.speed); // Battery drain
        this.path.push({ x: this.x, y: this.y });
    }

    getDistances() {
        // Distance to obstacles
        const obstacleDistances = obstacles.map(obs => ({
            type: obs.type,
            distance: Math.hypot(this.x - obs.x, this.y - obs.y)
        }));
        // Distance to other drones
        const droneDistances = swarm.map(d => ({
            id: d.id,
            distance: Math.hypot(this.x - d.x, this.y - d.y)
        }));
        return { obstacleDistances, droneDistances };
    }
}

// --- 3. SWARM INITIALIZATION ---
const swarm = [];
const numDrones = 15;
const startX = canvas.width * 0.25; // Drones start left-middle
const startY = canvas.height / 2;
for (let i = 0; i < numDrones; i++) {
    swarm.push(new Drone(
        i,
        startX,
        startY + (i - numDrones / 2) * 30
    ));
}

// --- 4. DRAW CONNECTIONS ---
function drawConnections() {
    ctx.save();
    ctx.lineWidth = 2;
    for (let i = 0; i < swarm.length; i++) {
        const droneA = swarm[i];
        if (droneA.status === 'JAMMED') continue; // Jammed drones have no connections

        // Find nearest neighbor that is not jammed
        let minDist = Infinity;
        let nearest = null;
        for (let j = 0; j < swarm.length; j++) {
            if (i === j) continue;
            const droneB = swarm[j];
            if (droneB.status === 'JAMMED') continue; // Don't connect to jammed drones
            const dist = Math.hypot(droneA.x - droneB.x, droneA.y - droneB.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = droneB;
            }
        }
        if (nearest) {
            ctx.strokeStyle = droneA.status === 'HIJACKED' ? 'rgba(111,66,193,0.7)' : 'rgba(0,200,255,0.7)';
            ctx.beginPath();
            ctx.moveTo(droneA.x, droneA.y);
            ctx.lineTo(nearest.x, nearest.y);
            ctx.stroke();
        }
    }
    ctx.restore();
}

// --- 5. MAIN ANIMATION LOOP ---
let frameCount = 0;
function animate() {
    frameCount++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Move obstacles to the left for side-scrolling effect
    for (let obs of obstacles) {
        obs.x -= 1.0; // Scroll speed
    }
    // Remove obstacles that have moved off screen and add new ones
    while (obstacles.length < 6) {
        obstacles.push(randomObstacle(obstacleTypes[obstacles.length % obstacleTypes.length]));
    }
    obstacles = obstacles.filter(obs => obs.x > -100);

    // Draw obstacles
    obstacles.forEach(obs => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
        ctx.fillStyle = obs.type === 'tree' ? '#228B22' : '#8B7B6B';
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(obs.type.toUpperCase(), obs.x, obs.y);
        ctx.restore();
    });

    // Draw connections
    drawConnections();

    // Move and draw drones
    swarm.forEach(drone => {
        drone.update(swarm, frameCount);
        drone.draw();
    });

    requestAnimationFrame(animate);
}

// --- 6. JAM & HACK BUTTONS ---
const jamButton = document.getElementById('jam-button');
const jamInput = document.getElementById('jam-id-input');
jamButton.addEventListener('click', function () {
    let id = parseInt(jamInput.value, 10);
    if (isNaN(id)) {
        // Random drone
        id = Math.floor(Math.random() * swarm.length);
    }
    if (id >= 0 && id < swarm.length) {
        swarm[id].status = 'JAMMED';
    }
});

const hackButton = document.getElementById('hack-button');
const hackInput = document.getElementById('hack-id-input');
hackButton.addEventListener('click', function () {
    let id = parseInt(hackInput.value, 10);
    if (isNaN(id)) {
        // Random drone
        id = Math.floor(Math.random() * swarm.length);
    }
    if (id >= 0 && id < swarm.length) {
        swarm[id].status = 'HIJACKED';
    }
});

const restoreButton = document.getElementById('restore-button');
restoreButton.addEventListener('click', function () {
    swarm.forEach(drone => drone.status = 'HEALTHY');
});

// --- 7. SEARCH BUTTON FOR DRONE INFO ---
const searchButton = document.getElementById('drone-search-button');
const searchInput = document.getElementById('drone-search-input');

searchButton.addEventListener('click', function () {
    const id = parseInt(searchInput.value, 10);
    if (isNaN(id) || id < 0 || id >= swarm.length) {
        showDroneInfo(null);
        return;
    }
    showDroneInfo(swarm[id]);
});

// --- 8. POPUP FUNCTION ---
function showDroneInfo(drone) {
    const infoDiv = document.getElementById('drone-info-popup');
    if (!drone) {
        infoDiv.innerHTML = `<strong>Drone not found.</strong>`;
        infoDiv.style.display = 'block';
        return;
    }
    const { obstacleDistances, droneDistances } = drone.getDistances();
    let infoHtml = `
        <strong>Drone ${drone.id}</strong><br>
        Battery: ${drone.battery.toFixed(1)}%<br>
        Coordinates: (${drone.x.toFixed(1)}, ${drone.y.toFixed(1)})<br>
        Altitude: ${drone.altitude.toFixed(1)}m<br>
        Status: ${drone.status}<br>
        Lidar: ${drone.lidar ? 'OK' : 'Fail'}<br>
        Barometer: ${drone.barometer ? 'OK' : 'Fail'}<br>
        Thermal: ${drone.thermal ? 'OK' : 'Fail'}<br>
        Speed: ${drone.speed ? drone.speed.toFixed(2) : 'N/A'} px/frame<br>
        Camera: ${drone.camera ? 'OK' : 'Fail'}<br>
        Distance Travelled: ${drone.distanceTravelled ? drone.distanceTravelled.toFixed(1) : 'N/A'} px<br>
        <hr>
        <strong>Distance to Obstacles:</strong><br>
        ${obstacleDistances.map(o => `${o.type}: ${o.distance.toFixed(1)} px`).join('<br>')}
        <hr>
        <strong>Distance to Other Drones:</strong><br>
        ${droneDistances.map(d => `Drone ${d.id}: ${d.distance.toFixed(1)} px`).join('<br>')}
    `;
    infoDiv.innerHTML = infoHtml;
    infoDiv.style.display = 'block';
}

// --- 9. CLOSE POPUP ON OUTSIDE CLICK ---
document.addEventListener('click', function (e) {
    const infoDiv = document.getElementById('drone-info-popup');
    if (infoDiv.style.display === 'block' && !searchButton.contains(e.target) && !searchInput.contains(e.target)) {
        infoDiv.style.display = 'none';
    }
});

// --- 10. START ANIMATION ---
animate();
