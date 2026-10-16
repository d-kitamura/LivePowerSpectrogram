"use strict";

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const resetButton = document.getElementById("resetButton");
const fftSizeSelect = document.getElementById("fftSizeSelect");
const windowFunctionSelect = document.getElementById("windowFunctionSelect");
const spectrogramModeSelect = document.getElementById("spectrogramModeSelect");
const frequencyRangeSelect = document.getElementById("frequencyRangeSelect");
const inputGainSlider = document.getElementById("inputGainSlider");
const inputGainValue = document.getElementById("inputGainValue");
const dbFloorSlider = document.getElementById("dbFloorSlider");
const dbFloorValue = document.getElementById("dbFloorValue");
const statusPill = document.getElementById("statusPill");
const statusText = document.getElementById("statusText");
const levelMeter = document.getElementById("levelMeter");
const levelValue = document.getElementById("levelValue");
const timeValue = document.getElementById("timeValue");
const peakValue = document.getElementById("peakValue");
const sampleRateValue = document.getElementById("sampleRateValue");
const spectrogramCaption = document.getElementById("spectrogramCaption");
const spectrogramTitle = document.getElementById("spectrogramTitle");
const colorScaleLabel = document.getElementById("colorScaleLabel");
const colorScaleCanvas = document.getElementById("colorScaleCanvas");
const colorScaleTicks = document.getElementById("colorScaleTicks");
const axisTop = document.getElementById("axisTop");
const axisMid = document.getElementById("axisMid");
const waveformCanvas = document.getElementById("waveformCanvas");
const spectrogramCanvas = document.getElementById("spectrogramCanvas");

const waveformCtx = waveformCanvas.getContext("2d", { alpha: false });
const spectrogramCtx = spectrogramCanvas.getContext("2d", { alpha: false });
const colorScaleCtx = colorScaleCanvas.getContext("2d", { alpha: false });

const DISPLAY_SECONDS = 12;
const TIME_AXIS_HEIGHT = 30;
const PLOT_BACKGROUND = "#101514";
const AXIS_BACKGROUND = "#0b0f0f";
const PROCESSOR_SIZE = 2048;
const DEFAULT_SAMPLE_RATE = 48000;
const SPECTROGRAM_MAX_DB = 0;
const KAISER_BETA = 8.6;
const TWO_PI = 2 * Math.PI;

let audioContext = null;
let mediaStream = null;
let sourceNode = null;
let inputGainNode = null;
let processorNode = null;
let silentGain = null;
let isRecording = false;
let recordingStartedAt = 0;
let elapsedBeforeStart = 0;
let sampleRate = DEFAULT_SAMPLE_RATE;
let recordedSampleCount = 0;
let waveBuffer = new Float32Array(DEFAULT_SAMPLE_RATE * DISPLAY_SECONDS);
let waveWriteIndex = 0;
let waveSampleCount = 0;
let analysisQueue = new Float32Array(0);
let analysisQueueLength = 0;
let fftSize = Number(fftSizeSelect.value);
let hopSize = fftSize / 8;
let fft = null;
let analysisWindow = new Float32Array(0);
let analysisWindowSum = 0;
let maxFrequency = Number(frequencyRangeSelect.value);
let inputGainDb = Number(inputGainSlider.value);
let dbFloor = Number(dbFloorSlider.value);
let spectrogramMode = spectrogramModeSelect.value;
let waveformX = 0;
let spectrogramX = 0;
let waveformPixelCarry = 0;
let spectrogramPixelCarry = 0;
let smoothedRms = 0;
let latestPeakFrequency = 0;
let lastTimelineDraw = 0;

