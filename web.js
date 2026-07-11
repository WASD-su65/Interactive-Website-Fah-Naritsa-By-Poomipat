// ==========================================
// 🛠️ CONFIG & SUPABASE
// ==========================================
const supabaseUrl = 'https://twlgyxiocuspjdyfqjcf.supabase.co'; 
const supabaseKey = 'sb_publishable_8hWGjA385yLCYdVL3jsdfg_9dHtq2ZW'; 

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// 🛠️ ZONE นักพัฒนา: พิกัดแปลงดิน
// ==========================================
const SHOW_DEBUG_ZONE = false; 
const MIN_DISTANCE = 2.6;      

const DIRT_POLYGON = [
    { x: 12.53, y: 16.78 },
    { x: 12.75, y: 15.02 },
    { x: 17.79, y: 9.41 },
    { x: 20.40, y: 7.98 },
    { x: 31.14, y: 8.05 },
    { x: 47.15, y: 5.63 },
    { x: 54.01, y: 5.76 },
    { x: 56.91, y: 6.68 },
    { x: 60.18, y: 9.03 },
    { x: 61.37, y: 13.00 },
    { x: 61.19, y: 18.81 },
    { x: 59.71, y: 22.79 },
    { x: 49.11, y: 26.43 },
    { x: 23.78, y: 25.78 },
    { x: 17.87, y: 22.79 },
    { x: 13.44, y: 19.20 }
];

const DIRT_BOUNDS = {
    minX: Math.min(...DIRT_POLYGON.map(p => p.x)),
    maxX: Math.max(...DIRT_POLYGON.map(p => p.x)),
    minY: Math.min(...DIRT_POLYGON.map(p => p.y)),
    maxY: Math.max(...DIRT_POLYGON.map(p => p.y)),
};

const spawnedFlowers = [];
const flowerAssets = [
    "1.png", "2.png", "3.png", "4.png", "5.png",
    "6.png", "7.png", "8.png", "9.png", "10.png",
    "11.png"
];

let tempX = 0;
let tempY = 0;
let currentUser = "";
let selectedFlowerName = "";
let selectedFlowerMeaning = "";
let selectedFlowerImg = "";
let selectedFlowerDetail = "";

async function updateFlowerPosition(id, x, y) {
    if (id === undefined || id === null) {
        console.warn("⚠️ ไม่มี id ของดอกไม้ เลยบันทึกตำแหน่งใหม่กลับเข้า database ไม่ได้ (จะสุ่มตำแหน่งใหม่ทุกครั้งที่โหลดหน้าแทน)");
        return;
    }

    const { error } = await supabaseClient
        .from('flower')
        .update({ x: x, y: y })
        .eq('id', id);

    if (error) {
        console.error(`❌ บันทึกตำแหน่งใหม่ของดอกไม้ id ${id} ไม่สำเร็จ:`, error);
    } else {
        console.log(`✅ บันทึกตำแหน่งใหม่ของดอกไม้ id ${id} ลง database ถาวรแล้ว (x:${x}, y:${y})`);
    }
}

async function loadFlowers() {
    const { data, error } = await supabaseClient.from('flower').select('*');
    if (error) {
        console.error("Error loading:", error);
        return;
    }
    data.forEach(item => {
        let posX = Number(item.x);
        let posY = Number(item.y);

        if (isNaN(posX) || isNaN(posY) || !isInsideDirtEllipse(posX, posY)) {
            const safePos = getRandomValidDirtPosition();
            console.warn(`⚠️ ดอกไม้ id ${item.id ?? '(ไม่ทราบ)'} มีตำแหน่งหลุดนอกแปลงดิน (x:${item.x}, y:${item.y}, type: ${typeof item.x}) เลยสุ่มตำแหน่งใหม่ในแปลงดินให้แทน`);
            posX = safePos.x;
            posY = safePos.y;

            updateFlowerPosition(item.id, posX, posY);
        }

        spawnFlower(posX, posY, item.flower_id, item.nickname, item.message);
        spawnedFlowers.push({ x: posX, y: posY }); 
    });
}

