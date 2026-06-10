const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.FASTAPI_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

export async function GET() {
  const response = await fetch(`${BACKEND_URL}/tasks`, { cache: 'no-store' });
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/json',
    },
  });
}