class FFT {
  constructor(size) {
    if ((size & (size - 1)) !== 0) {
      throw new Error("FFT size must be a power of two.");
    }
    this.size = size;
    this.bitReversal = new Uint32Array(size);
    const bits = Math.log2(size);

    for (let i = 0; i < size; i += 1) {
      let value = i;
      let reversed = 0;
      for (let bit = 0; bit < bits; bit += 1) {
        reversed = (reversed << 1) | (value & 1);
        value >>= 1;
      }
      this.bitReversal[i] = reversed;
    }
  }

  transform(real, imag) {
    const size = this.size;
    const bitReversal = this.bitReversal;

    for (let i = 0; i < size; i += 1) {
      const j = bitReversal[i];
      if (j > i) {
        const realTemp = real[i];
        const imagTemp = imag[i];
        real[i] = real[j];
        imag[i] = imag[j];
        real[j] = realTemp;
        imag[j] = imagTemp;
      }
    }

    for (let length = 2; length <= size; length <<= 1) {
      const halfLength = length >> 1;
      const angle = (-2 * Math.PI) / length;
      const phaseStepReal = Math.cos(angle);
      const phaseStepImag = Math.sin(angle);

      for (let start = 0; start < size; start += length) {
        let phaseReal = 1;
        let phaseImag = 0;

        for (let offset = 0; offset < halfLength; offset += 1) {
          const evenIndex = start + offset;
          const oddIndex = evenIndex + halfLength;
          const oddReal =
            real[oddIndex] * phaseReal - imag[oddIndex] * phaseImag;
          const oddImag =
            real[oddIndex] * phaseImag + imag[oddIndex] * phaseReal;

          real[oddIndex] = real[evenIndex] - oddReal;
          imag[oddIndex] = imag[evenIndex] - oddImag;
          real[evenIndex] += oddReal;
          imag[evenIndex] += oddImag;

          const nextPhaseReal =
            phaseReal * phaseStepReal - phaseImag * phaseStepImag;
          phaseImag = phaseReal * phaseStepImag + phaseImag * phaseStepReal;
          phaseReal = nextPhaseReal;
        }
      }
    }
  }
}

function besselI0(value) {
  const squaredQuarter = (value * value) / 4;
  let sum = 1;
  let term = 1;

  // Convergent power series for the Kaiser window's modified Bessel function.
  for (let order = 1; order <= 50; order += 1) {
    term *= squaredQuarter / (order * order);
    sum += term;
    if (term < sum * 1e-12) break;
  }

  return sum;
}

function createAnalysisWindow(size, type) {
  const coefficients = new Float32Array(size);
  const kaiserScale = type === "kaiser" ? besselI0(KAISER_BETA) : 1;

  // Symmetric windows: both endpoints belong to the selected FFT frame.
  for (let i = 0; i < size; i += 1) {
    const position = i / (size - 1);
    const angle = 2 * Math.PI * position;

    switch (type) {
      case "rectangular":
        coefficients[i] = 1;
        break;
      case "hann":
        coefficients[i] = 0.5 * (1 - Math.cos(angle));
        break;
      case "hamming":
        coefficients[i] = 0.54 - 0.46 * Math.cos(angle);
        break;
      case "kaiser": {
        const centeredPosition = 2 * position - 1;
        coefficients[i] =
          besselI0(KAISER_BETA * Math.sqrt(Math.max(0, 1 - centeredPosition ** 2))) /
          kaiserScale;
        break;
      }
      case "blackman":
        coefficients[i] = 0.42 - 0.5 * Math.cos(angle) + 0.08 * Math.cos(2 * angle);
        break;
      default:
        throw new Error(`Unknown window function: ${type}`);
    }
  }

  return coefficients;
}

function configureAnalysis() {
  fftSize = Number(fftSizeSelect.value);
  hopSize = fftSize / 8;
  fft = new FFT(fftSize);
  analysisWindow = createAnalysisWindow(fftSize, windowFunctionSelect.value);
  analysisWindowSum = analysisWindow.reduce((sum, value) => sum + value, 0);

  analysisQueue = new Float32Array(fftSize * 3);
  analysisQueueLength = 0;
  updateLabels();
}

