// --- src/client/audio.js ---
export const Sound = {
    ctx: null, 
    lastPlay: {}, 
    noiseBuffer: null,
    isMuted: localStorage.getItem("evowar_muted") === "true", 
    
    // ĐÃ THÊM: Kho chứa file âm thanh MP3 cho Announcer
    announcerBuffers: {}, 
    
    init() {
      if (!this.ctx) { 
        window.AudioContext = window.AudioContext || window.webkitAudioContext; 
        this.ctx = new AudioContext(); 
        this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
        const output = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < output.length; i++) output[i] = Math.random() * 2 - 1;

        // ĐÃ THÊM: Tải sẵn các file MP3 khớp đúng tên của bạn
        this.announcerBuffers.doublekill = new Audio('sounds/Double Kill.mp3'); 
        this.announcerBuffers.triplekill = new Audio('sounds/triplekill.mp3'); 
        this.announcerBuffers.quadkill = new Audio('sounds/Quad Kill.mp3'); 
        this.announcerBuffers.megakill = new Audio('sounds/Mega Kill.mp3'); 
        this.announcerBuffers.legendary = new Audio('sounds/Legendary.mp3'); 
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    
    toggleMute() {
      this.isMuted = !this.isMuted;
      localStorage.setItem("evowar_muted", this.isMuted);
      return this.isMuted;
    },
  
    play(type) {
      if (this.isMuted) return; 

      // --- ĐÃ THÊM: XỬ LÝ PHÁT ÂM THANH MP3 (ANNOUNCER) ---
      if (this.announcerBuffers[type]) {
          const audioClone = this.announcerBuffers[type].cloneNode();
          audioClone.volume = 1.0;
          audioClone.play().catch(() => {});
          return; // Chạy xong âm thanh MP3 thì thoát, không chạy code AudioContext bên dưới
      }

      // --- GIỮ NGUYÊN: XỬ LÝ ÂM THANH TỔNG HỢP CỦA BẠN ---
      if (!this.ctx) return;
      const nowMs = Date.now();
      if (this.lastPlay[type] && nowMs - this.lastPlay[type] < 60) return; this.lastPlay[type] = nowMs;
      const now = this.ctx.currentTime;
      
      if (type === 'hover') {
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        gain.gain.setValueAtTime(0.04, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain); gain.connect(this.ctx.destination); osc.start(now); osc.stop(now + 0.1);
      }
      else if (type === 'click') {
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'square'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain); gain.connect(this.ctx.destination); osc.start(now); osc.stop(now + 0.1);
      }
      else if (type === 'swing') {
        const noiseSrc = this.ctx.createBufferSource(); noiseSrc.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter(); filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300, now); filter.frequency.linearRampToValueAtTime(1200, now + 0.15); filter.Q.value = 1.0;
        const gain = this.ctx.createGain(); gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        noiseSrc.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
        noiseSrc.start(now); noiseSrc.stop(now + 0.15);
      } 
      else if (type === 'kill') {
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'square'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(20, now + 0.2);
        gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(now); osc.stop(now + 0.3);
        const noiseSrc = this.ctx.createBufferSource(); noiseSrc.buffer = this.noiseBuffer;
        const nFilter = this.ctx.createBiquadFilter(); nFilter.type = 'lowpass'; nFilter.frequency.setValueAtTime(800, now);
        const nGain = this.ctx.createGain(); nGain.gain.setValueAtTime(0.4, now); nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        noiseSrc.connect(nFilter); nFilter.connect(nGain); nGain.connect(this.ctx.destination);
        noiseSrc.start(now); noiseSrc.stop(now + 0.2);
      } 
      else if (type === 'levelUp') {
        const playNote = (freq, startOffset, duration) => {
          const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
          osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now + startOffset);
          gain.gain.setValueAtTime(0, now + startOffset);
          gain.gain.linearRampToValueAtTime(0.06, now + startOffset + duration * 0.1); 
          gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
          osc.connect(gain); gain.connect(this.ctx.destination);
          osc.start(now + startOffset); osc.stop(now + startOffset + duration);
        };
        playNote(523.25, 0, 0.35); playNote(659.25, 0.08, 0.35);    
        playNote(783.99, 0.16, 0.35); playNote(1046.50, 0.26, 0.6);  
      }
    }
  };