async function saveToDatabase(x, y, flower_id, nickname, message, flower_name = "") {    
    const uuid = localStorage.getItem('user_uuid');

    const payload = { 
        x: x, 
        y: y, 
        flower_id: flower_id, 
        flower_name: flower_name,
        nickname: nickname, 
        message: message,
        user_uuid: uuid
    };

    console.log("🚀 กำลังส่งข้อมูล:", payload);

    const { data, error } = await supabaseClient
        .from('flower')
        .insert([payload]);
    
    if (error) {
        console.error("❌ บันทึกพลาด! สาเหตุ:", error);
        alert("บันทึกไม่สำเร็จ ลองดู Console (F12) นะครับ");
        return false;
    }
    console.log("✅ บันทึกสำเร็จ!");
    return true;
}

async function showFlowerCounter() {
    console.log("📊 กำลังนับจำนวนดอกไม้ทั้งหมด...");

    let totalCount = null;

    try {
        const { count, error } = await supabaseClient
            .from('flower')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error("⚠️ นับจาก Supabase ไม่สำเร็จ - จะใช้จำนวนดอกไม้ในหน้าจอแทน:", error);
        } else {
            totalCount = count;
            console.log(`📊 จำนวนดอกไม้ใน Supabase: ${count}`);
        }
    } catch (err) {
        console.error("⚠️ เกิด exception ตอนนับ:", err);
    }

    if (totalCount === null || totalCount === undefined) {
        totalCount = spawnedFlowers.length;
        console.log(`📊 ใช้ fallback: spawnedFlowers.length = ${totalCount}`);
    }

    const counterCard = document.getElementById('counterCard');
    const counterNumber = document.getElementById('counterNumber');

    if (!counterCard) {
        console.error("❌ ไม่พบ #counterCard ใน HTML");
        return;
    }
    if (!counterNumber) {
        console.error("❌ ไม่พบ #counterNumber ใน HTML");
        return;
    }

    counterNumber.innerText = totalCount;
    counterCard.classList.remove('hidden-counter');
    counterCard.classList.remove('hidden');

    console.log(`🎉 คุณเป็นคนปลูกดอกไม้ ดอกที่ ${totalCount} - แสดง counterCard แล้ว`);
}

function getUserIdentity() {
    let uuid = localStorage.getItem('user_uuid');
    if (!uuid) {
        uuid = crypto.randomUUID();
        localStorage.setItem('user_uuid', uuid);
    }
    return uuid;
}