function configureWaveBuffer() {
  waveBuffer = new Float32Array(Math.round(sampleRate * DISPLAY_SECONDS));
  waveWriteIndex = 0;
  waveSampleCount = 0;
}

function ensureAnalysisCapacity(additionalLength) {
  const needed = analysisQueueLength + additionalLength;
  if (needed <= analysisQueue.length) return;

  let nextLength = analysisQueue.length || fftSize * 2;
  while (nextLength < needed) nextLength *= 2;

  const nextQueue = new Float32Array(nextLength);
  nextQueue.set(analysisQueue.subarray(0, analysisQueueLength));
  analysisQueue = nextQueue;
}

function appendAnalysisSamples(samples) {
  ensureAnalysisCapacity(samples.length);
  analysisQueue.set(samples, analysisQueueLength);
  analysisQueueLength += samples.length;

  while (analysisQueueLength >= fftSize) {
    processSpectrumFrame(analysisQueue.subarray(0, fftSize));
    analysisQueue.copyWithin(0, hopSize, analysisQueueLength);
    analysisQueueLength -= hopSize;
  }
}

function processSpectrumFrame(frame) {
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  for (let i = 0; i < fftSize; i += 1) {
    real[i] = frame[i] * analysisWindow[i];
  }

  fft.transform(real, imag);

  const nyquist = sampleRate / 2;
  const cappedMaxFrequency = Math.min(maxFrequency, nyquist);
  const maxBin = Math.max(
    1,
    Math.min(Math.floor((cappedMaxFrequency / sampleRate) * fftSize), fftSize / 2)
  );
  const isPhase = spectrogramMode === "phase";
  const spectrumValues = isPhase
    ? new Float64Array(maxBin + 1)
    : new Float32Array(maxBin + 1);
  let strongestDb = -Infinity;
  let strongestBin = 0;

  for (let bin = 0; bin <= maxBin; bin += 1) {
    const amplitude =
      ((bin === 0 ? 1 : 2) * Math.hypot(real[bin], imag[bin])) /
      analysisWindowSum;
    const power = amplitude * amplitude;
    const db = 10 * Math.log10(power + 1e-24);
    // Phase is undefined for a zero-magnitude bin; render it as background.
    if (isPhase) {
      spectrumValues[bin] = real[bin] === 0 && imag[bin] === 0
        ? NaN
        : wrapPhase(Math.atan2(imag[bin], real[bin]));
    } else {
      spectrumValues[bin] = db;
    }

    if (bin > 0 && db > strongestDb) {
      strongestDb = db;
      strongestBin = bin;
    }
  }

  latestPeakFrequency = (strongestBin * sampleRate) / fftSize;
  drawSpectrogramColumn(spectrumValues);
}

function appendWaveSamples(samples) {
  for (let i = 0; i < samples.length; i += 1) {
    waveBuffer[waveWriteIndex] = samples[i];
    waveWriteIndex = (waveWriteIndex + 1) % waveBuffer.length;
  }
  waveSampleCount += samples.length;

  const width = waveformCanvas.width;
  const plotHeight = getPlotHeight(waveformCanvas);
  if (!width || !plotHeight) return;

  waveformPixelCarry +=
    (samples.length / sampleRate) * (width / DISPLAY_SECONDS);
  let columns = Math.floor(waveformPixelCarry);
  waveformPixelCarry -= columns;
  if (columns <= 0) return;

  columns = Math.min(columns, width);
  const startX = prepareScrollingPlot(
    waveformCanvas,
    waveformCtx,
    waveformX,
    columns,
    PLOT_BACKGROUND
  );
  waveformX = Math.min(width, startX + columns);
  drawWaveformColumns(samples, startX, columns);
  drawTimeAxis(waveformCanvas, waveformCtx);
}

