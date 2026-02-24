const canvas = document.getElementById('skyCanvas');
const ctx = canvas.getContext('2d');
const timeDisplay = document.getElementById('time-display');
const webUiPanel = document.getElementById('web-ui-panel');
const uiToggleBtn = document.getElementById('ui-toggle-btn');
let width, height;
let stars = [];
let meteors = [];
let bassIntensity = 0;
let globalStarOpacityMultiplier = 1.0;

let config = {
   density: 6,
   radius: 35,
   maxStars: 30000,
   fpsLimit: 60,
   enableMusic: true,
   starColor: '#ffffff',
   sceneType: 'city',
};

let lastFrameTime = 0;
let isSpraying = false;
let mouseX = 0,
   mouseY = 0;

const STAR_COLORS = ['#ffedd5', '#fee2e2', '#e0f2fe', '#fef9c3', '#ffffff'];

function generateWindows() {
   const container = document.getElementById('window-lights');
   container.innerHTML = '';

   // building1 viewBox(0 0 591.59 106.45) 기준 실루엣 구역
   // top = 건물 꼭대기 y좌표, bottom = 지붕 끝 y좌표 (도로 직전 ~82)
   const buildingZones = [
      { x: 0, w: 25, top: 44, bottom: 85 },

      { x: 61, w: 30, top: 33, bottom: 85 },
      { x: 92, w: 12, top: 50, bottom: 85 },

      { x: 121, w: 15, top: 40, bottom: 85 },
      { x: 137, w: 12, top: 52, bottom: 85 },

      { x: 186, w: 19, top: 20, bottom: 85 }, // 깃발 우측

      { x: 215, w: 12, top: 35, bottom: 85 },
      { x: 233, w: 8, top: 32, bottom: 85 },
      { x: 241, w: 9, top: 31, bottom: 85 },
      { x: 257, w: 12, top: 24, bottom: 85 },

      { x: 275, w: 28, top: 11, bottom: 85 }, // 중앙 건물

      { x: 320, w: 12, top: 47, bottom: 85 },

      { x: 341, w: 38, top: 33, bottom: 85 }, // 아래랑 세트
      { x: 380, w: 25, top: 33, bottom: 85 }, // 위랑 세트

      { x: 450, w: 38, top: 48, bottom: 85 },
      { x: 500, w: 33, top: 57, bottom: 85 },
      { x: 545, w: 40, top: 54, bottom: 85 },
   ];

   const WIN_W = 1.0; // 창문 너비 (SVG 좌표 기준)
   const WIN_H = 1.0; // 창문 높이
   const COL_GAP = 2.8; // 창문 열 간격
   const ROW_GAP = 3.2; // 창문 행 간격

   buildingZones.forEach((zone) => {
      const cols = Math.floor(zone.w / COL_GAP);
      const rows = Math.floor((zone.bottom - zone.top) / ROW_GAP);

      for (let c = 0; c < cols; c++) {
         for (let r = 0; r < rows; r++) {
            if (Math.random() > 0.38) {
               // 62% 확률로 불 켜짐
               const winX = zone.x + c * COL_GAP + Math.random() * 0.5;
               const winY = zone.top + r * ROW_GAP + Math.random() * 1.0;

               const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
               rect.setAttribute('x', winX);
               rect.setAttribute('y', winY);
               rect.setAttribute('width', WIN_W);
               rect.setAttribute('height', WIN_H);

               // 색상 다양화: 노랑(warm), 하늘(cool), 흰색
               const rand = Math.random();
               let color = '#fef08a';
               if (rand > 0.82) color = '#ffffff';
               else if (rand > 0.7) color = '#bae6fd';
               else if (rand > 0.62) color = '#fde68a';

               const baseOpacity = Math.random() * 0.55 + 0.35;
               rect.setAttribute('fill', color);
               rect.setAttribute('opacity', baseOpacity);

               // 깜빡임 효과 분기
               const fx = Math.random();
               if (fx > 0.9) {
                  // 빠른 전기 깜빡임
                  rect.classList.add('win-flicker');
                  rect.style.setProperty('--dur', Math.random() * 3 + 2 + 's');
               } else if (fx > 0.82) {
                  // 느린 전원 ON/OFF (불 켜고 끄는 느낌)
                  rect.classList.add('win-slow-fade');
                  rect.style.setProperty('--dur', Math.random() * 8 + 6 + 's');
                  rect.style.setProperty('--delay', -(Math.random() * 10) + 's');
               }

               container.appendChild(rect);
            }
         }
      }
   });
}

function updateWebConfig(key, value) {
   config[key] = value;
   if (key === 'sceneType') updateScenery();
}

