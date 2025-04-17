import * as THREE from './three.module.min.js';
import { OrbitControls } from './orbitcontrols.js';

let scene, camera, renderer, controls;
let sun; // Keep a reference to the sun mesh
let earth;
let venus;
let mars;
let mercury;
const neos = [];
let animationSpeed = 0.5; // Base speed for NEO animations
const textureLoader = new THREE.TextureLoader(); // Texture loader for Sun and Earth
let solarSystemGroup; // Group for solar system objects
let earthLabel;
let venusLabel;
let marsLabel;
let mercuryLabel; // Variable to hold the Earth label
let animationearth = 1;
let currentNeoIndex = 0; // Keep track of the current NEO index
const nPerFetch = 10; // Number of NEOs to fetch each time


const apiKey = 'ASG4LGoAB7zG3a7hkknh3K35FK68ijpuH8tfEBbY';
let page = 0;
const neoUrl = `https://api.nasa.gov/neo/rest/v1/neo/browse?api_key=${apiKey}`;

function init() {
    // Initialize scene, camera, and renderer
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000); // Increased far plane
    camera.position.set(0, 150, 350); // Adjusted camera position

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // --- SHADOWS DISABLED FOR DEBUGGING ---
    // renderer.shadowMap.enabled = true;
    // renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Initialize controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableZoom = true;
    controls.enablePan = true; // OrbitControls handles panning with mouse/touch

    // Solar system group
    solarSystemGroup = new THREE.Group();
    scene.add(solarSystemGroup);

    // --- ADJUSTED LIGHTING FOR DEBUGGING --- 
    // Use simpler lighting while debugging
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Slightly brighter ambient
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Bring back directional light
    directionalLight.position.set(50, 100, 100); // Position it reasonably
    scene.add(directionalLight);
    // --- Point light disabled for now ---
    // const pointLight = new THREE.PointLight(0xffffff, 1.5, 2000);
    // pointLight.position.set(0, 0, 0);
    // pointLight.castShadow = true; // Shadow casting disabled
    // pointLight.shadow.mapSize.width = 1024;
    // pointLight.shadow.mapSize.height = 1024;
    // pointLight.shadow.camera.near = 0.5;
    // pointLight.shadow.camera.far = 1500;
    // scene.add(pointLight);


    createStarryBackground();
    createSun();
    createEarth();
    createMars();
    createVenus();
    createMercury();

    document.addEventListener('keydown', handleKeyDown, false);
    window.addEventListener('resize', onWindowResize, false);
    document.getElementById('zoomIn').addEventListener('click', zoomIn);
    document.getElementById('zoomOut').addEventListener('click', zoomOut);
    document.getElementById('toggleOrbits').addEventListener('click', toggleOrbits);
    document.getElementById('resetPositions').addEventListener('click', resetNEOs);
    document.getElementById('increaseSpeed').addEventListener('click', () => changeAnimationSpeed(1.2));
    document.getElementById('decreaseSpeed').addEventListener('click', () => changeAnimationSpeed(0.7));
    document.getElementById('loadMoreNEOs').addEventListener('click', loadMoreNEOs);
    document.getElementById('previousNEOs').addEventListener('click', loadPreviousNEOs);
    animate();
}