function handleAudioProcess(event) {
  const input = event.inputBuffer.getChannelData(0);
  const output = event.outputBuffer.getChannelData(0);
  output.fill(0);

  const samples = new Float32Array(input);
  recordedSampleCount += samples.length;
  appendWaveSamples(samples);
  appendAnalysisSamples(samples);
  updateInputLevel(samples);
}

function updateInputGain() {
  inputGainDb = Number(inputGainSlider.value);
  const label = `${inputGainDb > 0 ? "+" : ""}${inputGainDb} dB`;
  inputGainValue.textContent = label;
  inputGainSlider.setAttribute("aria-valuetext", label);

  if (inputGainNode && audioContext) {
    // Smooth live changes to avoid abrupt steps in the analyzed signal.
    inputGainNode.gain.setTargetAtTime(
      10 ** (inputGainDb / 20),
      audioContext.currentTime,
      0.015
    );
  }
}

function updateInputLevel(samples) {
  let sumSquares = 0;
  let peak = 0;

  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    sumSquares += sample * sample;
    const absolute = Math.abs(sample);
    if (absolute > peak) peak = absolute;
  }

  const rms = Math.sqrt(sumSquares / Math.max(1, samples.length));
  smoothedRms = smoothedRms * 0.82 + rms * 0.18;
  const db = 20 * Math.log10(smoothedRms + 1e-8);
  const percent = clamp(((db + 75) / 75) * 100, 0, 100);

  levelMeter.style.width = `${percent.toFixed(1)}%`;
  levelValue.textContent = db <= -100 ? "-inf dBFS" : `${db.toFixed(1)} dBFS`;

  if (peak > 0.98) {
    levelMeter.style.background =
      "linear-gradient(90deg, #158b7d 0%, #d8af27 50%, #c43a31 88%)";
  } else {
    levelMeter.style.background =
      "linear-gradient(90deg, #158b7d 0%, #d8af27 68%, #c43a31 100%)";
  }
}

async function startRecording() {
  if (isRecording) return;

  try {
    setStatus("Requesting microphone", false);
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });

    audioContext = new AudioContext({ latencyHint: "interactive" });
    sampleRate = audioContext.sampleRate;
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    inputGainNode = audioContext.createGain();
    inputGainNode.gain.value = 10 ** (inputGainDb / 20);
    processorNode = audioContext.createScriptProcessor(PROCESSOR_SIZE, 1, 1);
    silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    processorNode.onaudioprocess = handleAudioProcess;

    sourceNode.connect(inputGainNode);
    inputGainNode.connect(processorNode);
    processorNode.connect(silentGain);
    silentGain.connect(audioContext.destination);

    if (
      recordedSampleCount === 0 ||
      waveBuffer.length !== sampleRate * DISPLAY_SECONDS
    ) {
      configureWaveBuffer();
    }
    configureAnalysis();
    recordingStartedAt = performance.now();
    isRecording = true;

    startButton.disabled = true;
    stopButton.disabled = false;
    fftSizeSelect.disabled = false;
    frequencyRangeSelect.disabled = false;
    sampleRateValue.textContent = `${Math.round(sampleRate).toLocaleString()} Hz`;
    setStatus("Recording", true);
    requestAnimationFrame(renderLoop);
  } catch (error) {
    stopRecording();
    setStatus("Microphone unavailable", false);
    alert(`Microphone could not be started: ${error.message}`);
  }
}

function stopRecording() {
  if (isRecording) {
    elapsedBeforeStart += performance.now() - recordingStartedAt;
  }

  isRecording = false;
  startButton.disabled = false;
  stopButton.disabled = true;

  if (processorNode) {
    processorNode.disconnect();
    processorNode.onaudioprocess = null;
  }
  if (sourceNode) sourceNode.disconnect();
  if (inputGainNode) inputGainNode.disconnect();
  if (silentGain) silentGain.disconnect();
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }
  if (audioContext && audioContext.state !== "closed") {
    audioContext.close();
  }

  audioContext = null;
  mediaStream = null;
  sourceNode = null;
  inputGainNode = null;
  processorNode = null;
  silentGain = null;
  setStatus(recordedSampleCount > 0 ? "Stopped" : "Idle", false);
}

