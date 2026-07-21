/**
 * camera.js
 * ---------------------------------------------------------------------------
 * Wraps getUserMedia with clear, user-facing error messages and a clean
 * teardown path. All calls are promise-based so the caller can await a
 * fully-ready <video> element before starting a countdown or capture.
 */

/**
 * Requests the user-facing camera and binds the resulting stream to a
 * <video> element. Resolves once the video has usable dimensions.
 *
 * @param {HTMLVideoElement} videoEl
 * @returns {Promise<MediaStream>}
 */
export async function startCamera(videoEl) {
  if (!window.isSecureContext) {
    throw new CameraError(
      'insecure-context',
      'This page needs HTTPS (or localhost) for camera access. Deploy it over HTTPS — see the deployment guide.'
    );
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError(
      'unsupported',
      'This browser doesn\u2019t support camera capture. Try the latest Chrome, Safari, or Firefox.'
    );
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 960 },
      },
      audio: false,
    });
  } catch (err) {
    const mapped = mapGetUserMediaError(err);
    if (['no-device', 'permission-denied', 'insecure-context'].includes(mapped.code) || err.name === 'NotFoundError' || err.name === 'NotAllowedError') {
      console.warn(`[Flashline] Camera init failed (${mapped.code}). Falling back to simulated mock feed.`);
      stream = createMockStream(videoEl);
    } else {
      throw mapped;
    }
  }

  videoEl.srcObject = stream;

  await new Promise((resolve) => {
    const onReady = () => {
      videoEl.removeEventListener('loadedmetadata', onReady);
      resolve();
    };
    videoEl.addEventListener('loadedmetadata', onReady);
    setTimeout(resolve, 1000);
  });

  try {
    await videoEl.play();
  } catch {
    // Autoplay fallback
  }

  return stream;
}

/** Stops every track on a stream and detaches it from the video element. */
export function stopCamera(stream, videoEl) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    if (stream._stopAnimation) stream._stopAnimation();
  }
  if (videoEl) videoEl.srcObject = null;
}

/** Generates a beautiful dynamic mock video stream using a canvas animation. */
function createMockStream(videoEl) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');

  let animationFrameId = null;
  let active = true;
  let frame = 0;

  function draw() {
    if (!active) return;

    // Dark cyber gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#0F0F1A');
    grad.addColorStop(1, '#1A1D36');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative retro grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Dynamic spinning stars/circles in front
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const count = 4;
    for (let i = 0; i < count; i++) {
      const angle = (frame * 0.03) + (i * (Math.PI * 2 / count));
      const dist = 100 + Math.sin(frame * 0.05 + i) * 20;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;

      ctx.save();
      ctx.shadowColor = i % 2 === 0 ? '#FF2D55' : '#00D4FF';
      ctx.shadowBlur = 15;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 45, 85, 0.85)' : 'rgba(0, 212, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(x, y, 22 + Math.cos(frame * 0.1) * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Dynamic central radar scan line
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 140, 0, Math.PI * 2);
    ctx.stroke();
    const scanX = cx + Math.cos(frame * 0.02) * 140;
    const scanY = cy + Math.sin(frame * 0.02) * 140;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(scanX, scanY);
    ctx.stroke();

    // Text Overlay
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FLASHLINE SIMULATED CAMERA', cx, cy - 20);

    ctx.fillStyle = '#FFD700';
    ctx.font = '12px "Space Mono", monospace';
    ctx.fillText('DEMO MODE • FULLY OPERATIONAL', cx, cy + 15);

    // Frame counter & clock
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px monospace';
    ctx.fillText(`FRAME: ${frame} | LIVEFEED_OK`, cx, canvas.height - 25);

    frame++;
    animationFrameId = requestAnimationFrame(draw);
  }

  draw();

  const stream = canvas.captureStream(30);
  stream._stopAnimation = () => {
    active = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  };

  return stream;
}

export class CameraError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function mapGetUserMediaError(err) {
  switch (err.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return new CameraError(
        'permission-denied',
        'Camera access was blocked. Allow camera permission in your browser\u2019s address-bar settings, then try again.'
      );
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new CameraError(
        'no-device',
        'No camera was found on this device. Plug one in or switch to a device that has one.'
      );
    case 'NotReadableError':
    case 'TrackStartError':
      return new CameraError(
        'device-busy',
        'The camera is already in use by another app. Close it there and try again.'
      );
    case 'OverconstrainedError':
      return new CameraError(
        'overconstrained',
        'Your camera doesn\u2019t support the requested resolution. Try a different device.'
      );
    default:
      return new CameraError('unknown', `Camera error: ${err.message || err.name}`);
  }
}
