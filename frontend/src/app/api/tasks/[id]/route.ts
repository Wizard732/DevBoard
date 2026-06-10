const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.FASTAPI_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

async function forward(method: 'PATCH' | 'DELETE', request: Request, id: string) {
  const init: RequestInit = {
    method,
    headers: {},
    cache: 'no-store',
  };

  if (method === 'PATCH') {
    init.body = await request.text();
    init.headers = {
      'Content-Type': request.headers.get('content-type') || 'application/json',
    };
  }

  const response = await fetch(`${BACKEND_URL}/tasks/${id}`, init);
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/json',
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return forward('PATCH', request, id);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return forward('DELETE', request, id);
}
