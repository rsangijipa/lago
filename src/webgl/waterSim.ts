import {
  quadVertexShader,
  dropFragmentShader,
  updateFragmentShader,
  compositeFragmentShader,
} from './shaders';
import { AmbientLighting } from '../types';

export interface TexturePair {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
}

export class WebGLWaterSimulation {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  public readonly simResolution: number;

  // Shader programs
  private dropProgram!: WebGLProgram;
  private updateProgram!: WebGLProgram;
  private compositeProgram!: WebGLProgram;

  // Ping-pong framebuffers for wave propagation
  private fboA!: TexturePair;
  private fboB!: TexturePair;
  private currentReadFboIndex = 0;

  // Fullscreen quad buffer
  private quadBuffer!: WebGLBuffer;

  // Scene textures
  private underwaterTexture!: WebGLTexture;
  private skyTexture!: WebGLTexture;
  private floatingTexture!: WebGLTexture;

  // Float texture format parameters
  private internalFormat!: number;
  private format!: number;
  private texType!: number;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, simResolution = 512) {
    this.canvas = canvas;
    const gl =
      canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false }) ||
      canvas.getContext('webgl', { alpha: false, antialias: false, depth: false });

    if (!gl) {
      throw new Error('WebGL is not supported in this browser.');
    }
    this.gl = gl as WebGLRenderingContext;
    this.simResolution = simResolution;

    this.initExtensionsAndFormats();
    this.initBuffers();
    this.initShaders();
    this.initFramebuffers();
    this.initStaticTextures();
  }

  private initExtensionsAndFormats() {
    const gl = this.gl;
    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

    let hasFloatFBO = false;

    if (isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;
      const ext = gl2.getExtension('EXT_color_buffer_float');
      gl2.getExtension('OES_texture_float_linear');

      if (ext) {
        this.internalFormat = gl2.RGBA16F;
        this.format = gl2.RGBA;
        this.texType = gl2.HALF_FLOAT;
        hasFloatFBO = true;
      }
    }

    if (!hasFloatFBO) {
      const halfFloatExt = gl.getExtension('OES_texture_half_float');
      gl.getExtension('OES_texture_half_float_linear');
      if (halfFloatExt) {
        this.internalFormat = gl.RGBA;
        this.format = gl.RGBA;
        this.texType = halfFloatExt.HALF_FLOAT_OES;
        hasFloatFBO = true;
      }
    }

    if (!hasFloatFBO) {
      const floatExt = gl.getExtension('OES_texture_float');
      gl.getExtension('OES_texture_float_linear');
      if (floatExt) {
        this.internalFormat = gl.RGBA;
        this.format = gl.RGBA;
        this.texType = gl.FLOAT;
        hasFloatFBO = true;
      }
    }

    if (!hasFloatFBO) {
      // Fallback to standard 8-bit unsigned byte
      this.internalFormat = gl.RGBA;
      this.format = gl.RGBA;
      this.texType = gl.UNSIGNED_BYTE;
    }
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Unable to create shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compilation error: ' + info);
    }
    return shader;
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl;
    const vs = this.createShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram();
    if (!prog) throw new Error('Unable to create program');
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error('Program linking error: ' + info);
    }
    return prog;
  }

  private initShaders() {
    this.dropProgram = this.createProgram(quadVertexShader, dropFragmentShader);
    this.updateProgram = this.createProgram(quadVertexShader, updateFragmentShader);
    this.compositeProgram = this.createProgram(quadVertexShader, compositeFragmentShader);
  }

  private initBuffers() {
    const gl = this.gl;
    this.quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    // Two triangles covering [-1, 1] clip space
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  private createFBO(): TexturePair {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      this.internalFormat,
      this.simResolution,
      this.simResolution,
      0,
      this.format,
      this.texType,
      null
    );

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.warn('FBO status incomplete with current format, attempting unsigned byte fallback.');
      // Fallback to unsigned byte
      this.internalFormat = gl.RGBA;
      this.format = gl.RGBA;
      this.texType = gl.UNSIGNED_BYTE;
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        this.simResolution,
        this.simResolution,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );
    }

    // Clear to 0
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { texture: tex, fbo };
  }

  private initFramebuffers() {
    this.fboA = this.createFBO();
    this.fboB = this.createFBO();
    this.currentReadFboIndex = 0;
  }

  private initStaticTextures() {
    const gl = this.gl;
    const createEmptyTex = () => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return tex;
    };

    this.underwaterTexture = createEmptyTex();
    this.skyTexture = createEmptyTex();
    this.floatingTexture = createEmptyTex();
  }

  public updateUnderwaterTexture(source: HTMLCanvasElement | HTMLImageElement) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.underwaterTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  public updateSkyTexture(source: HTMLCanvasElement | HTMLImageElement) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.skyTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  public updateFloatingTexture(source: HTMLCanvasElement | HTMLImageElement) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.floatingTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  private getReadFBO(): TexturePair {
    return this.currentReadFboIndex === 0 ? this.fboA : this.fboB;
  }

  private getWriteFBO(): TexturePair {
    return this.currentReadFboIndex === 0 ? this.fboB : this.fboA;
  }

  private swapFBO() {
    this.currentReadFboIndex = 1 - this.currentReadFboIndex;
  }

  private bindQuad(program: WebGLProgram) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  }

  /**
   * Adds an organic water disturbance at relative coordinates [0, 1]
   */
  public addDrop(normX: number, normY: number, radius: number, strength: number) {
    if (this.disposed) return;
    const gl = this.gl;
    const read = this.getReadFBO();
    const write = this.getWriteFBO();

    gl.useProgram(this.dropProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, this.simResolution, this.simResolution);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.uniform1i(gl.getUniformLocation(this.dropProgram, 'u_texture'), 0);

    // Invert Y coordinate because canvas vs WebGL texture space
    gl.uniform2f(gl.getUniformLocation(this.dropProgram, 'u_center'), normX, 1.0 - normY);
    gl.uniform1f(gl.getUniformLocation(this.dropProgram, 'u_radius'), radius);
    gl.uniform1f(gl.getUniformLocation(this.dropProgram, 'u_strength'), strength);

    this.bindQuad(this.dropProgram);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.swapFBO();
  }

  /**
   * Propagates water wave equation one simulation step
   */
  public step(damping = 0.992) {
    if (this.disposed) return;
    const gl = this.gl;
    const read = this.getReadFBO();
    const write = this.getWriteFBO();

    gl.useProgram(this.updateProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, this.simResolution, this.simResolution);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.uniform1i(gl.getUniformLocation(this.updateProgram, 'u_texture'), 0);

    const delta = 1.0 / this.simResolution;
    gl.uniform2f(gl.getUniformLocation(this.updateProgram, 'u_delta'), delta, delta);
    gl.uniform1f(gl.getUniformLocation(this.updateProgram, 'u_damping'), damping);

    this.bindQuad(this.updateProgram);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.swapFBO();
  }

  /**
   * Resets water heightfield to complete calm
   */
  public clear() {
    if (this.disposed) return;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA.fbo);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB.fbo);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Renders composite water surface to canvas viewport
   */
  public render(
    canvasWidth: number,
    canvasHeight: number,
    ambient: AmbientLighting = 'day',
    refractionStrength = 0.032,
    sunlightIntensity = 0.85,
    causticsIntensity = 0.75
  ) {
    if (this.disposed) return;
    const gl = this.gl;
    const read = this.getReadFBO();

    gl.useProgram(this.compositeProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasWidth, canvasHeight);

    // Texture Unit 0: Water Heightfield
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, 'u_water'), 0);

    // Texture Unit 1: Underwater World
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.underwaterTexture);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, 'u_underwater'), 1);

    // Texture Unit 2: Sky Reflection
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.skyTexture);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, 'u_sky'), 2);

    // Texture Unit 3: Floating Elements
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.floatingTexture);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, 'u_floating'), 3);

    const delta = 1.0 / this.simResolution;
    gl.uniform2f(gl.getUniformLocation(this.compositeProgram, 'u_delta'), delta, delta);
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'u_refraction'), refractionStrength);
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'u_specular'), sunlightIntensity);
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'u_caustics'), causticsIntensity);

    // Ambient Lighting & Water Tint
    let lightDir = [0.4, 0.7, 0.6];
    let waterTint = [0.08, 0.28, 0.24]; // Lush mountain lake emerald
    let ambientCode = 0.0;

    if (ambient === 'sunset') {
      lightDir = [-0.6, 0.3, 0.4];
      waterTint = [0.26, 0.16, 0.22];
      ambientCode = 1.0;
    } else if (ambient === 'night') {
      lightDir = [0.2, 0.8, 0.5];
      waterTint = [0.03, 0.08, 0.16]; // Deep midnight sapphire
      ambientCode = 2.0;
    }

    gl.uniform3f(gl.getUniformLocation(this.compositeProgram, 'u_lightDir'), lightDir[0], lightDir[1], lightDir[2]);
    gl.uniform3f(gl.getUniformLocation(this.compositeProgram, 'u_waterTint'), waterTint[0], waterTint[1], waterTint[2]);
    gl.uniform1f(gl.getUniformLocation(this.compositeProgram, 'u_ambientMode'), ambientCode);

    this.bindQuad(this.compositeProgram);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * Releases all GPU resources owned by this simulation.
   */
  public dispose() {
    if (this.disposed) return;
    this.disposed = true;

    const gl = this.gl;
    gl.deleteProgram(this.dropProgram);
    gl.deleteProgram(this.updateProgram);
    gl.deleteProgram(this.compositeProgram);
    gl.deleteBuffer(this.quadBuffer);

    gl.deleteTexture(this.fboA.texture);
    gl.deleteFramebuffer(this.fboA.fbo);
    gl.deleteTexture(this.fboB.texture);
    gl.deleteFramebuffer(this.fboB.fbo);
    gl.deleteTexture(this.underwaterTexture);
    gl.deleteTexture(this.skyTexture);
    gl.deleteTexture(this.floatingTexture);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
}