function resetRecording() {
  const wasRecording = isRecording;
  elapsedBeforeStart = 0;
  if (wasRecording) {
    recordingStartedAt = performance.now();
  }

  recordedSampleCount = 0;
  waveWriteIndex = 0;
  waveSampleCount = 0;
  waveBuffer.fill(0);
  analysisQueueLength = 0;
  waveformX = 0;
  spectrogramX = 0;
  waveformPixelCarry = 0;
  spectrogramPixelCarry = 0;
  smoothedRms = 0;
  latestPeakFrequency = 0;
  clearCanvas(waveformCanvas, waveformCtx, PLOT_BACKGROUND);
  clearCanvas(spectrogramCanvas, spectrogramCtx, PLOT_BACKGROUND);
  drawTimeAxes();
  levelMeter.style.width = "0%";
  levelValue.textContent = "-inf dBFS";
  timeValue.textContent = "00:00.0";
  peakValue.textContent = "-- Hz";
  setStatus(wasRecording ? "Recording" : "Idle", wasRecording);
}

function renderLoop(timestamp) {
  updateTime();

  if (timestamp - lastTimelineDraw >= 100) {
    drawTimeAxes();
    updatePeakLabel();
    lastTimelineDraw = timestamp;
  }

  if (isRecording) {
    requestAnimationFrame(renderLoop);
  }
}

function updateTime() {
  const elapsedMs = isRecording
    ? elapsedBeforeStart + performance.now() - recordingStartedAt
    : elapsedBeforeStart;
  timeValue.textContent = formatDuration(elapsedMs / 1000);
}

function updatePeakLabel() {
  if (latestPeakFrequency > 0) {
    peakValue.textContent =
      latestPeakFrequency >= 1000
        ? `${(latestPeakFrequency / 1000).toFixed(2)} kHz`
        : `${Math.round(latestPeakFrequency)} Hz`;
  }
}