function updateTimeContext() {
   const hour = new Date().getHours();
   const buildings3 = document.querySelectorAll('.building3');
   const buildings2 = document.querySelector('.building2');
   const buildings1 = document.querySelector('.building1');

   let label = 'Night',
      bClass = 'night',
      starMult = 1.0;

   if (hour >= 5 && hour < 8) {
      label = 'Dawn';
      bClass = 'dawn';
      starMult = 0.5;
   } else if (hour >= 8 && hour < 17) {
      label = 'Day';
      bClass = 'day';
      starMult = 0.1;
   } else if (hour >= 17 && hour < 20) {
      label = 'Dusk';
      bClass = 'dusk';
      starMult = 0.6;
   }

   document.body.className = bClass;
   timeDisplay.innerText = label;
   globalStarOpacityMultiplier = starMult;
}

function updateScenery() {
   document.querySelectorAll('.scene-svg').forEach((el) => el.classList.remove('active'));
   if (config.sceneType !== 'none') {
      const activeScene = document.getElementById(`scene-${config.sceneType}`);
      if (activeScene) activeScene.classList.add('active');
   }
}

class Star {
   constructor(x, y) {
      this.x = x;
      this.y = y;
      const isLarge = Math.random() > 0.95;
      this.size = isLarge ? Math.random() * 1.2 + 0.6 : Math.random() * 0.4 + 0.1;
      this.color = isLarge ? STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)] : '#fff';
      this.baseOpacity = Math.random() * 0.7 + 0.2;
      this.blinkSpeed = Math.random() * 0.03 + 0.01;
      this.angle = Math.random() * Math.PI * 2;
      this.isLarge = isLarge;
   }
   update() {
      this.angle += this.blinkSpeed;
      const reaction = config.enableMusic ? bassIntensity * 0.5 : 0;
      this.opacity = (this.baseOpacity + Math.sin(this.angle) * 0.2 + reaction) * globalStarOpacityMultiplier;
   }
   draw() {
      if (this.opacity < 0.05) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.opacity);
      ctx.fillStyle = this.color;
      const s = this.isLarge ? this.size + bassIntensity * 2 : this.size;
      ctx.beginPath();
      ctx.arc(this.x, this.y, s, 0, Math.PI * 2);
      if (this.isLarge && globalStarOpacityMultiplier > 0.5) {
         ctx.shadowBlur = s * 8;
         ctx.shadowColor = this.color;
      }
      ctx.fill();
      ctx.restore();
   }
}

class Meteor {
   constructor() {
      this.reset();
   }
   reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * (height * 0.4);
      this.len = Math.random() * 100 + 50;
      this.speed = Math.random() * 15 + 10;
      this.opacity = 1;
      this.active = false;
      this.wait = Math.random() * 1200 + 400;
   }
   update() {
      if (globalStarOpacityMultiplier < 0.3) return;
      if (!this.active) {
         if (--this.wait <= 0) this.active = true;
         return;
      }
      this.x += this.speed;
      this.y += this.speed * 0.5;
      this.opacity -= 0.015;
      if (this.opacity <= 0) this.reset();
   }
   draw() {
      if (!this.active) return;
      ctx.strokeStyle = `rgba(255,255,255,${this.opacity * globalStarOpacityMultiplier})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.len, this.y - this.len * 0.5);
      ctx.stroke();
   }
}

function resize() {
   width = window.innerWidth;
   height = window.innerHeight;
   canvas.width = width;
   canvas.height = height;
   if (meteors.length === 0) for (let i = 0; i < 3; i++) meteors.push(new Meteor());
}

function animate(timestamp) {
   const elapsed = timestamp - lastFrameTime;
   if (elapsed > 1000 / config.fpsLimit) {
      lastFrameTime = timestamp;
      ctx.clearRect(0, 0, width, height);
      if (isSpraying) {
         for (let i = 0; i < config.density; i++) {
            const a = Math.random() * Math.PI * 2,
               r = Math.sqrt(Math.random()) * config.radius;
            stars.push(new Star(mouseX + Math.cos(a) * r, mouseY + Math.sin(a) * r));
         }
         if (stars.length > config.maxStars) stars.splice(0, config.density);
      }
      stars.forEach((s) => {
         s.update();
         s.draw();
      });
      meteors.forEach((m) => {
         m.update();
         m.draw();
      });
   }
   requestAnimationFrame(animate);
}

window.onload = () => {
   resize();
   updateTimeContext();
   updateScenery();
   generateWindows();

   if (!window.wallpaperRegisterAudioListener) {
      webUiPanel.style.display = 'block';
      uiToggleBtn.style.display = 'block';
   } else {
      window.wallpaperRegisterAudioListener((audio) => {
         let sum = 0;
         for (let i = 0; i < 10; i++) sum += audio[i];
         bassIntensity = sum / 10;
      });
   }

   uiToggleBtn.onclick = () => (webUiPanel.style.display = webUiPanel.style.display === 'none' ? 'block' : 'none');
   window.onresize = resize;
   window.onmousedown = (e) => {
      if (e.target.tagName === 'CANVAS') isSpraying = true;
      mouseX = e.clientX;
      mouseY = e.clientY;
   };
   window.onmouseup = () => (isSpraying = false);
   window.onmousemove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
   };

   requestAnimationFrame(animate);
};