function handleKeyDown(event) {
    const keyName = event.key;
    const moveSpeed = 5; // Keep WASD speed
    const verticalMoveSpeed = 5; // Vertical speed for Arrow Keys

    switch (keyName) {
        // Arrow Keys for direct camera position manipulation (vertical/horizontal)
        case 'ArrowUp':
            camera.position.y += verticalMoveSpeed;
            break;
        case 'ArrowDown':
            camera.position.y -= verticalMoveSpeed;
            break;
        case 'ArrowLeft':
            camera.position.x -= moveSpeed; // Adjust horizontal movement
            break;
        case 'ArrowRight':
            camera.position.x += moveSpeed; // Adjust horizontal movement
            break;

        // WASD for Forward/Backward/Strafe (relative to camera view)
        case 'w':
            const forwardW = camera.getWorldDirection(new THREE.Vector3());
            // Move camera along its direction vector
            camera.position.addScaledVector(forwardW, moveSpeed);
            // Optionally move the controls target as well to keep focus
            controls.target.addScaledVector(forwardW, moveSpeed); 
            break;
        case 's':
            const backwardS = camera.getWorldDirection(new THREE.Vector3());
            camera.position.addScaledVector(backwardS, -moveSpeed);
            controls.target.addScaledVector(backwardS, -moveSpeed);
            break;
        case 'a':
            const leftA = new THREE.Vector3().crossVectors(camera.up, camera.getWorldDirection(new THREE.Vector3())).normalize();
            camera.position.addScaledVector(leftA, moveSpeed); // Strafe left
            controls.target.addScaledVector(leftA, moveSpeed);
            break;
        case 'd':
            const rightD = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
            camera.position.addScaledVector(rightD, moveSpeed); // Strafe right
            controls.target.addScaledVector(rightD, moveSpeed);
            break;
    }
    // No need to call controls.update() if only camera.position is changed for Arrows,
    // but it's needed if controls.target is changed for WASD.
    // Calling it always is safe.
    controls.update(); 
}


// Add floating name for celestial objects (Reverted to closer-to-original logic)
function createFloatingLabel(text, position, objectRadius = 10) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const fontSize = 40; // Adjusted font size
    // Adjust canvas width based on expected text length? Maybe fixed width is better.
    canvas.width = 512; // Power of 2 often preferred for textures
    canvas.height = 64; // Power of 2

    context.font = `Bold ${fontSize}px Arial`;
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.fillText(text, canvas.width / 2, fontSize * 0.8); // Adjust Y pos

    const texture = new THREE.CanvasTexture(canvas);
    // --- ENABLE SIZE ATTENUATION (DEFAULT) ---
    const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        // sizeAttenuation: true, // Default is true, so no need to explicitly set
    });
    const sprite = new THREE.Sprite(spriteMaterial);

    // --- ADJUST SPRITE SCALE FOR SIZE ATTENUATION ---
    // This scale determines the base size at a certain distance. Needs tweaking.
    sprite.scale.set(60, 8, 1); // Start with this scale, adjust as needed

    // --- ADJUST LABEL OFFSET ---
    const labelOffset = objectRadius + 15; // Gap above the object's radius
    sprite.position.copy(position.clone().add(new THREE.Vector3(0, labelOffset, 0)));

    return sprite;
}


function createStarryBackground() {
    const texture = textureLoader.load('stars.jpg');
    const backgroundGeometry = new THREE.SphereGeometry(1500, 64, 64);
    const backgroundMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide
    });
    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    scene.add(background);
}

function createSun() {
    const sunRadius = 30;
    const sunGeometry = new THREE.SphereGeometry(sunRadius, 32, 32);
    const sunTexture = textureLoader.load('sun.jpg');
    const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture });
    sun = new THREE.Mesh(sunGeometry, sunMaterial);
    solarSystemGroup.add(sun);

    const sunLabel = createFloatingLabel('Sun', sun.position, sunRadius);
    solarSystemGroup.add(sunLabel);
    // Position is updated during animation loop now
}

function createEarth() {
    const earthRadius = 17;
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 32, 32);
    const earthTexture = textureLoader.load('earth.jpg');
    const earthMaterial = new THREE.MeshBasicMaterial({ map: earthTexture });
    earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.position.set(110, 0, 0);
    solarSystemGroup.add(earth);

    earthLabel = createFloatingLabel('Earth', earth.position, earthRadius);
    solarSystemGroup.add(earthLabel);
    addOrbitLineForPlanet(110);
    earth.angle = 0;
}

function createMars() {
    const marsRadius = 10;
    const marsGeometry = new THREE.SphereGeometry(marsRadius, 32, 32);
    const marsTexture = textureLoader.load('mars.jpg');
    const marsMaterial = new THREE.MeshBasicMaterial({ map: marsTexture });
    mars = new THREE.Mesh(marsGeometry, marsMaterial);
    mars.position.set(140, 0, 0);
    solarSystemGroup.add(mars);

    marsLabel = createFloatingLabel('Mars', mars.position, marsRadius);
    solarSystemGroup.add(marsLabel);
    addOrbitLineForPlanet(140);
    mars.angle = 0;
}

