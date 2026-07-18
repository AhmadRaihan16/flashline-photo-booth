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
    throw mapGetUserMediaError(err);
  }

  videoEl.srcObject = stream;

  await new Promise((resolve, reject) => {
    const onReady = () => {
      videoEl.removeEventListener('loadedmetadata', onReady);
      resolve();
    };
    videoEl.addEventListener('loadedmetadata', onReady);
    // Safety net in case the event never fires (some mobile browsers).
    setTimeout(resolve, 2000);
  });

  try {
    await videoEl.play();
  } catch {
    // Autoplay can be blocked until a user gesture; the "Enter the Booth"
    // click that triggered startCamera() already counts as one on most
    // browsers, so this rarely fires. Non-fatal either way.
  }

  return stream;
}

/** Stops every track on a stream and detaches it from the video element. */
export function stopCamera(stream, videoEl) {
  stream?.getTracks().forEach((track) => track.stop());
  if (videoEl) videoEl.srcObject = null;
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
