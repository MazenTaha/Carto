// Start shopping session page - QR code display for cart linking

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QRCodeSVG } from 'qrcode.react';

export default function StartSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listId = searchParams.get('listId');
  
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [cartId, setCartId] = useState<string>('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (listId) {
      fetchQRCode();
    }
  }, [listId]);

  const fetchQRCode = async () => {
    try {
      const response = await fetch(`/api/cart/qrcode?listId=${listId}`);
      const data = await response.json();
      
      if (data.success) {
        // Use the raw QR data for the QRCodeSVG component
        setQrCodeData(data.data.qrData || JSON.stringify(data.data));
      } else {
        setError(data.error || 'Failed to generate QR code');
      }
    } catch (err) {
      setError('Failed to generate QR code');
    }
  };

  const handleManualLink = async () => {
    if (!cartId.trim()) {
      setError('Please enter a cart ID');
      return;
    }

    if (!listId) {
      setError('List ID is missing');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/cart/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId: cartId.trim(), listId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to link cart');
      }

      router.push(`/session?sessionId=${data.data.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!listId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <p className="text-gray-500">Please select a shopping list first.</p>
            <Button onClick={() => router.push('/lists')} className="mt-4">
              Go to Lists
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card title="Link Your Smart Cart">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Scan QR Code</h3>
              <p className="text-sm text-gray-600 mb-4">
                Scan this QR code with your smart cart to link it to your shopping list.
              </p>
              {qrCodeData && (
                <div className="flex justify-center p-4 bg-white rounded-lg border">
                  <QRCodeSVG value={qrCodeData} size={256} />
                </div>
              )}
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Or Enter Cart ID Manually</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cartId}
                  onChange={(e) => setCartId(e.target.value)}
                  placeholder="Enter cart ID"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  onClick={handleManualLink}
                  disabled={isLoading}
                  variant="primary"
                >
                  {isLoading ? 'Linking...' : 'Link Cart'}
                </Button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => router.back()}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}