function createVenus() {
    const venusRadius = 12;
    const venusGeometry = new THREE.SphereGeometry(venusRadius, 32, 32);
    const venusTexture = textureLoader.load('venus.jpg');
    const venusMaterial = new THREE.MeshBasicMaterial({ map: venusTexture });
    venus = new THREE.Mesh(venusGeometry, venusMaterial);
    venus.position.set(75, 0, 0);
    solarSystemGroup.add(venus);

    venusLabel = createFloatingLabel('Venus', venus.position, venusRadius);
    solarSystemGroup.add(venusLabel);
    addOrbitLineForPlanet(75);
    venus.angle = 0;
}

function createMercury() {
    const mercuryRadius = 8;
    const mercuryGeometry = new THREE.SphereGeometry(mercuryRadius, 32, 32);
    const mercuryTexture = textureLoader.load('mercury.jpg');
    const mercuryMaterial = new THREE.MeshBasicMaterial({ map: mercuryTexture });
    mercury = new THREE.Mesh(mercuryGeometry, mercuryMaterial);
    mercury.position.set(50, 0, 0);
    solarSystemGroup.add(mercury);

    mercuryLabel = createFloatingLabel('Mercury', mercury.position, mercuryRadius);
    solarSystemGroup.add(mercuryLabel);
    addOrbitLineForPlanet(50);
    mercury.angle = 0;
}

function addOrbitLineForPlanet(distance) {
    const points = [];
    const numPoints = 128;
    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const x = distance * Math.cos(angle);
        const z = distance * Math.sin(angle);
        points.push(new THREE.Vector3(x, 0, z));
    }
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xcccccc, opacity: 0.4, transparent: true });
    const orbitLine = new THREE.LineLoop(orbitGeometry, orbitMaterial);
    solarSystemGroup.add(orbitLine);
}

function clearPreviousNEOs() {
    neos.forEach((neo) => {
        if (neo.mesh) solarSystemGroup.remove(neo.mesh);
        if (neo.orbitLine) solarSystemGroup.remove(neo.orbitLine);
        if (neo.label) solarSystemGroup.remove(neo.label);
    });
    neos.length = 0;
}

async function fetchNEOs(startIndex = 0) {
    try {
        const response = await fetch(`${neoUrl}&page=${page}`);
        const data = await response.json();
        const neosData = data.near_earth_objects;

        if (!neosData || neosData.length === 0) {
            console.log("No more NEOs found on this page.");
            document.getElementById('loadMoreNEOs').disabled = true;
             document.getElementById('previousNEOs').disabled = (page <= 1);
            return;
        }

        const sortedNEOs = neosData.sort((a, b) => {
            const distanceA = a.close_approach_data?.[0]?.miss_distance?.kilometers || Infinity;
            const distanceB = b.close_approach_data?.[0]?.miss_distance?.kilometers || Infinity;
            return parseFloat(distanceA) - parseFloat(distanceB);
        });
        const neoTableData = [];

        for (const neoData of sortedNEOs.slice(startIndex, startIndex + nPerFetch)) {
             if (!neoData || !neoData.orbital_data || !neoData.close_approach_data || !neoData.close_approach_data[0]) {
                 console.warn("Skipping NEO with incomplete data:", neoData?.name || "Unknown");
                 continue;
             }
            const name = neoData.name;
            const eccentricity = parseFloat(neoData.orbital_data.eccentricity);
            const semiMajorAxisAU = parseFloat(neoData.orbital_data.semi_major_axis);
            const inclination = parseFloat(neoData.orbital_data.inclination);
            const relativeVelocity = parseFloat(neoData.close_approach_data[0].relative_velocity.kilometers_per_second);
            const semiMinorAxisAU = semiMajorAxisAU * Math.sqrt(1 - eccentricity ** 2);
            const speed = (relativeVelocity / 2000);
            const estimatedDiameterMeters = neoData.estimated_diameter?.meters?.estimated_diameter_max || 10;
            const orbitingBody = neoData.close_approach_data[0].orbiting_body;
            const isPotentiallyHazardous = neoData.is_potentially_hazardous_asteroid;

            neoTableData.push({
                name: name,
                estimated_diameter_meters: estimatedDiameterMeters,
                eccentricity: eccentricity,
                inclination: inclination,
                relative_velocity: relativeVelocity,
                orbiting_body: orbitingBody,
                is_potentially_hazardous: isPotentiallyHazardous
            });
            const neo = createNEO(name, eccentricity, semiMajorAxisAU, semiMinorAxisAU, inclination, speed, isPotentiallyHazardous, estimatedDiameterMeters);
            neos.push(neo);
            solarSystemGroup.add(neo.mesh);
            solarSystemGroup.add(neo.orbitLine);
            solarSystemGroup.add(neo.label);
        }

        addNEOToTable(neoTableData);
        // Update the current index for the next fetch
        if (sortedNEOs.length >= nPerFetch) {
            page++; // Move to the next page for the next batch
        } else {
            // Disable or hide the load more button if there are no more NEOs
            document.getElementById('loadMoreNEOs').disabled = true; // Disable the button if no more NEOs
        }

    } catch (error) {
        console.error('Error fetching NEOs:', error);
    }
}

