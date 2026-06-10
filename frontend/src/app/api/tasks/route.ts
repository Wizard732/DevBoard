const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.FASTAPI_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

async function forward(method: 'GET' | 'POST', request?: Request) {
  const init: RequestInit = {
    method,
    headers: {},
    cache: 'no-store',
  };

  if (request) {
    const sessionId = request.headers.get('x-session-id') || '';
    const contentType = request.headers.get('content-type') || 'application/json';

    if (method === 'POST') {
      init.body = await request.text();
      init.headers = {
        'Content-Type': contentType,
        'X-Session-Id': sessionId,
      };
    } else {
      init.headers = {
        'X-Session-Id': sessionId,
      };
    }
  }

  const response = await fetch(`${BACKEND_URL}/tasks`, init);
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/json',
    },
  });
}

export async function GET(request: Request) {
  return forward('GET', request);
}

export async function POST(request: Request) {
  return forward('POST', request);
}