function isInsideDirtEllipse(x, y) {
    let inside = false;
    for (let i = 0, j = DIRT_POLYGON.length - 1; i < DIRT_POLYGON.length; j = i++) {
        const xi = DIRT_POLYGON[i].x, yi = DIRT_POLYGON[i].y;
        const xj = DIRT_POLYGON[j].x, yj = DIRT_POLYGON[j].y;
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function getRandomValidDirtPosition(maxAttempts = 300) {
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
        const x = DIRT_BOUNDS.minX + Math.random() * (DIRT_BOUNDS.maxX - DIRT_BOUNDS.minX);
        const y = DIRT_BOUNDS.minY + Math.random() * (DIRT_BOUNDS.maxY - DIRT_BOUNDS.minY);

        if (isInsideDirtEllipse(x, y) && !isTooCloseToOthers(x, y)) {
            return { x, y };
        }
    }
    return {
        x: (DIRT_BOUNDS.minX + DIRT_BOUNDS.maxX) / 2,
        y: (DIRT_BOUNDS.minY + DIRT_BOUNDS.maxY) / 2
    };
}

function isTooCloseToOthers(x, y) {
    for (const flower of spawnedFlowers) {
        const dist = Math.hypot(x - flower.x, y - flower.y);
        if (dist < MIN_DISTANCE) return true; 
    }
    return false; 
}

function spawnFlower(xPercent, yPercent, imgName = null, nickname = "I", message = "plant for Fah Naritsa✿") {
    const patchZone = document.querySelector('.dirt-patch-zone');
    if (!patchZone) return;

    const randomImgSrc = imgName || flowerAssets[Math.floor(Math.random() * flowerAssets.length)];
    const flowerItem = document.createElement('div');
    flowerItem.className = 'flower-item';
    flowerItem.style.left = `${xPercent}%`;
    flowerItem.style.bottom = `${yPercent}%`;
    flowerItem.style.zIndex = Math.floor(100 - yPercent);
    
    const randomScale = 0.85 + Math.random() * 0.3;
    flowerItem.style.transform = `scale(${randomScale})`;

    const randomFlip = Math.random() > 0.5 ? 1 : -1;

    flowerItem.innerHTML = `
        <div class="speech-bubble">
            <strong>${nickname}</strong><br>${message}
        </div>
        <img src="${randomImgSrc}" class="flower-img" style="transform: scaleX(${randomFlip});">
    `;

    flowerItem.addEventListener('touchstart', function(e) {
        e.stopPropagation();
        document.querySelectorAll('.flower-item').forEach(el => el.classList.remove('show-bubble'));
        flowerItem.classList.toggle('show-bubble');
    });

    patchZone.appendChild(flowerItem);
}

document.addEventListener("DOMContentLoaded", () => {
    getUserIdentity();
    loadFlowers(); 
    
    const dirtPatchZone = document.querySelector('.dirt-patch-zone');
    if (dirtPatchZone) {
        if (SHOW_DEBUG_ZONE) {
            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('style', 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:9999;');
            svg.setAttribute('viewBox', '0 0 100 100');
            svg.setAttribute('preserveAspectRatio', 'none');

            const polygon = document.createElementNS(svgNS, 'polygon');
            const pointsAttr = DIRT_POLYGON.map(p => `${p.x},${100 - p.y}`).join(' ');
            polygon.setAttribute('fill', 'rgba(255,0,0,0.15)');
            polygon.setAttribute('stroke', 'red');
            polygon.setAttribute('stroke-width', '0.3');
            polygon.setAttribute('vector-effect', 'non-scaling-stroke');

            svg.appendChild(polygon);
            dirtPatchZone.appendChild(svg);
        }

        // ❌ ปิดการสุ่มดอกไม้ 120 ต้นตอนโหลดหน้า - แสดงเฉพาะดอกไม้จริงจาก Database เท่านั้น
        // หากต้องการเปิดกลับ ให้ลบ /* ... */ ด้านล่างออก
        /*
        let spawnedCount = 0;
        let attempts = 0;
        while (spawnedCount < 120 && attempts < 8000) {
            attempts++;
            const initialX = DIRT_BOUNDS.minX + Math.random() * (DIRT_BOUNDS.maxX - DIRT_BOUNDS.minX);
            const initialY = DIRT_BOUNDS.minY + Math.random() * (DIRT_BOUNDS.maxY - DIRT_BOUNDS.minY);
            
            if (isInsideDirtEllipse(initialX, initialY) && !isTooCloseToOthers(initialX, initialY)) {
                spawnFlower(initialX, initialY);
                spawnedFlowers.push({ x: initialX, y: initialY });
                spawnedCount++;
            }
        }
        */

        dirtPatchZone.addEventListener('click', async function(e) {
            if (!this.classList.contains('planting-active')) return;
            if (e.target.closest('.flower-item')) return; 

            const rect = this.getBoundingClientRect();
            const clickX = ((e.clientX - rect.left) / rect.width) * 100;
            const clickY = 100 - (((e.clientY - rect.top) / rect.height) * 100);

            if (!isInsideDirtEllipse(clickX, clickY)) {
                console.log('❌ คลิกนอกแปลงดิน');
                return;
            }
            if (isTooCloseToOthers(clickX, clickY)) {
                console.log('❌ คลิกใกล้ดอกไม้ต้นอื่นเกินไป');
                return;
            }

            tempX = clickX;
            tempY = clickY;

            const flowerImgToUse = selectedFlowerImg || flowerAssets[Math.floor(Math.random() * flowerAssets.length)];
            const flowerNameToUse = selectedFlowerName || "";
            const message = pendingMessage || "ส่งต่อความรัก ✿";

            console.log(`🌸 ปลูกดอกไม้: x=${tempX.toFixed(2)}, y=${tempY.toFixed(2)}, flower=${flowerImgToUse}`);

            spawnFlower(tempX, tempY, flowerImgToUse, currentUser, message);
            const saveOk = await saveToDatabase(tempX, tempY, flowerImgToUse, currentUser, message, flowerNameToUse);
            spawnedFlowers.push({ x: tempX, y: tempY });

            this.classList.remove('planting-active');
            const hintToast = document.getElementById('plantingHintToast');
            if (hintToast) hintToast.classList.add('hidden');
            pendingMessage = "";

            const mainMenu = document.getElementById('mainMenu');
            if (mainMenu) {
                mainMenu.classList.remove('hidden');
                mainMenu.classList.remove('fade-out');
            }
            const songTitle = document.querySelector('.song-title');
            if (songTitle) songTitle.classList.remove('hidden');

            if (saveOk) {
                showFlowerCounter();
            }
        });
    }
});

document.addEventListener('touchstart', function() {
    document.querySelectorAll('.flower-item').forEach(el => el.classList.remove('show-bubble'));
});

function startPlantingMode() {
    const mainMenu = document.getElementById('mainMenu');
    if (mainMenu) mainMenu.classList.add('hidden');

    const nameModal = document.getElementById('nameInputModal');
    if (nameModal) {
        nameModal.classList.remove('hidden');
    }
    const counterCard = document.getElementById('counterCard');
    if (counterCard) counterCard.classList.add('hidden-counter');

    const songTitle = document.querySelector('.song-title');
    if (songTitle) songTitle.classList.add('hidden');
}

function submitNameAndStart() {
    const nameInput = document.getElementById('userNameInput').value;
    
    if (nameInput.trim() === "") {
        alert("กรอกชื่อก่อนน้าาา");
        return;
    }

    currentUser = nameInput.trim();

    document.getElementById('displayName').innerText = currentUser;
    document.getElementById('nameInputModal').classList.add('hidden');
    document.getElementById('flowerSelectionModal').classList.remove('hidden');

    const songTitle = document.querySelector('.song-title');
    if (songTitle) songTitle.classList.add('hidden');
}

function selectFlower(flowerName, flowerMeaning, flowerImg, flowerDetail) {
    selectedFlowerName = flowerName;
    selectedFlowerMeaning = flowerMeaning;
    selectedFlowerImg = flowerImg;
    selectedFlowerDetail = flowerDetail;
    
    document.getElementById('modalFlowerName').innerText = selectedFlowerName;
    document.getElementById('modalFlowerMeaning').innerText = selectedFlowerMeaning;
    document.getElementById('modalFlowerImg').src = selectedFlowerImg;
    document.getElementById('modalFlowerDetail').innerText = selectedFlowerDetail;

    const selectionModal = document.getElementById('flowerSelectionModal');
    if (selectionModal) selectionModal.classList.add('hidden');

    const plantModal = document.getElementById('plantingModal');
    if (plantModal) plantModal.classList.remove('hidden');

    const songTitle = document.querySelector('.song-title');
    if (songTitle) songTitle.classList.add('hidden');
}

let pendingMessage = "";

function confirmPlanting() {
    const msgInput = document.getElementById('messageInput');
    pendingMessage = (msgInput && msgInput.value) ? msgInput.value : "ส่งต่อความรัก ✿";

    console.log(`🌸 พร้อมปลูกแล้ว: flower=${selectedFlowerImg}, msg=${pendingMessage} - รอคลิกที่พื้นดิน`);

    const plantModal = document.getElementById('plantingModal');
    if (plantModal) plantModal.classList.add('hidden');

    const dirtPatch = document.querySelector('.dirt-patch-zone');
    if (dirtPatch) dirtPatch.classList.add('planting-active');

    const hintToast = document.getElementById('plantingHintToast');
    if (hintToast) hintToast.classList.remove('hidden');
}

function closeModal(backToSelection = true) {
    const plantModal = document.getElementById('plantingModal');
    if (plantModal) {
        plantModal.classList.add('hidden');
    }
    
    if (backToSelection) {
        const selectionModal = document.getElementById('flowerSelectionModal');
        if (selectionModal) {
            selectionModal.classList.remove('hidden');
        }
    }
    
    const msgInput = document.getElementById('messageInput');
    if (msgInput) {
        msgInput.value = "";
    }

    const songTitle = document.querySelector('.song-title');
    if (songTitle) songTitle.classList.add('hidden');
}

function closeMainMenu() {
    const mainMenu = document.getElementById('mainMenu');
    if (mainMenu) mainMenu.classList.add('hidden');
}

function closeCounter() {
    const counterCard = document.getElementById('counterCard');
    if (counterCard) counterCard.classList.add('hidden-counter');
}

function closePlantingIntro() {
    const plantingIntro = document.getElementById('plantingIntroCard');
    if (plantingIntro) {
        plantingIntro.classList.add('card-hidden');
    }
}

function backToMainMenu() {
    const mainMenu = document.getElementById('mainMenu');
    const plantingIntro = document.getElementById('plantingIntroCard');
    const dirtPatch = document.querySelector('.dirt-patch-zone');

    if (plantingIntro) {
        plantingIntro.classList.add('card-hidden');
        setTimeout(() => {
            if (mainMenu) {
                mainMenu.classList.remove('hidden');
                void mainMenu.offsetWidth;
                mainMenu.classList.remove('fade-out');
            }
        }, 400);
    }
    
    if (dirtPatch) dirtPatch.classList.remove('planting-active');

    const hintToast = document.getElementById('plantingHintToast');
    if (hintToast) hintToast.classList.add('hidden');
    pendingMessage = "";
}

function toggleMusic() {
    const music = document.getElementById('bgMusic');
    const audioIcon = document.getElementById('audioIcon');
    
    if (!music) return;

    music.muted = !music.muted;

    if (music.muted) {
        if (audioIcon) audioIcon.src = 'ปิดเสียง.png';
    } else {
        if (audioIcon) audioIcon.src = 'เปิดเสียง.png';
    }

    if (music.paused) {
        music.play().catch(e => console.log("รอการโต้ตอบจากผู้ใช้"));
    }
}

document.addEventListener('click', function() {
    const music = document.getElementById('bgMusic');
    const audioBtn = document.querySelector('.audio-toggle-btn');
    
    if (music && music.paused) {
        music.play().then(() => {
            console.log("เล่นเพลงสำเร็จจากคลิกแรกของผู้ใช้");
            if (audioBtn) audioBtn.textContent = '🔊';
        }).catch(err => {
            console.log("Autoplay โดนบล็อกชั่วคราวโดยระบบความปลอดภัยของเบราว์เซอร์");
        });
    }
}, { once: true });

function enterGarden() {
    const welcome = document.getElementById('welcomeScreen');
    const music = document.getElementById('bgMusic');
    const audioBtn = document.getElementById('audioBtn');

    if (welcome) welcome.classList.add('fade-away');
    if (audioBtn) audioBtn.classList.remove('hidden');

    if (music) {
        music.play().then(() => {
            console.log("เข้าสวนแล้ว!");
        }).catch(error => {
            console.log("เบราว์เซอร์บล็อกเพลง:", error);
        });
    }
}

window.toggleMusic = toggleMusic;
window.closeMainMenu = closeMainMenu;
window.closeCounter = closeCounter;
window.startPlantingMode = startPlantingMode;
window.closePlantingIntro = closePlantingIntro;
window.backToMainMenu = backToMainMenu;