async function loadMoreNEOs() {
    clearPreviousNEOs();
     console.log(`Loading next batch, current page index before fetch: ${page}`);
    await fetchNEOs(currentNeoIndex);
}
async function loadPreviousNEOs() {
    if(page==1) page=1;
    if (page > 1) {
        page = page - 2;
        console.log(`Loading previous batch, setting page index to: ${page}`);
        clearPreviousNEOs();
        await fetchNEOs(currentNeoIndex);
    } else {
        console.log('No previous NEOs to load');
         document.getElementById('previousNEOs').disabled = true;
    }
}

fetchNEOs(currentNeoIndex);

function createNEO(name, eccentricity, semiMajorAxisAU, semiMinorAxisAU, inclination, speed, isPHA, diameter) {
    const visualSize = Math.max(1, Math.min(8, Math.log(diameter / 10 + 1) * 2));
    const neoGeometry = new THREE.SphereGeometry(visualSize, 16, 16);
    const neoColor = isPHA ? 0xff4500 : 0xcccccc;
    const neoMaterial = new THREE.MeshBasicMaterial({ color: neoColor });
    const neoMesh = new THREE.Mesh(neoGeometry, neoMaterial);

    const distanceScale = 150;
    neoMesh.semiMajorAxis = semiMajorAxisAU * distanceScale;
    neoMesh.semiMinorAxis = semiMinorAxisAU * distanceScale;
    neoMesh.angle = Math.random() * Math.PI * 2;
    neoMesh.eccentricity = eccentricity;
    neoMesh.inclination = THREE.MathUtils.degToRad(inclination);
    neoMesh.speed = speed;

    const initialX = neoMesh.semiMajorAxis * Math.cos(neoMesh.angle);
    const initialZ = neoMesh.semiMinorAxis * Math.sin(neoMesh.angle);
    neoMesh.position.set(initialX, 0, initialZ);

    const orbitLine = createOrbitLine(neoMesh.semiMajorAxis, neoMesh.semiMinorAxis, neoMesh.inclination, isPHA);
    neoMesh.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), neoMesh.inclination);

    const neoLabel = createFloatingLabel(name, neoMesh.position, visualSize);
    return { mesh: neoMesh, orbitLine, label: neoLabel };
}

function createOrbitLine(semiMajorAxis, semiMinorAxis, inclinationRad, isPHA) {
    const numSegments = 128;
    const orbitPoints = [];
    for (let i = 0; i <= numSegments; i++) {
        const theta = (i / numSegments) * Math.PI * 2;
        const x = semiMajorAxis * Math.cos(theta);
        const z = semiMinorAxis * Math.sin(theta);
        orbitPoints.push(new THREE.Vector3(x, 0, z));
    }
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitColor = isPHA ? 0xff8c00 : 0xffcc00;
    const orbitMaterial = new THREE.LineBasicMaterial({ color: orbitColor, opacity: 0.7, transparent: true });
    const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
    orbitLine.rotation.x = inclinationRad;
    return orbitLine;
}

