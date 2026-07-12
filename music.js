(function(){
  var STEP_DUR = 60/120/4;
  var BASS_PATTERN = [110,110,130.81,110,110,110,146.83,110];
  var ARP_MELODY = [440,523.25,493.88,392];

  var ctx, master, masterLP, reverb, reverbSend, dryGain;
  var delay, delayFeedback, delayLP, delayOut;
  var timers = [], stepTimer, playing = false, armed = false;
  var step = 0, arpCounter = 0;

  function getOrigin(){
    var o = null;
    try { o = localStorage.getItem('cmMusicOrigin'); } catch(e){}
    if (!o) {
      o = Date.now();
      try { localStorage.setItem('cmMusicOrigin', String(o)); } catch(e){}
    }
    return parseFloat(o);
  }
  function isMuted(){
    try { return localStorage.getItem('cmMusicMuted') === '1'; } catch(e){ return false; }
  }
  function setMuted(val){
    try { localStorage.setItem('cmMusicMuted', val ? '1' : '0'); } catch(e){}
  }

  function makeReverb(seconds, decay){
    var len = Math.floor(ctx.sampleRate*seconds);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) { d[i] = (Math.random()*2-1) * Math.pow(1-i/len, decay); }
    }
    var conv = ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  function send(node, sendAmt, dryAmt){
    var dg = ctx.createGain(); dg.gain.value = dryAmt;
    var sg = ctx.createGain(); sg.gain.value = sendAmt;
    node.connect(dg); dg.connect(dryGain);
    node.connect(sg); sg.connect(reverbSend);
  }

  function kick(t){
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(115, t);
    o.frequency.exponentialRampToValueAtTime(40, t+0.15);
    g.gain.setValueAtTime(0.65, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+0.28);
    o.connect(g);
    send(g, 0.15, 0.85);
    o.start(t); o.stop(t+0.3);
  }

  function rollingBass(t, freq){
    var o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = 'sine'; o.frequency.value = freq;
    fl.type = 'lowpass'; fl.frequency.value = 480;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.1);
    o.connect(fl); fl.connect(g);
    send(g, 0.12, 0.88);
    o.start(t); o.stop(t+0.12);
  }

  function shaker(t){
    var size = ctx.sampleRate*0.04;
    var buf = ctx.createBuffer(1, size, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < size; i++) { d[i] = Math.random()*2-1; }
    var n = ctx.createBufferSource(); n.buffer = buf;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+0.04);
    n.connect(hp); hp.connect(g);
    send(g, 0.3, 0.6);
    n.start(t); n.stop(t+0.04);
  }

  function arpLead(t, freq){
    var o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = freq;
    fl.type = 'lowpass'; fl.Q.value = 3;
    fl.frequency.setValueAtTime(2400, t);
    fl.frequency.exponentialRampToValueAtTime(850, t+0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.35);
    o.connect(fl); fl.connect(g);
    var dg = ctx.createGain(); dg.gain.value = 0.4; g.connect(dg); dg.connect(dryGain);
    var sg = ctx.createGain(); sg.gain.value = 0.3; g.connect(sg); sg.connect(reverbSend);
    var delg = ctx.createGain(); delg.gain.value = 0.55; g.connect(delg); delg.connect(delay);
    o.start(t); o.stop(t+0.4);
  }

  function pad(){
    var t = ctx.currentTime + 0.05;
    var chord = [110, 130.81, 164.81, 196];
    chord.forEach(function(f){
      var o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = f;
      fl.type = 'lowpass'; fl.frequency.value = 1100;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.03, t+2.6);
      g.gain.setValueAtTime(0.03, t+4.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t+8.4);
      o.connect(fl); fl.connect(g);
      send(g, 0.75, 0.2);
      o.start(t); o.stop(t+8.6);
    });
    timers.push(setTimeout(pad, 7800));
  }

  function vocalPad(){
    var notes = [440, 523.25, 392];
    var f = notes[Math.floor(Math.random()*notes.length)];
    var t = ctx.currentTime + 0.05;
    [f, f*1.006].forEach(function(freq){
      var o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
      var lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      lfo.frequency.value = 4; lfoGain.gain.value = 2.5;
      lfo.connect(lfoGain); lfoGain.connect(o.frequency);
      fl.type = 'lowpass'; fl.frequency.value = 1700;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.02, t+2.2);
      g.gain.setValueAtTime(0.02, t+3.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t+7);
      o.connect(fl); fl.connect(g);
      send(g, 0.9, 0.08);
      o.start(t); lfo.start(t);
      o.stop(t+7.2); lfo.stop(t+7.2);
    });
    timers.push(setTimeout(vocalPad, 9500+Math.random()*4000));
  }

  function scheduleStep(){
    var t = ctx.currentTime + 0.02;
    if (step % 4 === 0) kick(t);
    if (step % 2 === 0) rollingBass(t, BASS_PATTERN[(step/2|0) % BASS_PATTERN.length]);
    if (step % 2 === 1) shaker(t);
    if (step % 4 === 2) {
      arpLead(t, ARP_MELODY[arpCounter % ARP_MELODY.length]);
      arpCounter++;
    }
    step = (step+1) % 16;
  }

  function setupGraph(){
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.85;
    masterLP = ctx.createBiquadFilter(); masterLP.type = 'lowpass'; masterLP.frequency.value = 5200;
    master.connect(masterLP); masterLP.connect(ctx.destination);
    dryGain = ctx.createGain(); dryGain.gain.value = 1; dryGain.connect(master);
    reverb = makeReverb(4.2, 2.3);
    reverbSend = ctx.createGain(); reverbSend.gain.value = 1;
    var reverbOut = ctx.createGain(); reverbOut.gain.value = 0.45;
    reverbSend.connect(reverb); reverb.connect(reverbOut); reverbOut.connect(master);
    delay = ctx.createDelay(1.0); delay.delayTime.value = STEP_DUR*3;
    delayLP = ctx.createBiquadFilter(); delayLP.type = 'lowpass'; delayLP.frequency.value = 2000;
    delayFeedback = ctx.createGain(); delayFeedback.gain.value = 0.38;
    delayOut = ctx.createGain(); delayOut.gain.value = 0.5;
    delay.connect(delayLP); delayLP.connect(delayFeedback); delayFeedback.connect(delay);
    delayLP.connect(delayOut); delayOut.connect(master); delayOut.connect(reverbSend);
  }

  function updateIcons(){
    var muted = isMuted();
    var showPlayIcon = !playing;
    document.querySelectorAll('.music-toggle').forEach(function(btn){
      var p = btn.querySelector('.icon-play');
      var pa = btn.querySelector('.icon-pause');
      if (p) p.style.display = showPlayIcon ? '' : 'none';
      if (pa) pa.style.display = showPlayIcon ? 'none' : '';
      btn.setAttribute('aria-label', showPlayIcon ? 'Play background music' : 'Pause background music');
    });
  }

  // Phase-locks the rhythm section to a shared timestamp in localStorage, so the
  // beat lands on the same relative position every time it (re)starts on a new page.
  function begin(){
    if (playing) return;
    setupGraph();
    var origin = getOrigin();
    var elapsed = (Date.now()-origin)/1000;
    step = Math.floor(elapsed/STEP_DUR) % 16;
    arpCounter = Math.floor(elapsed/(STEP_DUR*4));
    pad(); vocalPad();
    stepTimer = setInterval(scheduleStep, STEP_DUR*1000);
    playing = true;
    updateIcons();
  }

  function stop(userInitiated){
    timers.forEach(clearTimeout); timers = [];
    clearInterval(stepTimer);
    playing = false;
    if (userInitiated) setMuted(true);
    updateIcons();
  }

  function toggle(){
    if (playing) {
      stop(true);
    } else {
      setMuted(false);
      if (ctx) ctx.resume();
      begin();
    }
  }

  function armFirstInteraction(){
    if (armed) return;
    armed = true;
    var events = ['click', 'keydown', 'touchstart'];
    function handler(){
      events.forEach(function(ev){ document.removeEventListener(ev, handler); });
      if (!isMuted() && !playing) { ctx.resume(); begin(); }
    }
    events.forEach(function(ev){ document.addEventListener(ev, handler); });
  }

  function attemptAutoplay(){
    setupGraph();
    var p = ctx.resume();
    Promise.resolve(p).then(function(){
      if (ctx.state === 'running') begin();
      else armFirstInteraction();
    }).catch(function(){ armFirstInteraction(); });
  }

  function wireButtons(){
    document.querySelectorAll('.music-toggle').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        toggle();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    wireButtons();
    updateIcons();
    if (!isMuted()) attemptAutoplay();
  });
})();