function drawWaveformColumns(samples, startX, columns) {
  const plotHeight = getPlotHeight(waveformCanvas);
  const centerY = plotHeight / 2;
  const scaleY = plotHeight * 0.42;

  waveformCtx.save();
  waveformCtx.lineWidth = Math.max(1, window.devicePixelRatio || 1);

  for (let column = 0; column < columns; column += 1) {
    const x = startX + column;
    const sampleStart = Math.floor((column / columns) * samples.length);
    const sampleEnd = Math.max(
      sampleStart + 1,
      Math.floor(((column + 1) / columns) * samples.length)
    );
    let min = 1;
    let max = -1;

    for (
      let sampleIndex = sampleStart;
      sampleIndex < sampleEnd;
      sampleIndex += 1
    ) {
      const sample = samples[sampleIndex];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    waveformCtx.fillStyle = PLOT_BACKGROUND;
    waveformCtx.fillRect(x, 0, 1, plotHeight);
    waveformCtx.fillStyle = "rgba(255,255,255,0.16)";
    waveformCtx.fillRect(x, centerY, 1, Math.max(1, window.devicePixelRatio || 1));
    waveformCtx.strokeStyle = "#4ee0c4";
    waveformCtx.beginPath();
    waveformCtx.moveTo(x + 0.5, centerY - max * scaleY);
    waveformCtx.lineTo(x + 0.5, centerY - min * scaleY);
    waveformCtx.stroke();
  }

  waveformCtx.restore();
}

function prepareScrollingPlot(canvas, context, currentX, columns, fillStyle) {
  const width = canvas.width;
  const plotHeight = getPlotHeight(canvas);

  if (columns >= width) {
    clearPlotArea(canvas, context, fillStyle);
    return 0;
  }

  if (currentX + columns <= width) {
    return currentX;
  }

  const overflow = currentX + columns - width;
  context.drawImage(
    canvas,
    overflow,
    0,
    width - overflow,
    plotHeight,
    0,
    0,
    width - overflow,
    plotHeight
  );
  context.fillStyle = fillStyle;
  context.fillRect(width - overflow, 0, overflow, plotHeight);
  return width - columns;
}

function clearPlotArea(canvas, context, fillStyle) {
  const plotHeight = getPlotHeight(canvas);
  context.fillStyle = fillStyle;
  context.fillRect(0, 0, canvas.width, plotHeight);
}

function drawSpectrogramColumn(spectrumValues) {
  const width = spectrogramCanvas.width;
  const plotHeight = getPlotHeight(spectrogramCanvas);
  if (!width || !plotHeight || spectrumValues.length === 0) return;

  spectrogramPixelCarry += (hopSize / sampleRate) * (width / DISPLAY_SECONDS);
  let columns = Math.floor(spectrogramPixelCarry);
  spectrogramPixelCarry -= columns;
  if (columns <= 0) return;

  columns = Math.min(columns, width);
  const startX = prepareScrollingPlot(
    spectrogramCanvas,
    spectrogramCtx,
    spectrogramX,
    columns,
    PLOT_BACKGROUND
  );
  spectrogramX = Math.min(width, startX + columns);

  const imageData = spectrogramCtx.createImageData(columns, plotHeight);
  const maxIndex = spectrumValues.length - 1;
  const colorForValue = spectrogramMode === "phase" ? phaseColor : powerColor;

  for (let y = 0; y < plotHeight; y += 1) {
    const ratio = 1 - y / Math.max(1, plotHeight - 1);
    const bin = Math.min(maxIndex, Math.round(ratio * maxIndex));
    const [red, green, blue] = colorForValue(spectrumValues[bin]);

    for (let x = 0; x < columns; x += 1) {
      const offset = (y * columns + x) * 4;
      imageData.data[offset] = red;
      imageData.data[offset + 1] = green;
      imageData.data[offset + 2] = blue;
      imageData.data[offset + 3] = 255;
    }
  }

  spectrogramCtx.putImageData(imageData, startX, 0);
  drawTimeAxis(spectrogramCanvas, spectrogramCtx);
}

function powerColor(db) {
  const t = clamp((db - dbFloor) / (SPECTROGRAM_MAX_DB - dbFloor), 0, 1);
  const stops = [
    [0, 9, 16, 92],
    [0.17, 38, 85, 168],
    [0.37, 24, 157, 154],
    [0.57, 118, 196, 74],
    [0.78, 238, 191, 48],
    [1, 190, 38, 45],
  ];

  for (let i = 1; i < stops.length; i += 1) {
    const previous = stops[i - 1];
    const next = stops[i];
    if (t <= next[0]) {
      const localT = (t - previous[0]) / (next[0] - previous[0]);
      return [
        Math.round(lerp(previous[1], next[1], localT)),
        Math.round(lerp(previous[2], next[2], localT)),
        Math.round(lerp(previous[3], next[3], localT)),
      ];
    }
  }

  return [190, 38, 45];
}

function wrapPhase(phase) {
  return ((phase % TWO_PI) + TWO_PI) % TWO_PI;
}

function phaseColor(phase) {
  if (!Number.isFinite(phase)) return [16, 21, 20];

  const angle = wrapPhase(phase);
  // Smooth cyclic RGB palette: the color and its slope agree at 0 and 2π.
  return [0, TWO_PI / 3, (2 * TWO_PI) / 3].map((offset) =>
    Math.round(127.5 * (1 + Math.cos(angle - offset)))
  );
}

function updateColorScale() {
  const isPhase = spectrogramMode === "phase";
  const { width, height } = colorScaleCanvas;
  for (let x = 0; x < width; x += 1) {
    const fraction = x / (width - 1);
    const color = isPhase
      ? phaseColor(fraction * TWO_PI)
      : powerColor(dbFloor + fraction * (SPECTROGRAM_MAX_DB - dbFloor));
    colorScaleCtx.fillStyle = `rgb(${color.join(",")})`;
    colorScaleCtx.fillRect(x, 0, 1, height);
  }

  colorScaleLabel.textContent = isPhase ? "Phase (rad)" : "Power (dB)";
  const phaseTicks = ["0", "π/2", "π", "3π/2", "2π"];
  Array.from(colorScaleTicks.children).forEach((tick, index) => {
    tick.textContent = isPhase
      ? phaseTicks[index]
      : String(Number(
          (dbFloor + (index / 4) * (SPECTROGRAM_MAX_DB - dbFloor)).toFixed(1)
        ));
  });
  colorScaleCanvas.setAttribute(
    "aria-label",
    isPhase
      ? "Phase color scale: 0 to 2π radians; 0 and 2π have the same color"
      : `Power color scale: ${dbFloor} to ${SPECTROGRAM_MAX_DB} dB`
  );
}

function resizeCanvas(canvas, context, fillStyle) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const nextWidth = Math.max(1, Math.round(rect.width * ratio));
  const nextHeight = Math.max(1, Math.round(rect.height * ratio));

  if (canvas.width === nextWidth && canvas.height === nextHeight) return;

  canvas.width = nextWidth;
  canvas.height = nextHeight;
  context.imageSmoothingEnabled = false;
  clearCanvas(canvas, context, fillStyle);

  if (canvas === waveformCanvas) {
    waveformX = 0;
    waveformPixelCarry = 0;
  }

  if (canvas === spectrogramCanvas) {
    spectrogramX = 0;
    spectrogramPixelCarry = 0;
  }

  drawTimeAxis(canvas, context);
}

