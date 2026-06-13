'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';

type ScannerStatus = 'idle' | 'starting' | 'scanning' | 'found';

const preferredCameraConstraints: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

const fallbackCameraConstraints: MediaStreamConstraints = {
  audio: false,
  video: true,
};

function getCameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission was denied. Allow camera access in your browser settings, then try again.';
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device. Open this page on a phone or tablet with a working camera and try again.';
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is already in use by another app or browser tab.';
  }

  if (name === 'SecurityError') {
    return 'Camera access is blocked by the browser security settings. Use HTTPS or localhost.';
  }

  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'This camera does not support the requested mode. Try again and let the browser switch to another camera.';
  }

  return 'Failed to start camera scanner. Check camera permissions, HTTPS, and browser support.';
}

async function requestCameraStream() {
  try {
    return await navigator.mediaDevices.getUserMedia(preferredCameraConstraints);
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';

    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
      return navigator.mediaDevices.getUserMedia(fallbackCameraConstraints);
    }

    throw error;
  }
}

async function playVideo(video: HTMLVideoElement, stream: MediaStream) {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', 'true');
  await video.play();
}

export function QrScanner({
  onDetected,
  autoStart = true,
}: {
  onDetected: (text: string) => boolean | void | Promise<boolean | void>;
  autoStart?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const hasDetectedRef = useRef(false);
  const hasAutoStartedRef = useRef(false);

  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [error, setError] = useState<string>('');

  const stopVideoTracks = useCallback(() => {
    videoRef.current?.pause();
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stop = useCallback((nextStatus: ScannerStatus = 'idle') => {
    try {
      controlsRef.current?.stop();
      controlsRef.current = null;
    } catch {}
    stopVideoTracks();
    setStatus(nextStatus);
  }, [stopVideoTracks]);

  const start = useCallback(async () => {
    setError('');
    hasDetectedRef.current = false;

    if (!videoRef.current) {
      setError('Camera is not ready yet.');
      return;
    }

    if (!window.isSecureContext) {
      setError('Camera access requires a trusted HTTPS URL on iPhone. Use ngrok or Cloudflare Tunnel and open the HTTPS tunnel link.');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot access the camera from this page. Open Carto with HTTPS in Safari, Chrome, or Edge, then try again.');
      return;
    }

    try {
      stop('starting');
      setStatus('starting');

      const stream = await requestCameraStream();
      await playVideo(videoRef.current, stream);

      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 500,
      });

      const controls = await reader.decodeFromVideoElement(
        videoRef.current,
        (result, err, controls) => {
          if (result && !hasDetectedRef.current) {
            hasDetectedRef.current = true;
            void Promise.resolve(onDetected(result.getText()))
              .then((scanResult) => {
                const shouldStop = scanResult !== false;

                if (shouldStop) {
                  controls.stop();
                  stop('found');
                } else {
                  window.setTimeout(() => {
                    hasDetectedRef.current = false;
                  }, 1000);
                }
              })
              .catch(() => {
                window.setTimeout(() => {
                  hasDetectedRef.current = false;
                }, 1000);
              });
          }
          // ignore decode errors while scanning (camera noise)
          void err;
        }
      );

      controlsRef.current = controls;
      setStatus('scanning');
    } catch (e: any) {
      stop('idle');
      setError(getCameraErrorMessage(e));
    }
  }, [onDetected, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  useEffect(() => {
    if (!autoStart || hasAutoStartedRef.current) return;
    hasAutoStartedRef.current = true;
    void start();
  }, [autoStart, start]);

  const isScanning = status === 'starting' || status === 'scanning';

  return (
    <div className="w-full max-w-sm">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-200 shadow-soft dark:border-slate-800 dark:bg-slate-800">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          playsInline
        />

        {/* Viewfinder Overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/10">
          <div className="relative flex h-[72%] w-[72%] items-center justify-center rounded-3xl border border-white/50">
            <div className="absolute -left-1 -top-1 h-10 w-10 rounded-tl-2xl border-l-4 border-t-4 border-primary"></div>
            <div className="absolute -right-1 -top-1 h-10 w-10 rounded-tr-2xl border-r-4 border-t-4 border-primary"></div>
            <div className="absolute -bottom-1 -left-1 h-10 w-10 rounded-bl-2xl border-b-4 border-l-4 border-primary"></div>
            <div className="absolute -bottom-1 -right-1 h-10 w-10 rounded-br-2xl border-b-4 border-r-4 border-primary"></div>

            {isScanning && (
              <div className="absolute top-1/2 h-0.5 w-full -translate-y-1/2 animate-bounce bg-primary/70 shadow-[0_0_18px_rgba(114,47,55,0.75)]"></div>
            )}
          </div>
        </div>
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 px-5 text-center">
            <p className="text-sm font-semibold leading-6 text-white">{error}</p>
          </div>
        )}
        <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/90 px-4 py-3 text-center text-sm font-bold text-slate-700 shadow-sm backdrop-blur dark:bg-slate-950/80 dark:text-slate-100">
          {status === 'starting'
            ? 'Requesting camera permission...'
            : status === 'scanning'
              ? 'Align the cart QR inside the frame'
              : status === 'found'
                ? 'QR code detected. Review before connecting.'
                : 'Camera will start automatically'}
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        {!isScanning ? (
          <button
            type="button"
            onClick={start}
            className="h-12 flex-1 rounded-2xl bg-primary text-white font-bold shadow-glow transition-transform active:scale-95"
          >
            Scan QR
          </button>
        ) : (
          <button
            type="button"
            onClick={() => stop()}
            className="h-12 flex-1 rounded-2xl bg-slate-950 text-white font-bold transition-transform active:scale-95 dark:bg-slate-700"
          >
            Pause camera
          </button>
        )}
      </div>

      {error && <p className="text-red-500 text-xs text-center mt-2">{error}</p>}
    </div>
  );
}

