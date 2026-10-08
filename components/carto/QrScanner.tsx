'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { Camera, CameraOff, Pause } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
    <div className="mx-auto w-full max-w-sm">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-stone-900 shadow-raised">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          playsInline
          aria-label="Camera preview"
        />

        {!isScanning && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70" aria-hidden="true">
            <Camera className="size-10" />
          </div>
        )}

        {/* Viewfinder */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-[68%] w-[68%] overflow-hidden rounded-3xl shadow-[0_0_0_999px_rgb(28_25_23/0.45)]">
            <span className="absolute left-0 top-0 h-9 w-9 rounded-tl-3xl border-l-4 border-t-4 border-white" />
            <span className="absolute right-0 top-0 h-9 w-9 rounded-tr-3xl border-r-4 border-t-4 border-white" />
            <span className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-3xl border-b-4 border-l-4 border-white" />
            <span className="absolute bottom-0 right-0 h-9 w-9 rounded-br-3xl border-b-4 border-r-4 border-white" />
            {status === 'scanning' && (
              <span className="absolute inset-x-4 top-1/2 h-0.5 rounded-full bg-brand-300 shadow-[0_0_16px_2px_theme(colors.brand.400)] animate-scan-line" />
            )}
          </div>
        </div>

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-950/80 px-6 text-center" role="alert">
            <CameraOff className="size-8 text-white/80" aria-hidden="true" />
            <p className="text-sm font-medium leading-6 text-white">{error}</p>
          </div>
        )}

        <div
          className="absolute inset-x-3 bottom-3 rounded-xl bg-stone-950/70 px-3 py-2 text-center text-xs font-medium text-white backdrop-blur"
          aria-live="polite"
        >
          {status === 'starting'
            ? 'Requesting camera permission…'
            : status === 'scanning'
              ? 'Align the QR code inside the frame'
              : status === 'found'
                ? 'QR code detected'
                : 'Camera is paused'}
        </div>
      </div>

      <div className="mt-4">
        {!isScanning ? (
          <Button size="lg" fullWidth onClick={start}>
            <Camera aria-hidden="true" />
            {error ? 'Try camera again' : 'Start camera'}
          </Button>
        ) : (
          <Button size="lg" variant="outline" fullWidth onClick={() => stop()} loading={status === 'starting'}>
            {status !== 'starting' && <Pause aria-hidden="true" />}
            {status === 'starting' ? 'Starting camera…' : 'Pause camera'}
          </Button>
        )}
      </div>
    </div>
  );
}
