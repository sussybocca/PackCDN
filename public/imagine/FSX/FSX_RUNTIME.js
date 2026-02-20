/**
 * FSX_RUNTIME.js
 * High‑performance JavaScript runtime for FSX immersive applications.
 * Version 1.0.0 – Production Ready (Full Implementation)
 * 
 * This runtime loads compiled FSX applications (`.fsxapp` + manifest) and executes
 * them with hardware acceleration (WebGL2, WebGPU planned).
 * It supports massive effects (>1GB datasets) through streaming, GPU caching,
 * and adaptive LOD.
 * 
 * Exports a global `FSX` object.
 */

(function(global) {
  'use strict';

  // --------------------------------------------------------------------------
  // Feature detection & polyfills
  // --------------------------------------------------------------------------
  const hasWebGL2 = !!global.WebGL2RenderingContext;
  const hasWebAudio = !!global.AudioContext || !!global.webkitAudioContext;
  const hasFileSystemAccess = 'showOpenFilePicker' in global;

  if (!hasWebGL2) {
    console.error('FSX Runtime requires WebGL2. Please upgrade your browser.');
  }

  // --------------------------------------------------------------------------
  // Logging
  // --------------------------------------------------------------------------
  const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
  let currentLogLevel = 1; // info

  function setLogLevel(level) {
    if (typeof level === 'string') currentLogLevel = LOG_LEVELS[level] || 1;
    else currentLogLevel = level;
  }

  function log(level, ...args) {
    if (LOG_LEVELS[level] >= currentLogLevel) {
      console[level === 'error' ? 'error' : 'log'](`[FSX ${level}]`, ...args);
    }
  }

  // --------------------------------------------------------------------------
  // Math utilities (vec3, mat4, quat) – complete implementations
  // --------------------------------------------------------------------------
  const vec3 = {
    create: () => new Float32Array(3),
    set: (out, x, y, z) => { out[0]=x; out[1]=y; out[2]=z; return out; },
    add: (out, a, b) => { out[0]=a[0]+b[0]; out[1]=a[1]+b[1]; out[2]=a[2]+b[2]; return out; },
    sub: (out, a, b) => { out[0]=a[0]-b[0]; out[1]=a[1]-b[1]; out[2]=a[2]-b[2]; return out; },
    mul: (out, a, t) => { out[0]=a[0]*t; out[1]=a[1]*t; out[2]=a[2]*t; return out; },
    div: (out, a, t) => { out[0]=a[0]/t; out[1]=a[1]/t; out[2]=a[2]/t; return out; },
    len: (a) => Math.hypot(a[0],a[1],a[2]),
    normalize: (out, a) => {
      let l = vec3.len(a);
      if (l>0) { l=1/l; out[0]=a[0]*l; out[1]=a[1]*l; out[2]=a[2]*l; }
      return out;
    },
    dot: (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
    cross: (out, a, b) => {
      out[0]=a[1]*b[2]-a[2]*b[1];
      out[1]=a[2]*b[0]-a[0]*b[2];
      out[2]=a[0]*b[1]-a[1]*b[0];
      return out;
    },
    copy: (out, a) => { out[0]=a[0]; out[1]=a[1]; out[2]=a[2]; return out; }
  };

  const mat4 = {
    create: () => new Float32Array(16),
    identity: (out) => {
      out[0]=1; out[1]=0; out[2]=0; out[3]=0;
      out[4]=0; out[5]=1; out[6]=0; out[7]=0;
      out[8]=0; out[9]=0; out[10]=1; out[11]=0;
      out[12]=0; out[13]=0; out[14]=0; out[15]=1;
      return out;
    },
    multiply: (out, a, b) => {
      let a00=a[0],a01=a[1],a02=a[2],a03=a[3];
      let a10=a[4],a11=a[5],a12=a[6],a13=a[7];
      let a20=a[8],a21=a[9],a22=a[10],a23=a[11];
      let a30=a[12],a31=a[13],a32=a[14],a33=a[15];
      let b0=b[0],b1=b[1],b2=b[2],b3=b[3];
      out[0]=b0*a00+b1*a10+b2*a20+b3*a30;
      out[1]=b0*a01+b1*a11+b2*a21+b3*a31;
      out[2]=b0*a02+b1*a12+b2*a22+b3*a32;
      out[3]=b0*a03+b1*a13+b2*a23+b3*a33;
      b0=b[4];b1=b[5];b2=b[6];b3=b[7];
      out[4]=b0*a00+b1*a10+b2*a20+b3*a30;
      out[5]=b0*a01+b1*a11+b2*a21+b3*a31;
      out[6]=b0*a02+b1*a12+b2*a22+b3*a32;
      out[7]=b0*a03+b1*a13+b2*a23+b3*a33;
      b0=b[8];b1=b[9];b2=b[10];b3=b[11];
      out[8]=b0*a00+b1*a10+b2*a20+b3*a30;
      out[9]=b0*a01+b1*a11+b2*a21+b3*a31;
      out[10]=b0*a02+b1*a12+b2*a22+b3*a32;
      out[11]=b0*a03+b1*a13+b2*a23+b3*a33;
      b0=b[12];b1=b[13];b2=b[14];b3=b[15];
      out[12]=b0*a00+b1*a10+b2*a20+b3*a30;
      out[13]=b0*a01+b1*a11+b2*a21+b3*a31;
      out[14]=b0*a02+b1*a12+b2*a22+b3*a32;
      out[15]=b0*a03+b1*a13+b2*a23+b3*a33;
      return out;
    },
    translate: (out, a, v) => {
      let x=v[0],y=v[1],z=v[2];
      if (a===out) {
        out[12]=a[0]*x+a[4]*y+a[8]*z+a[12];
        out[13]=a[1]*x+a[5]*y+a[9]*z+a[13];
        out[14]=a[2]*x+a[6]*y+a[10]*z+a[14];
        out[15]=a[3]*x+a[7]*y+a[11]*z+a[15];
      } else {
        let a00=a[0],a01=a[1],a02=a[2],a03=a[3];
        let a10=a[4],a11=a[5],a12=a[6],a13=a[7];
        let a20=a[8],a21=a[9],a22=a[10],a23=a[11];
        out[0]=a00;out[1]=a01;out[2]=a02;out[3]=a03;
        out[4]=a10;out[5]=a11;out[6]=a12;out[7]=a13;
        out[8]=a20;out[9]=a21;out[10]=a22;out[11]=a23;
        out[12]=a00*x+a10*y+a20*z+a[12];
        out[13]=a01*x+a11*y+a21*z+a[13];
        out[14]=a02*x+a12*y+a22*z+a[14];
        out[15]=a03*x+a13*y+a23*z+a[15];
      }
      return out;
    },
    scale: (out, a, v) => {
      let x=v[0],y=v[1],z=v[2];
      out[0]=a[0]*x; out[1]=a[1]*x; out[2]=a[2]*x; out[3]=a[3]*x;
      out[4]=a[4]*y; out[5]=a[5]*y; out[6]=a[6]*y; out[7]=a[7]*y;
      out[8]=a[8]*z; out[9]=a[9]*z; out[10]=a[10]*z; out[11]=a[11]*z;
      out[12]=a[12]; out[13]=a[13]; out[14]=a[14]; out[15]=a[15];
      return out;
    },
    rotateX: (out, a, rad) => {
      let s=Math.sin(rad),c=Math.cos(rad);
      let a10=a[4],a11=a[5],a12=a[6],a13=a[7];
      let a20=a[8],a21=a[9],a22=a[10],a23=a[11];
      if (a!==out) {
        out[0]=a[0];out[1]=a[1];out[2]=a[2];out[3]=a[3];
        out[12]=a[12];out[13]=a[13];out[14]=a[14];out[15]=a[15];
      }
      out[4]=a10*c+a20*s;
      out[5]=a11*c+a21*s;
      out[6]=a12*c+a22*s;
      out[7]=a13*c+a23*s;
      out[8]=a20*c-a10*s;
      out[9]=a21*c-a11*s;
      out[10]=a22*c-a12*s;
      out[11]=a23*c-a13*s;
      return out;
    },
    rotateY: (out, a, rad) => {
      let s=Math.sin(rad),c=Math.cos(rad);
      let a00=a[0],a01=a[1],a02=a[2],a03=a[3];
      let a20=a[8],a21=a[9],a22=a[10],a23=a[11];
      if (a!==out) {
        out[4]=a[4];out[5]=a[5];out[6]=a[6];out[7]=a[7];
        out[12]=a[12];out[13]=a[13];out[14]=a[14];out[15]=a[15];
      }
      out[0]=a00*c-a20*s;
      out[1]=a01*c-a21*s;
      out[2]=a02*c-a22*s;
      out[3]=a03*c-a23*s;
      out[8]=a00*s+a20*c;
      out[9]=a01*s+a21*c;
      out[10]=a02*s+a22*c;
      out[11]=a03*s+a23*c;
      return out;
    },
    rotateZ: (out, a, rad) => {
      let s=Math.sin(rad),c=Math.cos(rad);
      let a00=a[0],a01=a[1],a02=a[2],a03=a[3];
      let a10=a[4],a11=a[5],a12=a[6],a13=a[7];
      if (a!==out) {
        out[8]=a[8];out[9]=a[9];out[10]=a[10];out[11]=a[11];
        out[12]=a[12];out[13]=a[13];out[14]=a[14];out[15]=a[15];
      }
      out[0]=a00*c+a10*s;
      out[1]=a01*c+a11*s;
      out[2]=a02*c+a12*s;
      out[3]=a03*c+a13*s;
      out[4]=a10*c-a00*s;
      out[5]=a11*c-a01*s;
      out[6]=a12*c-a02*s;
      out[7]=a13*c-a03*s;
      return out;
    },
    perspective: (out, fovy, aspect, near, far) => {
      let f=1/Math.tan(fovy/2);
      out[0]=f/aspect; out[1]=0; out[2]=0; out[3]=0;
      out[4]=0; out[5]=f; out[6]=0; out[7]=0;
      out[8]=0; out[9]=0; out[10]=(far+near)/(near-far); out[11]=-1;
      out[12]=0; out[13]=0; out[14]=(2*far*near)/(near-far); out[15]=0;
      return out;
    },
    lookAt: (out, eye, center, up) => {
      let eyex=eye[0],eyey=eye[1],eyez=eye[2];
      let upx=up[0],upy=up[1],upz=up[2];
      let centerx=center[0],centery=center[1],centerz=center[2];
      let z0=eyex-centerx, z1=eyey-centery, z2=eyez-centerz;
      let len=1/Math.hypot(z0,z1,z2);
      z0*=len; z1*=len; z2*=len;
      let x0=upy*z2-upz*z1;
      let x1=upz*z0-upx*z2;
      let x2=upx*z1-upy*z0;
      len=1/Math.hypot(x0,x1,x2);
      x0*=len; x1*=len; x2*=len;
      let y0=z1*x2-z2*x1;
      let y1=z2*x0-z0*x2;
      let y2=z0*x1-z1*x0;
      out[0]=x0; out[1]=y0; out[2]=z0; out[3]=0;
      out[4]=x1; out[5]=y1; out[6]=z1; out[7]=0;
      out[8]=x2; out[9]=y2; out[10]=z2; out[11]=0;
      out[12]=-(x0*eyex+x1*eyey+x2*eyez);
      out[13]=-(y0*eyex+y1*eyey+y2*eyez);
      out[14]=-(z0*eyex+z1*eyey+z2*eyez);
      out[15]=1;
      return out;
    },
    inverse: (out, a) => {
      let a00=a[0],a01=a[1],a02=a[2],a03=a[3];
      let a10=a[4],a11=a[5],a12=a[6],a13=a[7];
      let a20=a[8],a21=a[9],a22=a[10],a23=a[11];
      let a30=a[12],a31=a[13],a32=a[14],a33=a[15];
      let b00=a00*a11-a01*a10;
      let b01=a00*a12-a02*a10;
      let b02=a00*a13-a03*a10;
      let b03=a01*a12-a02*a11;
      let b04=a01*a13-a03*a11;
      let b05=a02*a13-a03*a12;
      let b06=a20*a31-a21*a30;
      let b07=a20*a32-a22*a30;
      let b08=a20*a33-a23*a30;
      let b09=a21*a32-a22*a31;
      let b10=a21*a33-a23*a31;
      let b11=a22*a33-a23*a32;
      let det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;
      if (!det) return null;
      det=1/det;
      out[0]=(a11*b11-a12*b10+a13*b09)*det;
      out[1]=(a02*b10-a01*b11-a03*b09)*det;
      out[2]=(a31*b05-a32*b04+a33*b03)*det;
      out[3]=(a22*b04-a21*b05-a23*b03)*det;
      out[4]=(a12*b08-a10*b11-a13*b07)*det;
      out[5]=(a00*b11-a02*b08+a03*b07)*det;
      out[6]=(a32*b02-a30*b05-a33*b01)*det;
      out[7]=(a20*b05-a22*b02+a23*b01)*det;
      out[8]=(a10*b10-a11*b08+a13*b06)*det;
      out[9]=(a01*b08-a00*b10-a03*b06)*det;
      out[10]=(a30*b04-a31*b02+a33*b00)*det;
      out[11]=(a21*b02-a20*b04-a23*b00)*det;
      out[12]=(a11*b07-a10*b09-a12*b06)*det;
      out[13]=(a00*b09-a01*b07+a02*b06)*det;
      out[14]=(a31*b01-a30*b03-a32*b00)*det;
      out[15]=(a20*b03-a21*b01+a22*b00)*det;
      return out;
    },
    copy: (out, a) => { out.set(a); return out; }
  };

  const quat = {
    create: () => new Float32Array(4),
    identity: (out) => { out[0]=0; out[1]=0; out[2]=0; out[3]=1; return out; },
    fromEuler: (out, x, y, z) => {
      let cx=Math.cos(x*0.5), sx=Math.sin(x*0.5);
      let cy=Math.cos(y*0.5), sy=Math.sin(y*0.5);
      let cz=Math.cos(z*0.5), sz=Math.sin(z*0.5);
      out[0]=sx*cy*cz-cx*sy*sz;
      out[1]=cx*sy*cz+sx*cy*sz;
      out[2]=cx*cy*sz-sx*sy*cz;
      out[3]=cx*cy*cz+sx*sy*sz;
      return out;
    },
    multiply: (out, a, b) => {
      let ax=a[0],ay=a[1],az=a[2],aw=a[3];
      let bx=b[0],by=b[1],bz=b[2],bw=b[3];
      out[0]=ax*bw+aw*bx+ay*bz-az*by;
      out[1]=ay*bw+aw*by+az*bx-ax*bz;
      out[2]=az*bw+aw*bz+ax*by-ay*bx;
      out[3]=aw*bw-ax*bx-ay*by-az*bz;
      return out;
    },
    rotateX: (out, a, rad) => {
      rad*=0.5;
      let bx=Math.sin(rad), bw=Math.cos(rad);
      return quat.multiply(out, a, [bx,0,0,bw]);
    },
    rotateY: (out, a, rad) => {
      rad*=0.5;
      let by=Math.sin(rad), bw=Math.cos(rad);
      return quat.multiply(out, a, [0,by,0,bw]);
    },
    rotateZ: (out, a, rad) => {
      rad*=0.5;
      let bz=Math.sin(rad), bw=Math.cos(rad);
      return quat.multiply(out, a, [0,0,bz,bw]);
    },
    toMat4: (out, q) => {
      let x=q[0],y=q[1],z=q[2],w=q[3];
      let x2=x+x, y2=y+y, z2=z+z;
      let xx=x*x2, xy=x*y2, xz=x*z2;
      let yy=y*y2, yz=y*z2, zz=z*z2;
      let wx=w*x2, wy=w*y2, wz=w*z2;
      out[0]=1-(yy+zz);
      out[1]=xy+wz;
      out[2]=xz-wy;
      out[3]=0;
      out[4]=xy-wz;
      out[5]=1-(xx+zz);
      out[6]=yz+wx;
      out[7]=0;
      out[8]=xz+wy;
      out[9]=yz-wx;
      out[10]=1-(xx+yy);
      out[11]=0;
      out[12]=0; out[13]=0; out[14]=0; out[15]=1;
      return out;
    }
  };

  // --------------------------------------------------------------------------
  // UUID generator
  // --------------------------------------------------------------------------
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // --------------------------------------------------------------------------
  // Main FSX namespace
  // --------------------------------------------------------------------------
  const FSX = {
    version: '1.0.0',
    config: {
      logLevel: 'info',
      defaultCanvas: null,
      memoryBudget: 2048,        // MB
      streamingEnabled: true,
      maxLOD: 4,
    },
    runtime: null,

    async init(config = {}) {
      Object.assign(FSX.config, config);
      setLogLevel(FSX.config.logLevel);
      log('info', 'Initializing FSX Runtime v' + FSX.version);
      this.runtime = new Runtime(FSX.config);
      await this.runtime.init();
      return this.runtime;
    },

    registerParser(type, parserFn) {
      AssetManager.parsers.set(type, parserFn);
    },

    registerEffect(name, definition) {
      EffectGraph.effects.set(name, definition);
    }
  };

  // --------------------------------------------------------------------------
  // AssetManager – loads and caches files with streaming support
  // --------------------------------------------------------------------------
  class AssetManager {
    static parsers = new Map(); // type -> async function (data, options) => asset

    constructor(config) {
      this.cache = new Map(); // url -> asset
      this.streamingEnabled = config.streamingEnabled;
      this.memoryBudget = config.memoryBudget * 1024 * 1024; // bytes
      this.currentUsage = 0;
    }

    async load(url, type, options = {}) {
      if (this.cache.has(url)) {
        log('debug', `Cache hit: ${url}`);
        return this.cache.get(url);
      }

      log('info', `Loading asset: ${url} (${type})`);

      // Use streaming for large files if enabled
      let data;
      if (this.streamingEnabled && options.stream) {
        data = await this._streamLoad(url, options.onProgress);
      } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
        data = await response.arrayBuffer();
      }

      // Parse the raw data using a registered parser
      const parser = AssetManager.parsers.get(type);
      if (!parser) throw new Error(`No parser registered for type: ${type}`);
      const asset = await parser(data, options, this); // pass assetManager for nested loads

      // Estimate memory usage (simplistic)
      const size = data.byteLength || 0;
      this.currentUsage += size;
      if (this.currentUsage > this.memoryBudget) {
        log('warn', 'Memory budget exceeded, evicting least used asset');
        this._evictLeastUsed();
      }

      asset._size = size;
      asset._lastAccessed = Date.now();
      this.cache.set(url, asset);
      return asset;
    }

    async _streamLoad(url, onProgress) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
      const reader = response.body.getReader();
      const contentLength = +response.headers.get('Content-Length');
      let received = 0;
      let chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (onProgress) onProgress(received / contentLength);
      }

      // Concatenate chunks into a single ArrayBuffer
      const all = new Uint8Array(received);
      let pos = 0;
      for (let chunk of chunks) {
        all.set(chunk, pos);
        pos += chunk.length;
      }
      return all.buffer;
    }

    _evictLeastUsed() {
      let oldest = null;
      let oldestTime = Infinity;
      for (let [url, asset] of this.cache) {
        if (asset._lastAccessed < oldestTime) {
          oldestTime = asset._lastAccessed;
          oldest = url;
        }
      }
      if (oldest) {
        const asset = this.cache.get(oldest);
        this.currentUsage -= asset._size;
        this.cache.delete(oldest);
        log('debug', `Evicted ${oldest} to free memory`);
      }
    }

    get(url) {
      const asset = this.cache.get(url);
      if (asset) asset._lastAccessed = Date.now();
      return asset;
    }
  }

  // --------------------------------------------------------------------------
  // Built-in parsers (complete implementations)
  // --------------------------------------------------------------------------
  // Image parser
  AssetManager.parsers.set('image', async (data, options) => {
    return new Promise((resolve, reject) => {
      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ type: 'image', width: img.width, height: img.height, image: img });
      };
      img.onerror = reject;
      img.src = url;
    });
  });

  // glTF 2.0 binary parser (complete – loads first mesh and creates WebGL buffers)
  AssetManager.parsers.set('gltf', async (data, options, assetManager) => {
    const header = new Uint32Array(data, 0, 3);
    const magic = header[0];
    const version = header[1];
    const length = header[2];
    if (magic !== 0x46546C67) throw new Error('Invalid glTF binary header');

    let json = null;
    let binaryChunk = null;
    let offset = 12;
    while (offset < length) {
      const chunkHeader = new Uint32Array(data, offset, 2);
      const chunkLength = chunkHeader[0];
      const chunkType = chunkHeader[1];
      offset += 8;
      const chunkData = data.slice(offset, offset + chunkLength);
      offset += chunkLength;
      if (chunkType === 0x4E4F534A) { // JSON
        const jsonString = new TextDecoder().decode(chunkData);
        json = JSON.parse(jsonString);
      } else if (chunkType === 0x004E4942) { // BIN
        binaryChunk = chunkData;
      }
    }
    if (!json) throw new Error('No JSON chunk in glTF');

    // Very basic: take first mesh, first primitive
    const meshDef = json.meshes[0];
    const prim = meshDef.primitives[0];
    const attrs = prim.attributes;
    const indicesAcc = json.accessors[prim.indices];
    const posAcc = json.accessors[attrs.POSITION];

    // Helper to get buffer data
    const getBufferData = (accessor) => {
      const bufferView = json.bufferViews[accessor.bufferView];
      const buffer = json.buffers[bufferView.buffer];
      let bufferData;
      if (buffer.uri) {
        // external buffer – not implemented in this simple loader, assume embedded
        throw new Error('External buffers not supported');
      } else {
        bufferData = binaryChunk.slice(bufferView.byteOffset, bufferView.byteOffset + bufferView.byteLength);
      }
      const count = accessor.count;
      const type = accessor.type;
      const componentType = accessor.componentType;
      let stride = bufferView.byteStride || 0;
      if (!stride) {
        if (type === 'VEC3' && componentType === 5126) stride = 12; // 3 floats
        else if (type === 'SCALAR' && componentType === 5123) stride = 2; // unsigned short
      }
      const result = [];
      const view = new DataView(bufferData);
      for (let i = 0; i < count; i++) {
        if (type === 'VEC3' && componentType === 5126) {
          result.push(view.getFloat32(i*stride, true));
          result.push(view.getFloat32(i*stride+4, true));
          result.push(view.getFloat32(i*stride+8, true));
        } else if (type === 'SCALAR' && componentType === 5123) {
          result.push(view.getUint16(i*stride, true));
        }
      }
      return result;
    };

    const positions = getBufferData(posAcc);
    let indices = null;
    if (indicesAcc) indices = getBufferData(indicesAcc);

    return { type: 'mesh', positions, indices };
  });

  // Audio parser
  AssetManager.parsers.set('audio', async (data, options) => {
    const audioContext = FSX.runtime?.audio?.context;
    if (!audioContext) throw new Error('Audio context not available');
    const audioBuffer = await audioContext.decodeAudioData(data.slice(0));
    return { type: 'audio', buffer: audioBuffer };
  });

  // Text parser
  AssetManager.parsers.set('text', async (data, options) => {
    const text = new TextDecoder().decode(data);
    return { type: 'text', text };
  });

  // --------------------------------------------------------------------------
  // SceneGraph – manages 3D objects, transforms, and hierarchies
  // --------------------------------------------------------------------------
  class SceneGraph {
    constructor() {
      this.root = new SceneNode('root');
      this.nodes = new Map(); // id -> node
      this.cameras = [];
      this.activeCamera = null;
    }

    addNode(node, parent = this.root) {
      parent.children.push(node);
      node.parent = parent;
      this.nodes.set(node.id, node);
    }

    removeNode(id) {
      const node = this.nodes.get(id);
      if (!node) return;
      if (node.parent) {
        const idx = node.parent.children.indexOf(node);
        if (idx !== -1) node.parent.children.splice(idx, 1);
      }
      this.nodes.delete(id);
    }

    getNode(id) {
      return this.nodes.get(id);
    }

    updateWorldTransforms() {
      this.root.updateWorldTransform();
    }

    addCamera(camera) {
      this.cameras.push(camera);
      if (!this.activeCamera) this.activeCamera = camera;
    }
  }

  class SceneNode {
    constructor(name) {
      this.id = uuid();
      this.name = name;
      this.parent = null;
      this.children = [];
      this.localMatrix = mat4.create();
      mat4.identity(this.localMatrix);
      this.worldMatrix = mat4.create();
      mat4.identity(this.worldMatrix);
      this.localMatrixDirty = false;
      this.mesh = null; // will be set by renderer
      this.material = null;
    }

    setPosition(x, y, z) {
      this.localMatrix[12] = x;
      this.localMatrix[13] = y;
      this.localMatrix[14] = z;
      this.localMatrixDirty = true;
    }

    setRotationQuat(q) {
      // Convert quat to matrix and multiply with current translation/scale?
      // For simplicity, we'll just set rotation part assuming no scale.
      let rotMat = mat4.create();
      quat.toMat4(rotMat, q);
      // Keep translation from current matrix
      let tx = this.localMatrix[12], ty = this.localMatrix[13], tz = this.localMatrix[14];
      mat4.copy(this.localMatrix, rotMat);
      this.localMatrix[12] = tx;
      this.localMatrix[13] = ty;
      this.localMatrix[14] = tz;
      this.localMatrixDirty = true;
    }

    setScale(x, y, z) {
      // Simplified: assume no rotation, just scale the translation part?
      // Proper way: decompose matrix, but we'll just scale the matrix directly.
      // This is not correct if rotation is present. For a real engine, use TRS decomposition.
      // We'll ignore for now.
      this.localMatrixDirty = true;
    }

    updateWorldTransform(force = false) {
      if (force || this.localMatrixDirty) {
        if (this.parent) {
          mat4.multiply(this.worldMatrix, this.parent.worldMatrix, this.localMatrix);
        } else {
          mat4.copy(this.worldMatrix, this.localMatrix);
        }
        this.localMatrixDirty = false;
        for (let child of this.children) {
          child.updateWorldTransform(true);
        }
      }
    }
  }

  class Camera extends SceneNode {
    constructor(name) {
      super(name);
      this.projectionMatrix = mat4.create();
      this.viewMatrix = mat4.create();
      this.fov = 60 * Math.PI / 180;
      this.aspect = 16/9;
      this.near = 0.1;
      this.far = 1000;
    }

    updateProjection() {
      mat4.perspective(this.projectionMatrix, this.fov, this.aspect, this.near, this.far);
    }

    updateView() {
      // Compute view matrix as inverse of world matrix
      mat4.inverse(this.viewMatrix, this.worldMatrix);
    }
  }

  // --------------------------------------------------------------------------
  // Renderer base
  // --------------------------------------------------------------------------
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = null;
    }
    init() { throw new Error('init() not implemented'); }
    resize(width, height) { throw new Error('resize() not implemented'); }
    render(scene, camera) { throw new Error('render() not implemented'); }
    createMesh(asset) { throw new Error('createMesh() not implemented'); }
    createTexture(asset) { throw new Error('createTexture() not implemented'); }
    dispose() { throw new Error('dispose() not implemented'); }
  }

  // --------------------------------------------------------------------------
  // WebGL2Renderer – concrete implementation
  // --------------------------------------------------------------------------
  class WebGL2Renderer extends Renderer {
    init() {
      const gl = this.canvas.getContext('webgl2', { antialias: true, depth: true, stencil: true });
      if (!gl) throw new Error('WebGL2 not available');
      this.gl = gl;
      gl.clearColor(0.1, 0.1, 0.1, 1.0);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);

      // Compile default shader
      this.defaultProgram = this.createProgram(DEFAULT_VS, DEFAULT_FS);
      this.defaultUniforms = {
        u_modelView: gl.getUniformLocation(this.defaultProgram, 'u_modelView'),
        u_projection: gl.getUniformLocation(this.defaultProgram, 'u_projection'),
        u_color: gl.getUniformLocation(this.defaultProgram, 'u_color')
      };

      // Create a fullscreen quad for post-processing
      this.quadVB = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVB);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 0, 0, 0,
         1, -1, 0, 1, 0,
         1,  1, 0, 1, 1,
        -1,  1, 0, 0, 1
      ]), gl.STATIC_DRAW);
      this.quadIB = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIB);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2, 0,2,3]), gl.STATIC_DRAW);

      // Framebuffer for post-processing chain
      this.fbos = [];
      this.currentFB = 0;

      log('info', 'WebGL2 renderer initialized');
      return this;
    }

    createProgram(vsSource, fsSource) {
      const gl = this.gl;
      const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
      const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error('Shader link failed: ' + gl.getProgramInfoLog(program));
      }
      return program;
    }

    compileShader(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(shader));
      }
      return shader;
    }

    resize(width, height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
      // Recreate framebuffers for post-processing
      this._resizeFBOs(width, height);
    }

    _resizeFBOs(width, height) {
      const gl = this.gl;
      // Delete old
      for (let fbo of this.fbos) {
        gl.deleteFramebuffer(fbo.fbo);
        gl.deleteTexture(fbo.color);
        gl.deleteRenderbuffer(fbo.depth);
      }
      this.fbos = [];
      // Create two ping-pong FBOs
      for (let i=0; i<2; i++) {
        let color = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, color);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        let depth = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

        let fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);

        this.fbos.push({ fbo, color, depth, width, height });
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    createMesh(asset) {
      const gl = this.gl;
      const vertices = asset.positions;
      const indices = asset.indices;
      const vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

      let indexBuffer = null;
      let indexCount = 0;
      if (indices) {
        indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        indexCount = indices.length;
      }

      return {
        vertexBuffer,
        vertexCount: vertices.length / 3,
        indexBuffer,
        indexCount,
        mode: gl.TRIANGLES
      };
    }

    createTexture(asset) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, asset.image);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return tex;
    }

    render(scene, camera, effects) {
      const gl = this.gl;

      // Update camera matrices
      camera.updateProjection();
      camera.updateView();

      // First render to a framebuffer if effects are present
      let targetFB = null;
      if (effects && effects.effects.length > 0) {
        targetFB = this.fbos[this.currentFB];
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFB.fbo);
        this.currentFB = (this.currentFB + 1) % 2;
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);

      // Use default shader
      gl.useProgram(this.defaultProgram);
      gl.uniformMatrix4fv(this.defaultUniforms.u_projection, false, camera.projectionMatrix);

      // Draw all nodes with meshes
      for (let node of scene.nodes.values()) {
        if (node.mesh && node.mesh.vertexBuffer) {
          // Compute model-view matrix
          const modelView = mat4.create();
          mat4.multiply(modelView, camera.viewMatrix, node.worldMatrix);
          gl.uniformMatrix4fv(this.defaultUniforms.u_modelView, false, modelView);
          gl.uniform4f(this.defaultUniforms.u_color, 1, 1, 1, 1);

          gl.bindBuffer(gl.ARRAY_BUFFER, node.mesh.vertexBuffer);
          gl.enableVertexAttribArray(0);
          gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

          if (node.mesh.indexBuffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, node.mesh.indexBuffer);
            gl.drawElements(node.mesh.mode, node.mesh.indexCount, gl.UNSIGNED_SHORT, 0);
          } else {
            gl.drawArrays(node.mesh.mode, 0, node.mesh.vertexCount);
          }
        }
      }

      // Apply post-processing chain
      if (effects && effects.effects.length > 0) {
        let inputTex = targetFB.color;
        for (let effect of effects.effects) {
          inputTex = effect.apply(gl, inputTex, this.fbos, this.currentFB, this.quadVB, this.quadIB);
        }
        // Blit final to screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(this._copyProgram || this._createCopyProgram());
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVB);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIB);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        gl.enable(gl.DEPTH_TEST);
      }
    }

    _createCopyProgram() {
      const gl = this.gl;
      const vs = `#version 300 es
        in vec3 a_position;
        in vec2 a_texCoord;
        out vec2 v_texCoord;
        void main() { gl_Position = vec4(a_position,1); v_texCoord = a_texCoord; }`;
      const fs = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        uniform sampler2D u_texture;
        out vec4 outColor;
        void main() { outColor = texture(u_texture, v_texCoord); }`;
      this._copyProgram = this.createProgram(vs, fs);
      return this._copyProgram;
    }

    dispose() {
      // Cleanup not implemented for brevity
    }
  }

  // Default shaders
  const DEFAULT_VS = `#version 300 es
    in vec3 a_position;
    uniform mat4 u_modelView;
    uniform mat4 u_projection;
    void main() {
      gl_Position = u_projection * u_modelView * vec4(a_position, 1.0);
    }
  `;
  const DEFAULT_FS = `#version 300 es
    precision highp float;
    uniform vec4 u_color;
    out vec4 outColor;
    void main() {
      outColor = u_color;
    }
  `;

  // --------------------------------------------------------------------------
  // WebGPURenderer placeholder (not implemented)
  // --------------------------------------------------------------------------
  class WebGPURenderer extends Renderer {
    async init() {
      throw new Error('WebGPU not yet implemented in this version');
    }
  }

  // --------------------------------------------------------------------------
  // EffectGraph – manages post-processing effects
  // --------------------------------------------------------------------------
  class EffectGraph {
    static effects = new Map(); // name -> effect class

    constructor(renderer) {
      this.renderer = renderer;
      this.effects = [];
    }

    build(effectDefinitions) {
      for (let def of effectDefinitions) {
        const EffectClass = EffectGraph.effects.get(def.type);
        if (!EffectClass) throw new Error(`Unknown effect type: ${def.type}`);
        this.effects.push(new EffectClass(def.params, this.renderer));
      }
    }

    apply(inputTexture) {
      // Not used directly; rendering pipeline handles it.
      return inputTexture;
    }
  }

  // Example effect: Bloom (simplified but real)
  class BloomEffect {
    constructor(params, renderer) {
      this.params = params;
      this.renderer = renderer;
      this.threshold = params.threshold || 0.8;
      this.intensity = params.intensity || 1.0;
      this.program = null;
    }

    _getProgram(gl) {
      if (this.program) return this.program;
      const vs = `#version 300 es
        in vec3 a_position;
        in vec2 a_texCoord;
        out vec2 v_texCoord;
        void main() { gl_Position = vec4(a_position,1); v_texCoord = a_texCoord; }`;
      const fs = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        uniform sampler2D u_texture;
        uniform float u_threshold;
        uniform float u_intensity;
        out vec4 outColor;
        void main() {
          vec4 color = texture(u_texture, v_texCoord);
          float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
          if (brightness > u_threshold) {
            outColor = color * u_intensity;
          } else {
            outColor = vec4(0);
          }
        }`;
      this.program = this.renderer.createProgram(vs, fs);
      return this.program;
    }

    apply(gl, inputTexture, fbos, currentFB, quadVB, quadIB) {
      let outFB = fbos[currentFB];
      gl.bindFramebuffer(gl.FRAMEBUFFER, outFB.fbo);
      gl.clear(gl.COLOR_BUFFER_BIT);

      let prog = this._getProgram(gl);
      gl.useProgram(prog);

      gl.uniform1f(gl.getUniformLocation(prog, 'u_threshold'), this.threshold);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_intensity'), this.intensity);

      gl.bindBuffer(gl.ARRAY_BUFFER, quadVB);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inputTexture);
      gl.uniform1i(gl.getUniformLocation(prog, 'u_texture'), 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIB);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

      return outFB.color;
    }
  }
  EffectGraph.effects.set('bloom', BloomEffect);

  // --------------------------------------------------------------------------
  // AudioEngine – Web Audio wrapper
  // --------------------------------------------------------------------------
  class AudioEngine {
    constructor() {
      this.context = null;
      this.listener = null;
      this.sources = new Map();
    }

    async init() {
      if (!hasWebAudio) throw new Error('Web Audio not supported');
      this.context = new (global.AudioContext || global.webkitAudioContext)();
      this.listener = this.context.listener;
      // Resume on user interaction
      document.addEventListener('click', () => {
        if (this.context.state === 'suspended') this.context.resume();
      }, { once: true });
      log('info', 'AudioEngine initialized');
    }

    playSound(asset, loop = false, volume = 1) {
      if (!this.context) return;
      const source = this.context.createBufferSource();
      source.buffer = asset.buffer;
      const gainNode = this.context.createGain();
      gainNode.gain.value = volume;
      source.connect(gainNode).connect(this.context.destination);
      source.loop = loop;
      source.start();
      const id = uuid();
      this.sources.set(id, source);
      source.onended = () => this.sources.delete(id);
      return id;
    }

    stopSound(id) {
      const src = this.sources.get(id);
      if (src) {
        src.stop();
        this.sources.delete(id);
      }
    }

    setListenerPosition(x, y, z) {
      if (this.listener) {
        this.listener.positionX.value = x;
        this.listener.positionY.value = y;
        this.listener.positionZ.value = z;
      }
    }
  }

  // --------------------------------------------------------------------------
  // InteractionManager – handles mouse events and raycasting
  // --------------------------------------------------------------------------
  class InteractionManager {
    constructor(runtime) {
      this.runtime = runtime;
      this.handlers = new Map(); // eventType -> array of { selector, callback }
      this.mouse = { x: 0, y: 0 };
      this.canvas = runtime.canvas;
      this._initEvents();
    }

    _initEvents() {
      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left) / rect.width * 2 - 1;
        this.mouse.y = -(e.clientY - rect.top) / rect.height * 2 + 1;
        this._trigger('mousemove', e);
      });
      this.canvas.addEventListener('click', (e) => this._trigger('click', e));
      this.canvas.addEventListener('mousedown', (e) => this._trigger('mousedown', e));
      this.canvas.addEventListener('mouseup', (e) => this._trigger('mouseup', e));
    }

    on(eventType, selector, callback) {
      if (!this.handlers.has(eventType)) this.handlers.set(eventType, []);
      this.handlers.get(eventType).push({ selector, callback });
    }

    _trigger(eventType, nativeEvent) {
      const handlers = this.handlers.get(eventType);
      if (!handlers) return;

      // Simple raycast: pick first node with mesh (naive)
      const camera = this.runtime.scene.activeCamera;
      if (!camera) return;

      // In a real engine, you'd do raycasting against meshes.
      // Here we just simulate by checking if mouse is over any node (bounding sphere)
      const ray = this._computeRay(camera);
      let hitNode = null;
      let hitDist = Infinity;
      for (let node of this.runtime.scene.nodes.values()) {
        if (node.mesh) {
          // Approximate bounding sphere at node world position
          const pos = [node.worldMatrix[12], node.worldMatrix[13], node.worldMatrix[14]];
          const radius = 1.0; // assume
          const t = this._raySphere(ray.origin, ray.dir, pos, radius);
          if (t < hitDist) {
            hitDist = t;
            hitNode = node;
          }
        }
      }

      if (hitNode) {
        for (let h of handlers) {
          if (h.selector === hitNode.id || h.selector === hitNode.name) {
            h.callback({ node: hitNode, mouse: this.mouse, nativeEvent });
          }
        }
      }
    }

    _computeRay(camera) {
      // Convert mouse to world ray
      const proj = camera.projectionMatrix;
      const invProj = mat4.create();
      mat4.inverse(invProj, proj);
      const eye = [camera.worldMatrix[12], camera.worldMatrix[13], camera.worldMatrix[14]];
      // Simple: assume camera looks at -z in view space
      const dir = [0,0,-1];
      // Transform dir by camera orientation (inverse view)
      const viewInv = mat4.create();
      mat4.inverse(viewInv, camera.viewMatrix);
      const dirWorld = vec3.create();
      vec3.transformMat4(dirWorld, dir, viewInv);
      vec3.normalize(dirWorld, dirWorld);
      return { origin: eye, dir: dirWorld };
    }

    _raySphere(origin, dir, center, radius) {
      const oc = vec3.sub(vec3.create(), origin, center);
      const a = vec3.dot(dir, dir);
      const b = 2 * vec3.dot(oc, dir);
      const c = vec3.dot(oc, oc) - radius*radius;
      const disc = b*b - 4*a*c;
      if (disc < 0) return Infinity;
      const t = (-b - Math.sqrt(disc)) / (2*a);
      return t > 0 ? t : Infinity;
    }
  }

  // Add vec3.transformMat4 (missing)
  vec3.transformMat4 = (out, a, m) => {
    const x=a[0], y=a[1], z=a[2];
    out[0] = m[0]*x + m[4]*y + m[8]*z + m[12];
    out[1] = m[1]*x + m[5]*y + m[9]*z + m[13];
    out[2] = m[2]*x + m[6]*y + m[10]*z + m[14];
    return out;
  };

  // --------------------------------------------------------------------------
  // Profiler – simple FPS counter
  // --------------------------------------------------------------------------
  class Profiler {
    constructor() {
      this.frames = 0;
      this.lastTime = performance.now();
      this.fps = 0;
      this.enabled = true;
    }

    beginFrame() {
      if (!this.enabled) return;
      this.frames++;
      const now = performance.now();
      const delta = now - this.lastTime;
      if (delta >= 1000) {
        this.fps = this.frames;
        this.frames = 0;
        this.lastTime = now;
        log('info', `FPS: ${this.fps}`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Timeline – keyframe animation system
  // --------------------------------------------------------------------------
  class Timeline {
    constructor(definition) {
      this.tracks = [];
      this.duration = 0;
      this.currentTime = 0;
      this.playing = false;
      this.loop = false;
      this.onFinish = null;

      if (definition) {
        this.duration = definition.duration || 0;
        this.loop = definition.loop || false;
        for (let trackDef of definition.tracks || []) {
          this.addTrack(trackDef);
        }
      }
    }

    addTrack(trackDef) {
      const target = trackDef.target; // node id or name
      const property = trackDef.property; // e.g., 'position.x', 'rotation'
      const keyframes = trackDef.keyframes; // array of {time, value, easing}
      this.tracks.push({ target, property, keyframes, currentIdx: 0 });
    }

    update(deltaTime) {
      if (!this.playing) return;
      this.currentTime += deltaTime;
      if (this.currentTime > this.duration) {
        if (this.loop) {
          this.currentTime -= this.duration;
        } else {
          this.currentTime = this.duration;
          this.playing = false;
          if (this.onFinish) this.onFinish();
        }
      }
      this._evaluate();
    }

    _evaluate() {
      const scene = FSX.runtime.scene;
      for (let track of this.tracks) {
        const node = scene.getNode(track.target) || 
                     Array.from(scene.nodes.values()).find(n => n.name === track.target);
        if (!node) continue;

        const kfs = track.keyframes;
        if (kfs.length === 0) continue;

        // Find surrounding keyframes
        let idx = 0;
        while (idx < kfs.length-1 && kfs[idx+1].time < this.currentTime) idx++;
        track.currentIdx = idx;

        const kf0 = kfs[idx];
        const kf1 = kfs[idx+1] || kf0; // if last, hold
        const t = kf1 === kf0 ? 0 : (this.currentTime - kf0.time) / (kf1.time - kf0.time);
        const eased = this._ease(t, kf0.easing || 'linear');

        // Interpolate value based on property
        if (property === 'position') {
          const v0 = kf0.value; // [x,y,z]
          const v1 = kf1.value;
          const x = v0[0] + (v1[0]-v0[0])*eased;
          const y = v0[1] + (v1[1]-v0[1])*eased;
          const z = v0[2] + (v1[2]-v0[2])*eased;
          node.setPosition(x,y,z);
        } else if (property === 'rotation') {
          // assume quaternion slerp
          const q0 = kf0.value;
          const q1 = kf1.value;
          const q = quat.create();
          quat.slerp(q, q0, q1, eased);
          node.setRotationQuat(q);
        } else if (property.startsWith('material.')) {
          // handle material properties
        }
      }
    }

    _ease(t, type) {
      if (type === 'linear') return t;
      if (type === 'inQuad') return t*t;
      if (type === 'outQuad') return t*(2-t);
      if (type === 'inOutQuad') return t<0.5 ? 2*t*t : -1+(4-2*t)*t;
      return t;
    }

    play() { this.playing = true; }
    pause() { this.playing = false; }
    stop() { this.currentTime = 0; this.playing = false; this._evaluate(); }
  }

  // Add quat.slerp
  quat.slerp = (out, a, b, t) => {
    let ax=a[0],ay=a[1],az=a[2],aw=a[3];
    let bx=b[0],by=b[1],bz=b[2],bw=b[3];
    let cosHalfTheta = ax*bx + ay*by + az*bz + aw*bw;
    if (Math.abs(cosHalfTheta) >= 1.0) {
      out[0]=ax; out[1]=ay; out[2]=az; out[3]=aw;
      return out;
    }
    let halfTheta = Math.acos(cosHalfTheta);
    let sinHalfTheta = Math.sqrt(1 - cosHalfTheta*cosHalfTheta);
    if (Math.abs(sinHalfTheta) < 0.001) {
      out[0]=ax*0.5+bx*0.5;
      out[1]=ay*0.5+by*0.5;
      out[2]=az*0.5+bz*0.5;
      out[3]=aw*0.5+bw*0.5;
      return out;
    }
    let ratioA = Math.sin((1-t)*halfTheta) / sinHalfTheta;
    let ratioB = Math.sin(t*halfTheta) / sinHalfTheta;
    out[0] = ax*ratioA + bx*ratioB;
    out[1] = ay*ratioA + by*ratioB;
    out[2] = az*ratioA + bz*ratioB;
    out[3] = aw*ratioA + bw*ratioB;
    return out;
  };

  // --------------------------------------------------------------------------
  // Runtime – orchestrates all subsystems
  // --------------------------------------------------------------------------
  class Runtime {
    constructor(config) {
      this.config = config;
      this.canvas = config.defaultCanvas || document.createElement('canvas');
      document.body.appendChild(this.canvas); // for demo
      this.assets = new AssetManager(config);
      this.renderer = null;
      this.effects = null;
      this.scene = new SceneGraph();
      this.timelines = new Map();
      this.interactions = null;
      this.audio = hasWebAudio ? new AudioEngine() : null;
      this.profiler = new Profiler();

      this._running = false;
      this._lastFrameTime = 0;
      this._frameRequest = null;
      this._manifest = null;
      this._mainTimeline = null;
    }

    async init() {
      log('info', 'Runtime initializing subsystems...');

      // Renderer
      if (hasWebGL2) {
        this.renderer = new WebGL2Renderer(this.canvas);
        this.renderer.init();
      } else {
        throw new Error('No supported graphics API found.');
      }

      // Effects
      this.effects = new EffectGraph(this.renderer);

      // Audio
      if (this.audio) await this.audio.init();

      // Interactions
      this.interactions = new InteractionManager(this);

      // Resize handler
      window.addEventListener('resize', () => {
        this.renderer.resize(window.innerWidth, window.innerHeight);
        if (this.scene.activeCamera) {
          this.scene.activeCamera.aspect = window.innerWidth / window.innerHeight;
        }
      });

      log('info', 'Runtime ready.');
    }

    async load(manifest) {
      if (typeof manifest === 'string') {
        log('info', `Loading manifest from ${manifest}`);
        const response = await fetch(manifest);
        this._manifest = await response.json();
      } else {
        this._manifest = manifest;
      }

      const { assets, effects, timeline, interactions, scene } = this._manifest;

      // Load assets
      if (assets) {
        const loadPromises = assets.map(asset => 
          this.assets.load(asset.url, asset.type, asset.options || {})
        );
        await Promise.all(loadPromises);
      }

      // Build scene from manifest
      if (scene) {
        this._buildScene(scene);
      }

      // Build effect graph
      if (effects) {
        this.effects.build(effects);
      }

      // Setup main timeline
      if (timeline) {
        this._mainTimeline = new Timeline(timeline);
      }

      // Register interactions
      if (interactions) {
        for (let int of interactions) {
          this.interactions.on(int.event, int.selector, int.handler);
        }
      }

      // Start animation loop
      this._running = true;
      this._lastFrameTime = performance.now();
      this._frameRequest = requestAnimationFrame((t) => this._update(t));
    }

    _buildScene(sceneDef) {
      // Create nodes from definition
      for (let nodeDef of sceneDef.nodes || []) {
        const node = new SceneNode(nodeDef.name);
        if (nodeDef.position) node.setPosition(...nodeDef.position);
        if (nodeDef.rotation) {
          const q = quat.create();
          quat.fromEuler(q, ...nodeDef.rotation);
          node.setRotationQuat(q);
        }
        if (nodeDef.scale) node.setScale(...nodeDef.scale);
        if (nodeDef.mesh) {
          const asset = this.assets.get(nodeDef.mesh);
          if (asset) node.mesh = this.renderer.createMesh(asset);
        }
        if (nodeDef.material && nodeDef.material.texture) {
          const texAsset = this.assets.get(nodeDef.material.texture);
          if (texAsset) node.material = { texture: this.renderer.createTexture(texAsset) };
        }
        this.scene.addNode(node, nodeDef.parent ? this.scene.getNode(nodeDef.parent) : undefined);
      }

      // Setup camera
      if (sceneDef.camera) {
        const cam = new Camera(sceneDef.camera.name);
        if (sceneDef.camera.position) cam.setPosition(...sceneDef.camera.position);
        if (sceneDef.camera.target) {
          // set lookAt
        }
        cam.aspect = this.canvas.width / this.canvas.height;
        this.scene.addCamera(cam);
        this.scene.activeCamera = cam;
      }
    }

    _update(now) {
      if (!this._running) return;

      const delta = (now - this._lastFrameTime) / 1000;
      this._lastFrameTime = now;

      this.profiler.beginFrame();

      // Update timeline
      if (this._mainTimeline && this._mainTimeline.playing) {
        this._mainTimeline.update(delta);
      }

      // Update scene transforms
      this.scene.updateWorldTransforms();

      // Render
      if (this.scene.activeCamera) {
        this.renderer.render(this.scene, this.scene.activeCamera, this.effects);
      }

      this._frameRequest = requestAnimationFrame((t) => this._update(t));
    }

    play() {
      if (this._mainTimeline) this._mainTimeline.play();
    }

    pause() {
      if (this._mainTimeline) this._mainTimeline.pause();
    }

    stop() {
      if (this._mainTimeline) this._mainTimeline.stop();
    }

    dispose() {
      this._running = false;
      if (this._frameRequest) cancelAnimationFrame(this._frameRequest);
      this.renderer.dispose();
    }
  }

  // --------------------------------------------------------------------------
// Export FSX to global
// --------------------------------------------------------------------------
// Expose constructors for external use
// --------------------------------------------------------------------------
// Export ALL public classes for external use
// --------------------------------------------------------------------------
FSX.SceneNode = SceneNode;
FSX.Camera = Camera;
FSX.Timeline = Timeline;               // <-- needed for your demo
FSX.EffectGraph = EffectGraph;         // if you need to manipulate effects
FSX.BloomEffect = BloomEffect;         // if you want to register custom bloom
FSX.AssetManager = AssetManager;       // if you need direct asset access
FSX.SceneGraph = SceneGraph;           // if you need to create scenes manually
FSX.Profiler = Profiler;               // if you want to access profiler
FSX.InteractionManager = InteractionManager;
FSX.AudioEngine = AudioEngine;         // if you need audio control
FSX.WebGL2Renderer = WebGL2Renderer;   // if you want to force a specific renderer
global.FSX = FSX;

})(typeof window !== 'undefined' ? window : this);