function resetNEOs() {
    neos.forEach((neo) => {
        neo.mesh.angle = Math.random() * Math.PI * 2;
        const initialX = neo.mesh.semiMajorAxis * Math.cos(neo.mesh.angle);
        const initialZ = neo.mesh.semiMinorAxis * Math.sin(neo.mesh.angle);
        neo.mesh.position.set(initialX, 0, initialZ);
        neo.mesh.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), neo.mesh.inclination);

        // Update label position during reset
        const visualSize = neo.mesh.geometry.parameters.radius;
        const labelOffset = visualSize + 15; // Consistent offset
        neo.label.position.copy(neo.mesh.position.clone().add(new THREE.Vector3(0, labelOffset, 0)));
    });
}

function zoomIn() {
     camera.position.z -= 20;
     controls.update();
}

function zoomOut() {
     camera.position.z += 20;
     controls.update();
}

function changeAnimationSpeed(multiplier) {
    animationSpeed *= multiplier;
    animationSpeed = Math.max(0.01, Math.min(10, animationSpeed));
    console.log("Animation Speed:", animationSpeed);
}

function toggleOrbits() {
    neos.forEach((neo) => {
        if (neo.orbitLine) {
             neo.orbitLine.visible = !neo.orbitLine.visible;
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // Update sun label position (since it doesn't move)
    const sunRadius = sun.geometry.parameters.radius;
    const sunLabel = solarSystemGroup.children.find(child => child instanceof THREE.Sprite && child.material.map.image?.getContext('2d')?.canvas.width === 512 && child.position.y > sunRadius); // Find sun label based on properties
    if (sunLabel) {
        const labelOffset = sunRadius + 15;
        sunLabel.position.copy(sun.position.clone().add(new THREE.Vector3(0, labelOffset, 0)));
    }


    animatePlanet(earth, 110, 0.005 * animationearth, earthLabel, earth.geometry.parameters.radius);
    animatePlanet(mars, 140, 0.003 * animationearth, marsLabel, mars.geometry.parameters.radius);
    animatePlanet(mercury, 50, 0.008 * animationearth, mercuryLabel, mercury.geometry.parameters.radius);
    animatePlanet(venus, 75, 0.007 * animationearth, venusLabel, venus.geometry.parameters.radius);
    animateNEOs();
    renderer.render(scene, camera);
}

// Added objectRadius parameter to correctly offset the label during animation
function animatePlanet(planet, orbitRadius, angularSpeed, label, objectRadius) {
    planet.angle += angularSpeed * animationSpeed;
    planet.position.x = orbitRadius * Math.cos(planet.angle);
    planet.position.z = orbitRadius * Math.sin(planet.angle);
    planet.rotation.y += 0.005;
    if (label) {
        // Calculate offset based on actual radius + gap
        const labelOffset = objectRadius + 15;
        label.position.copy(planet.position.clone().add(new THREE.Vector3(0, labelOffset, 0)));
    }
}


function animateNEOs() {
    neos.forEach((neo) => {
        neo.mesh.angle += neo.mesh.speed * animationSpeed;
        const x = neo.mesh.semiMajorAxis * Math.cos(neo.mesh.angle);
        const z = neo.mesh.semiMinorAxis * Math.sin(neo.mesh.angle);
        neo.mesh.position.set(x, 0, z);
        neo.mesh.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), neo.mesh.inclination);
        neo.mesh.rotation.y += 0.01;

        // Update label position during animation
        const visualSize = neo.mesh.geometry.parameters.radius;
        const labelOffset = visualSize + 15; // Consistent offset
        neo.label.position.copy(neo.mesh.position.clone().add(new THREE.Vector3(0, labelOffset, 0)));
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
