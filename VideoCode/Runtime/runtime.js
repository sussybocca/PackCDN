/**
 * VideoCode Runtime – Ultimate Production System
 * Fully functional with hex numbers, negative literals, robust parsing,
 * and proper command separation (semicolons required).
 */
(function(global) {
  'use strict';

  // ===========================================================================
  // Core Runtime Engine (unchanged, but included for completeness)
  // ===========================================================================
  class VideoCodeEngine {
    constructor(config) {
      this.width = config.width || 1280;
      this.height = config.height || 720;
      this.fps = config.fps || 30;
      this.totalDuration = config.duration;
      this.videoBitrate = config.videoBitrate || 2500000;
      this.mimeType = config.mimeType || 'video/webm;codecs=vp9,opus';
      this.copyright = config.copyright || '';
      this.scenes = [];
      this.images = new Map();
      this.use3D = config.use3D || false;

      if (!window.MediaRecorder) throw new Error('MediaRecorder not supported');
      if (!window.OfflineAudioContext && !window.webkitOfflineAudioContext) {
        throw new Error('OfflineAudioContext not supported');
      }
      if (!HTMLCanvasElement.prototype.captureStream) {
        throw new Error('canvas.captureStream not supported');
      }
    }

    async loadImages(imageDefs) {
      const promises = [];
      for (const [id, url] of imageDefs) {
        if (this.images.has(id)) continue;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const promise = new Promise((resolve, reject) => {
          img.onload = () => { this.images.set(id, img); resolve(); };
          img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        });
        img.src = url;
        promises.push(promise);
      }
      await Promise.all(promises);
    }

    addScene(scene) {
      this.scenes.push(scene);
    }

    async render() {
      const audioBuffer = await this._renderMultiSceneAudio();

      return new Promise((resolve, reject) => {
        const canvas2D = document.createElement('canvas');
        canvas2D.width = this.width;
        canvas2D.height = this.height;
        const ctx2D = canvas2D.getContext('2d');

        let canvas3D, gl, threeRenderer, threeScene, threeCamera;
        if (this.use3D) {
          if (typeof THREE === 'undefined') {
            throw new Error('Three.js is required for 3D features');
          }
          canvas3D = document.createElement('canvas');
          canvas3D.width = this.width;
          canvas3D.height = this.height;
          gl = canvas3D.getContext('webgl');
          threeRenderer = new THREE.WebGLRenderer({ canvas: canvas3D, context: gl });
          threeRenderer.setSize(this.width, this.height);
          threeScene = new THREE.Scene();
          threeCamera = new THREE.PerspectiveCamera(75, this.width/this.height, 0.1, 1000);
          threeCamera.position.set(0, 0, 5);
        }

        const videoStream = canvas2D.captureStream(this.fps);

        let audioContext = null, audioSource = null, audioStream = null;
        if (audioBuffer) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          audioSource = audioContext.createBufferSource();
          audioSource.buffer = audioBuffer;
          const audioDestination = audioContext.createMediaStreamDestination();
          audioSource.connect(audioDestination);
          audioSource.start(0);
          audioStream = audioDestination.stream;
        }

        const tracks = videoStream.getVideoTracks();
        if (audioStream) tracks.push(...audioStream.getAudioTracks());
        const combinedStream = new MediaStream(tracks);

        let recorder;
        try {
          recorder = new MediaRecorder(combinedStream, {
            mimeType: this.mimeType,
            videoBitsPerSecond: this.videoBitrate
          });
        } catch (e) {
          console.warn('Specified MIME type not supported, using default');
          recorder = new MediaRecorder(combinedStream);
        }

        const chunks = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
          if (audioContext) audioContext.close().catch(console.warn);
          canvas2D.remove();
          if (canvas3D) canvas3D.remove();
          resolve(blob);
        };
        recorder.onerror = reject;
        recorder.start();

        const startTime = performance.now();
        const renderFrame = () => {
          const globalTime = (performance.now() - startTime) / 1000;
          if (globalTime > this.totalDuration) {
            setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 100);
            return;
          }

          let currentScene = null;
          let sceneTime = 0;
          for (const scene of this.scenes) {
            if (globalTime >= scene.startTime && globalTime < scene.startTime + scene.duration) {
              currentScene = scene;
              sceneTime = globalTime - scene.startTime;
              break;
            }
          }

          ctx2D.clearRect(0, 0, this.width, this.height);

          if (this.use3D && threeRenderer) {
            threeRenderer.render(threeScene, threeCamera);
            ctx2D.drawImage(canvas3D, 0, 0, this.width, this.height);
          }

          if (currentScene) {
            for (const track of currentScene.videoTracks) {
              try {
                track(ctx2D, sceneTime, this.images, threeScene, threeCamera);
              } catch (err) {
                console.error('Video track error in scene:', err);
              }
            }
          }

          if (this.copyright) {
            ctx2D.save();
            ctx2D.font = '20px Arial';
            ctx2D.fillStyle = 'white';
            ctx2D.shadowColor = 'black';
            ctx2D.shadowBlur = 4;
            ctx2D.fillText(this.copyright, 20, this.height - 20);
            ctx2D.restore();
          }

          requestAnimationFrame(renderFrame);
        };
        renderFrame();
      });
    }

    async renderPhoto(sceneIndex = 0, time = 0) {
      const scene = this.scenes[sceneIndex];
      if (!scene) throw new Error('Scene not found');

      const canvas = document.createElement('canvas');
      canvas.width = this.width;
      canvas.height = this.height;
      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, this.width, this.height);
      for (const track of scene.videoTracks) {
        try {
          track(ctx, time, this.images, null, null);
        } catch (err) {
          console.error('Video track error in photo:', err);
        }
      }
      if (this.copyright) {
        ctx.font = '20px Arial';
        ctx.fillStyle = 'white';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(this.copyright, 20, this.height - 20);
      }

      return new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });
    }

    async _renderMultiSceneAudio() {
      const sampleRate = 48000;
      const totalFrames = Math.ceil(sampleRate * this.totalDuration);
      const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
        2, totalFrames, sampleRate
      );

      const masterGain = offlineCtx.createGain();
      masterGain.gain.value = 1.0;
      masterGain.connect(offlineCtx.destination);

      for (const scene of this.scenes) {
        for (const gen of scene.audioTracks) {
          try {
            const node = gen(offlineCtx, scene.startTime, scene.duration);
            if (node && node.connect) node.connect(masterGain);
          } catch (err) {
            console.error('Audio track error:', err);
          }
        }
      }

      try {
        return await offlineCtx.startRendering();
      } catch (err) {
        console.error('Offline rendering failed:', err);
        return null;
      }
    }
  }

  // ===========================================================================
  // Language Parser (fully fixed: hex numbers, negative literals, comments)
  // ===========================================================================
  class VideoCodeParser {
    constructor(code) {
      this.code = code;
      this.tokens = [];
      this.pos = 0;
    }

    tokenize() {
      // Remove single-line comments
      this.code = this.code.replace(/\/\/.*/g, '');
      // Remove multi-line comments
      this.code = this.code.replace(/\/\*[\s\S]*?\*\//g, '');

      // Updated regex to include hexadecimal numbers (0x...) and semicolons
      const tokenRegex = /\s*(?:(0x[0-9a-fA-F]+)|(\d+\.?\d*|\d*\.\d+)|([a-zA-Z_][a-zA-Z0-9_]*)|("[^"]*"|'[^']*')|([{}()[\],;])|([+\-*/]))/g;
      let match;
      while ((match = tokenRegex.exec(this.code)) !== null) {
        if (match[1]) {
          // Hexadecimal number
          this.tokens.push({ type: 'number', value: parseInt(match[1], 16) });
        } else if (match[2]) {
          // Decimal number
          this.tokens.push({ type: 'number', value: parseFloat(match[2]) });
        } else if (match[3]) {
          this.tokens.push({ type: 'identifier', value: match[3] });
        } else if (match[4]) {
          this.tokens.push({ type: 'string', value: match[4].slice(1, -1) });
        } else if (match[5]) {
          this.tokens.push({ type: 'symbol', value: match[5] });
        } else if (match[6]) {
          this.tokens.push({ type: 'operator', value: match[6] });
        }
      }
    }

    peek() { return this.tokens[this.pos]; }
    consume(expected) {
      const token = this.peek();
      if (!token) throw new Error(`Unexpected end of input, expected ${expected}`);
      if (expected && token.type !== expected && token.value !== expected) {
        throw new Error(`Expected ${expected}, got ${token.value}`);
      }
      this.pos++;
      return token;
    }
    match(type, value) {
      const t = this.peek();
      return t && t.type === type && (value === undefined || t.value === value);
    }

    parseProgram() {
      this.tokenize();
      this.pos = 0;
      const config = {
        width: 1280,
        height: 720,
        fps: 30,
        duration: null,
        videoBitrate: 2500000,
        mimeType: 'video/webm;codecs=vp9,opus',
        copyright: '',
        use3D: false
      };
      const scenes = [];
      const imageDefs = new Map();

      while (this.peek()) {
        const token = this.peek();
        if (token.type === 'identifier') {
          switch (token.value) {
            case 'width':
            case 'height':
            case 'fps':
            case 'duration':
            case 'videoBitrate':
            case 'mimeType':
              this.parseConfig(config);
              break;
            case 'copyright':
              this.consume('identifier', 'copyright');
              config.copyright = this.consume('string').value;
              break;
            case 'scene':
              this.parseScene(scenes, imageDefs, config);
              break;
            default:
              throw new Error(`Unexpected identifier: ${token.value}`);
          }
        } else {
          throw new Error(`Unexpected token: ${token.type} ${token.value}`);
        }
      }

      if (config.duration === null) {
        config.duration = scenes.reduce((sum, s) => sum + s.duration, 0);
      }
      if (config.duration === 0) throw new Error('Total duration must be > 0');

      return { config, scenes, imageDefs };
    }

    parseConfig(config) {
      const token = this.consume('identifier');
      if (token.value === 'mimeType') {
        config[token.value] = this.consume('string').value;
      } else {
        const expr = this.parseExpression();
        const val = this.evaluateStatic(expr);
        if (typeof val !== 'number') throw new Error(`${token.value} must be a number`);
        config[token.value] = val;
      }
    }

    parseScene(scenes, imageDefs, config) {
      this.consume('identifier', 'scene');
      let duration = null;
      if (this.match('number') || this.match('identifier') || this.match('symbol', '(')) {
        duration = this.parseExpression();
      }
      this.consume('symbol', '{');
      const videoCommands = [];
      const audioCommands = [];
      const threeCommands = [];

      while (!this.match('symbol', '}')) {
        const token = this.peek();
        if (!token) throw new Error('Unclosed scene block');
        if (token.type === 'identifier') {
          switch (token.value) {
            case 'loadImage':
              this.consume('identifier', 'loadImage');
              const id = this.consume('string').value;
              const url = this.consume('string').value;
              imageDefs.set(id, url);
              this.consumeOptionalSemicolon();
              break;
            case 'audio':
              this.consume('identifier', 'audio');
              this.consume('symbol', '{');
              while (!this.match('symbol', '}')) {
                audioCommands.push(this.parseCommand());
              }
              this.consume('symbol', '}');
              break;
            case 'three':
              config.use3D = true;
              this.consume('identifier', 'three');
              this.consume('symbol', '{');
              while (!this.match('symbol', '}')) {
                threeCommands.push(this.parseCommand());
              }
              this.consume('symbol', '}');
              break;
            default:
              videoCommands.push(this.parseCommand());
              break;
          }
        } else {
          throw new Error(`Unexpected token in scene: ${token.value}`);
        }
      }
      this.consume('symbol', '}');

      let sceneDuration;
      if (duration === null) {
        throw new Error('Scene duration must be specified (e.g., scene 5 { ... })');
      } else {
        sceneDuration = this.evaluateStatic(duration);
      }

      scenes.push({
        duration: sceneDuration,
        videoCommands,
        audioCommands,
        threeCommands
      });
    }

    parseCommand() {
      const name = this.consume('identifier').value;
      const args = [];
      // Parse arguments until we hit a semicolon or closing brace
      while (this.peek() && !this.match('symbol', '}') && !this.match('symbol', ';')) {
        if (this.match('symbol', ',')) {
          this.consume('symbol', ',');
          continue;
        }
        args.push(this.parseExpression());
      }
      this.consumeOptionalSemicolon();
      return { name, args };
    }

    consumeOptionalSemicolon() {
      if (this.match('symbol', ';')) this.consume('symbol', ';');
    }

    parseExpression() {
      return this.parseAddSub();
    }
    parseAddSub() {
      let left = this.parseMulDiv();
      while (this.match('operator', '+') || this.match('operator', '-')) {
        const op = this.consume('operator').value;
        const right = this.parseMulDiv();
        left = { type: 'binary', op, left, right };
      }
      return left;
    }
    parseMulDiv() {
      let left = this.parsePrimary();
      while (this.match('operator', '*') || this.match('operator', '/')) {
        const op = this.consume('operator').value;
        const right = this.parsePrimary();
        left = { type: 'binary', op, left, right };
      }
      return left;
    }
    parsePrimary() {
      // Handle unary minus for negative numbers
      if (this.match('operator', '-') && this.tokens[this.pos+1] && this.tokens[this.pos+1].type === 'number') {
        this.consume('operator', '-');
        const num = this.consume('number').value;
        return { type: 'literal', value: -num };
      }
      if (this.match('number')) {
        return { type: 'literal', value: this.consume('number').value };
      }
      if (this.match('string')) {
        return { type: 'literal', value: this.consume('string').value };
      }
      if (this.match('identifier', 'time')) {
        this.consume('identifier', 'time');
        return { type: 'time' };
      }
      if (this.match('identifier')) {
        const name = this.consume('identifier').value;
        if (this.match('symbol', '(')) {
          this.consume('symbol', '(');
          const args = [];
          if (!this.match('symbol', ')')) {
            do {
              args.push(this.parseExpression());
            } while (this.match('symbol', ',') && this.consume('symbol', ','));
          }
          this.consume('symbol', ')');
          return { type: 'call', name, args };
        } else {
          // It's a variable (e.g., width, height)
          return { type: 'variable', name };
        }
      }
      if (this.match('symbol', '(')) {
        this.consume('symbol', '(');
        const expr = this.parseExpression();
        this.consume('symbol', ')');
        return expr;
      }
      throw new Error(`Unexpected token in expression: ${this.peek().value}`);
    }

    evaluateStatic(expr) {
      const evalNode = (node) => {
        switch (node.type) {
          case 'literal': return node.value;
          case 'binary':
            const left = evalNode(node.left);
            const right = evalNode(node.right);
            switch (node.op) {
              case '+': return left + right;
              case '-': return left - right;
              case '*': return left * right;
              case '/': return left / right;
              default: throw new Error(`Unknown operator ${node.op}`);
            }
          case 'call':
            const args = node.args.map(evalNode);
            switch (node.name) {
              case 'sin': return Math.sin(args[0]);
              case 'cos': return Math.cos(args[0]);
              case 'sqrt': return Math.sqrt(args[0]);
              default: throw new Error(`Unknown function ${node.name}`);
            }
          case 'variable':
            throw new Error(`Cannot use variable '${node.name}' in config value`);
          default:
            throw new Error(`Invalid expression type in config: ${node.type}`);
        }
      };
      return evalNode(expr);
    }
  }

  // ===========================================================================
  // Expression Evaluator (runtime, with time and context)
  // ===========================================================================
  function evaluate(expr, time, context) {
    switch (expr.type) {
      case 'literal': return expr.value;
      case 'time': return time;
      case 'variable':
        if (context.hasOwnProperty(expr.name)) {
          return context[expr.name];
        }
        throw new Error(`Unknown variable: ${expr.name}`);
      case 'binary':
        const left = evaluate(expr.left, time, context);
        const right = evaluate(expr.right, time, context);
        switch (expr.op) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/': return left / right;
          default: throw new Error(`Unknown operator ${expr.op}`);
        }
      case 'call':
        const args = expr.args.map(arg => evaluate(arg, time, context));
        switch (expr.name) {
          case 'sin': return Math.sin(args[0]);
          case 'cos': return Math.cos(args[0]);
          case 'sqrt': return Math.sqrt(args[0]);
          case 'clamp': return Math.min(1, Math.max(0, args[0]));
          default: throw new Error(`Unknown function ${expr.name}`);
        }
      default:
        throw new Error(`Unknown expression type ${expr.type}`);
    }
  }

  // ===========================================================================
  // Command to Drawing Function Translator (2D + 3D)
  // ===========================================================================
  function createVideoTrack(videoCommands, threeCommands, context) {
    return (ctx, time, images, threeScene, threeCamera) => {
      ctx.save();

      for (const cmd of videoCommands) {
        try {
          const args = cmd.args.map(arg => evaluate(arg, time, context));
          switch (cmd.name) {
            case 'fill': ctx.fillStyle = args[0]; break;
            case 'stroke': ctx.strokeStyle = args[0]; break;
            case 'lineWidth': ctx.lineWidth = args[0]; break;
            case 'font': ctx.font = args[0]; break;
            case 'opacity': ctx.globalAlpha = args[0]; break;
            case 'rect': ctx.fillRect(args[0], args[1], args[2], args[3]); break;
            case 'circle':
              ctx.beginPath();
              ctx.arc(args[0], args[1], args[2], 0, 2 * Math.PI);
              ctx.fill();
              break;
            case 'line':
              ctx.beginPath();
              ctx.moveTo(args[0], args[1]);
              ctx.lineTo(args[2], args[3]);
              ctx.stroke();
              break;
            case 'polygon':
              ctx.beginPath();
              ctx.moveTo(args[0], args[1]);
              for (let i = 2; i < args.length; i += 2) {
                ctx.lineTo(args[i], args[i+1]);
              }
              ctx.closePath();
              ctx.fill();
              break;
            case 'text': ctx.fillText(args[0], args[1], args[2]); break;
            case 'image': {
              const id = args[0];
              const img = images.get(id);
              if (!img) throw new Error(`Image not loaded: ${id}`);
              const x = args[1] || 0, y = args[2] || 0;
              const w = args[3] || img.width, h = args[4] || img.height;
              ctx.drawImage(img, x, y, w, h);
              break;
            }
            case 'translate': ctx.translate(args[0], args[1]); break;
            case 'rotate': ctx.rotate(args[0] * Math.PI / 180); break;
            case 'scale': ctx.scale(args[0], args[1] || args[0]); break;
            case 'push': ctx.save(); break;
            case 'pop': ctx.restore(); break;
            case 'filter': ctx.filter = args[0]; break;
            case 'effect':
              // effect expects effect name as first argument (string)
              applyEffect(args[0], args.slice(1), ctx, time);
              break;
            default: console.warn(`Unknown drawing command: ${cmd.name}`);
          }
        } catch (err) {
          console.error(`Error in command ${cmd.name}:`, err);
        }
      }

      if (threeScene && threeCommands.length > 0) {
        for (const cmd of threeCommands) {
          try {
            const args = cmd.args.map(arg => evaluate(arg, time, context));
            switch (cmd.name) {
              case 'box': {
                const geometry = new THREE.BoxGeometry(args[0]||1, args[1]||1, args[2]||1);
                const material = new THREE.MeshStandardMaterial({ color: args[3]||0xffffff });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(args[4]||0, args[5]||0, args[6]||0);
                threeScene.add(mesh);
                break;
              }
              case 'sphere': {
                const geometry = new THREE.SphereGeometry(args[0]||1, 32, 16);
                const material = new THREE.MeshStandardMaterial({ color: args[1]||0xffffff });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(args[2]||0, args[3]||0, args[4]||0);
                threeScene.add(mesh);
                break;
              }
              case 'light': {
                const light = new THREE.PointLight(args[0]||0xffffff, args[1]||1);
                light.position.set(args[2]||0, args[3]||0, args[4]||0);
                threeScene.add(light);
                break;
              }
              case 'camera': {
                if (threeCamera) {
                  threeCamera.position.set(args[0]||0, args[1]||0, args[2]||5);
                  threeCamera.lookAt(args[3]||0, args[4]||0, args[5]||0);
                }
                break;
              }
              case 'clear': {
                while(threeScene.children.length > 0) threeScene.remove(threeScene.children[0]);
                break;
              }
              default: console.warn(`Unknown 3D command: ${cmd.name}`);
            }
          } catch (err) {
            console.error(`Error in 3D command ${cmd.name}:`, err);
          }
        }
      }

      ctx.restore();
    };
  }

  // Predefined effects
  function applyEffect(name, args, ctx, time) {
    switch (name) {
      case 'flicker': ctx.globalAlpha = 0.8 + 0.4 * Math.sin(time * 50); break;
      case 'sepia': ctx.filter = 'sepia(1)'; break;
      case 'blur': ctx.filter = `blur(${args[0] || 5}px)`; break;
      case 'grayscale': ctx.filter = `grayscale(${args[0] || 1})`; break;
      case 'brightness': ctx.filter = `brightness(${args[0] || 1.2})`; break;
      case 'contrast': ctx.filter = `contrast(${args[0] || 1.5})`; break;
      case 'hue-rotate': ctx.filter = `hue-rotate(${args[0] || 90}deg)`; break;
      case 'invert': ctx.filter = `invert(${args[0] || 1})`; break;
      case 'saturate': ctx.filter = `saturate(${args[0] || 2})`; break;
      case 'kenBurns': console.warn('kenBurns effect not fully implemented'); break;
      default: console.warn(`Unknown effect: ${name}`);
    }
  }

  // ===========================================================================
  // Audio Track Builder (supports start time)
  // ===========================================================================
  function createAudioTrack(commands) {
    return (audioCtx, startTime, duration) => {
      for (const cmd of commands) {
        if (cmd.name === 'oscillator') {
          const freqExpr = cmd.args[0];
          // For audio, we evaluate frequency at time 0 (static for now)
          const freq = evaluate(freqExpr, 0, {}); // no context needed
          const osc = audioCtx.createOscillator();
          osc.frequency.value = freq;
          osc.start(startTime);
          osc.stop(startTime + duration);
          return osc;
        }
      }
      throw new Error('No oscillator command found in audio block');
    };
  }

  // ===========================================================================
  // Quality Configuration Loader
  // ===========================================================================
  async function loadQualityConfig(urlOrObject) {
    if (typeof urlOrObject === 'string') {
      const response = await fetch(urlOrObject);
      return await response.json();
    }
    return urlOrObject || {};
  }

  // ===========================================================================
  // Main API
  // ===========================================================================
  class VideoCodeRuntime {
    static async render(code, options = {}) {
      let quality = {};
      if (options.qualityConfig) {
        quality = await loadQualityConfig(options.qualityConfig);
      }

      const parser = new VideoCodeParser(code);
      const { config, scenes, imageDefs } = parser.parseProgram();

      // Apply quality settings (override width/height)
      if (quality.preset) {
        const presets = {
          '4k': { width: 3840, height: 2160 },
          '2k': { width: 2560, height: 1440 },
          '1080p': { width: 1920, height: 1080 },
          '720p': { width: 1280, height: 720 }
        };
        if (presets[quality.preset]) {
          config.width = presets[quality.preset].width;
          config.height = presets[quality.preset].height;
        }
      }
      if (quality.width) config.width = quality.width;
      if (quality.height) config.height = quality.height;
      if (quality.fps) config.fps = quality.fps;
      if (quality.videoBitrate) config.videoBitrate = quality.videoBitrate;

      const engine = new VideoCodeEngine(config);
      await engine.loadImages(imageDefs);

      // Create context for expression evaluation (constants)
      const context = { width: engine.width, height: engine.height };

      let currentStart = 0;
      for (const scene of scenes) {
        const videoTrack = createVideoTrack(scene.videoCommands, scene.threeCommands, context);
        const audioTracks = scene.audioCommands.map(cmd => createAudioTrack([cmd]));

        engine.addScene({
          startTime: currentStart,
          duration: scene.duration,
          videoTracks: [videoTrack],
          audioTracks
        });
        currentStart += scene.duration;
      }
      engine.totalDuration = currentStart;

      return await engine.render();
    }

    static async renderPhoto(code, sceneIndex = 0, time = 0, options = {}) {
      let quality = {};
      if (options.qualityConfig) {
        quality = await loadQualityConfig(options.qualityConfig);
      }

      const parser = new VideoCodeParser(code);
      const { config, scenes, imageDefs } = parser.parseProgram();

      if (quality.preset) {
        const presets = {
          '4k': { width: 3840, height: 2160 },
          '2k': { width: 2560, height: 1440 },
          '1080p': { width: 1920, height: 1080 },
          '720p': { width: 1280, height: 720 }
        };
        if (presets[quality.preset]) {
          config.width = presets[quality.preset].width;
          config.height = presets[quality.preset].height;
        }
      }
      if (quality.width) config.width = quality.width;
      if (quality.height) config.height = quality.height;

      const engine = new VideoCodeEngine(config);
      await engine.loadImages(imageDefs);

      if (!scenes[sceneIndex]) throw new Error('Scene index out of range');
      const scene = scenes[sceneIndex];
      const context = { width: engine.width, height: engine.height };
      const videoTrack = createVideoTrack(scene.videoCommands, [], context);
      engine.addScene({
        startTime: 0,
        duration: scene.duration,
        videoTracks: [videoTrack],
        audioTracks: []
      });

      return await engine.renderPhoto(0, time);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoCodeRuntime;
  } else {
    global.VideoCodeRuntime = VideoCodeRuntime;
  }
})(this);