function clearCanvas(canvas, context, fillStyle) {
  context.fillStyle = fillStyle;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function getAxisHeight(canvas) {
  const ratio = canvas.height / Math.max(1, canvas.getBoundingClientRect().height);
  return Math.min(canvas.height - 1, Math.round(TIME_AXIS_HEIGHT * ratio));
}

function getPlotHeight(canvas) {
  return Math.max(1, canvas.height - getAxisHeight(canvas));
}

function drawTimeAxes() {
  drawTimeAxis(waveformCanvas, waveformCtx);
  drawTimeAxis(spectrogramCanvas, spectrogramCtx);
}

function drawTimeAxis(canvas, context) {
  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height) return;

  const axisHeight = getAxisHeight(canvas);
  const plotHeight = height - axisHeight;
  const elapsedSeconds = recordedSampleCount / Math.max(1, sampleRate);
  const visibleStart = Math.max(0, elapsedSeconds - DISPLAY_SECONDS);
  const visibleEnd = visibleStart + DISPLAY_SECONDS;
  const ratio = width / Math.max(1, canvas.getBoundingClientRect().width);
  const fontSize = Math.max(10, Math.round(11 * ratio));
  const tickStep = DISPLAY_SECONDS <= 12 ? 2 : 5;
  const firstTick = Math.ceil(visibleStart / tickStep) * tickStep;

  context.save();
  context.fillStyle = AXIS_BACKGROUND;
  context.fillRect(0, plotHeight, width, axisHeight);
  context.strokeStyle = "rgba(255,255,255,0.28)";
  context.lineWidth = Math.max(1, ratio);
  context.beginPath();
  context.moveTo(0, plotHeight + 0.5 * ratio);
  context.lineTo(width, plotHeight + 0.5 * ratio);
  context.stroke();

  context.fillStyle = "rgba(255,255,255,0.72)";
  context.strokeStyle = "rgba(255,255,255,0.30)";
  context.font = `${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  context.textBaseline = "top";

  for (let tick = firstTick; tick <= visibleEnd + 0.001; tick += tickStep) {
    const x = ((tick - visibleStart) / DISPLAY_SECONDS) * width;
    if (x < -1 || x > width + 1) continue;

    context.beginPath();
    context.moveTo(x, plotHeight);
    context.lineTo(x, plotHeight + 7 * ratio);
    context.stroke();

    context.textAlign =
      x < 18 * ratio ? "left" : x > width - 18 * ratio ? "right" : "center";
    context.fillText(
      formatAxisTime(tick),
      clamp(x, 2 * ratio, width - 2 * ratio),
      plotHeight + 10 * ratio
    );
  }

  context.restore();
}

function setStatus(text, recording) {
  statusText.textContent = text;
  statusPill.classList.toggle("recording", recording);
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${seconds
    .toFixed(1)
    .padStart(4, "0")}`;
}

function formatAxisTime(totalSeconds) {
  const roundedSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function updateLabels() {
  const displayMaxFrequency = Math.min(maxFrequency, sampleRate / 2);
  const rangeKhz = displayMaxFrequency / 1000;
  axisTop.textContent = `${formatKhz(rangeKhz)} kHz`;
  axisMid.textContent = `${formatKhz(rangeKhz / 2)} kHz`;
  const windowLabel = windowFunctionSelect.selectedOptions[0].textContent;
  spectrogramCaption.textContent = `${windowLabel}, ${fftSize} FFT, 0-${formatKhz(
    rangeKhz
  )} kHz`;
  const isPhase = spectrogramMode === "phase";
  spectrogramTitle.textContent = isPhase ? "Phase spectrogram" : "Power spectrogram";
  spectrogramCanvas.setAttribute(
    "aria-label", isPhase ? "Live phase spectrogram" : "Live power spectrogram"
  );
  dbFloorSlider.disabled = isPhase;
  dbFloorValue.textContent = isPhase ? "—" : `${dbFloor} dB`;
  updateColorScale();
}

function formatKhz(value) {
  return Number.isInteger(value) ? `${value}` : `${value.toFixed(1)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

startButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);
resetButton.addEventListener("click", resetRecording);

function clearSpectrogram() {
  clearCanvas(spectrogramCanvas, spectrogramCtx, PLOT_BACKGROUND);
  spectrogramX = 0;
  spectrogramPixelCarry = 0;
  drawTimeAxis(spectrogramCanvas, spectrogramCtx);
}

function handleAnalysisChange() {
  configureAnalysis();
  clearSpectrogram();
}

fftSizeSelect.addEventListener("change", handleAnalysisChange);
windowFunctionSelect.addEventListener("change", handleAnalysisChange);

spectrogramModeSelect.addEventListener("change", () => {
  spectrogramMode = spectrogramModeSelect.value;
  analysisQueueLength = 0;
  updateLabels();
  clearSpectrogram();
});

frequencyRangeSelect.addEventListener("change", () => {
  maxFrequency = Number(frequencyRangeSelect.value);
  updateLabels();
  clearSpectrogram();
});

inputGainSlider.addEventListener("input", updateInputGain);

dbFloorSlider.addEventListener("input", () => {
  dbFloor = Number(dbFloorSlider.value);
  updateLabels();
});

window.addEventListener("resize", () => {
  resizeCanvas(waveformCanvas, waveformCtx, PLOT_BACKGROUND);
  resizeCanvas(spectrogramCanvas, spectrogramCtx, PLOT_BACKGROUND);
  drawTimeAxes();
});

window.addEventListener("beforeunload", stopRecording);

updateInputGain();
configureAnalysis();
resizeCanvas(waveformCanvas, waveformCtx, PLOT_BACKGROUND);
resizeCanvas(spectrogramCanvas, spectrogramCtx, PLOT_BACKGROUND);
drawTimeAxes();
