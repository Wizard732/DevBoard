// доска

"use client";
import { useMemo, useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';


interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
}

function getApiUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  if (window.location.port === '3000') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  return `${window.location.origin}/api`;
}

function getWsUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';
  }

  if (window.location.port === '3000') {
    return process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

const COLUMNS = [
  { status: 'todo', label: 'Todo' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'done', label: 'Done' },
];

// ── ECDH + AES-256-GCM через Web Crypto API ──────────────────────────────────

async function initSession(apiUrl: string): Promise<{ aesKey: CryptoKey; sessionId: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']  // ← было 'deriveKey', должно быть 'deriveBits'
  );

  const publicKeyDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyB64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyDer)));

  const res = await fetch(`${apiUrl}/session/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_key: publicKeyB64 }),
  });
  const data = await res.json();

  const backendKeyBytes = Uint8Array.from(atob(data.public_key), c => c.charCodeAt(0));
  const backendPublicKey = await crypto.subtle.importKey(
    'spki',
    backendKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // 1. получаем raw shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: backendPublicKey },
    keyPair.privateKey,
    256
  );

  // 2. импортируем как HKDF-ключ
  const hkdfKey = await crypto.subtle.importKey(
    'raw', sharedBits, 'HKDF', false, ['deriveKey']
  );

  // 3. выводим AES-256-GCM ключ с теми же параметрами что на бэке
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),  // salt=None в Python → пустой массив
      info: new TextEncoder().encode('devboard-session'),  // ← должно совпадать с бэком
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return { aesKey, sessionId: data.session_id };
}

async function encryptDescription(aesKey: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded
  );

  // формат: iv(12) + ciphertext → base64
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);

  return btoa(String.fromCharCode(...combined));
}

async function decryptDescription(aesKey: CryptoKey, encrypted: string): Promise<string> {
  const raw = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const ciphertext = raw.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

// ─────────────────────────────────────────────────────────────────────────────

function BackgroundScene() {
  const torusRef = useRef<THREE.Mesh | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);

  const positions = useMemo(() => {
    const count = 200;
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      data[i] = (Math.random() - 0.5) * 20;
    }
    return data;
  }, []);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0005;
    }
    if (torusRef.current) {
      torusRef.current.rotation.x += 0.003;
      torusRef.current.rotation.y += 0.001;
    }
  });

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.05} color="#6366f1" transparent opacity={0.6} />
      </points>
      <mesh ref={torusRef}>
        <torusGeometry args={[3, 0.8, 16, 60]} />
        <meshBasicMaterial color="#1e1b4b" wireframe />
      </mesh>
    </>
  );
}

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [sessionReady, setSessionReady] = useState(false);
  const sessionRef = useRef<{ aesKey: CryptoKey; sessionId: string } | null>(null);
  const apiUrlRef = useRef<string>(getApiUrl());
  const wsUrlRef = useRef<string>(getWsUrl());
  const wsRef = useRef<WebSocket | null>(null);

  const fetchTasks = async () => {
  try {
    const headers: Record<string, string> = {};

    if (sessionRef.current) {
      headers["X-Session-Id"] = sessionRef.current.sessionId;
    }

    const res = await fetch(`${apiUrlRef.current}/tasks`, {
      headers,
    });

    const data = await res.json();

    if (!sessionRef.current) {
      setTasks(data);
      return;
    }

    const decrypted = await Promise.all(
      (data as Task[]).map(async (task) => {
        if (!task.description) {
          return task;
        }

        try {
          const description = await decryptDescription(
            sessionRef.current!.aesKey,
            task.description
          );

          return {
            ...task,
            description,
          };
        } catch (error) {
          console.error(
            "Ошибка расшифровки задачи:",
            task.id,
            error
          );

          return {
            ...task,
            description: "[Ошибка расшифровки]",
          };
        }
      })
    );

    setTasks(decrypted);
  } catch (err) {
    console.error("Ошибка загрузки задач:", err);
  }
};

 // 1. Инициализация сессии + первичная загрузка задач 
 // мы берем секретный ключ session id у сервера 
useEffect(() => {
  initSession(apiUrlRef.current)
    .then((session) => {
      sessionRef.current = session;
      setSessionReady(true);
      console.log('Сессия инициализирована, session_id:', session.sessionId);
      fetchTasks();
    })
    .catch((err) => {
      console.error('Ошибка инициализации сессии:', err);
      setSessionReady(true); // продолжаем работу даже без шифрования
      fetchTasks();
    });
}, []);

// 2. Управление WebSocket-соединением
useEffect(() => {
  // Если сессия не готова, не открываем сокет
  // если ключ не подходит или его нету мы не открываем ничего
  if (!sessionReady) return;

  const ws = new WebSocket(wsUrlRef.current);
  wsRef.current = ws; // Сразу сохраняем ссылку, чтобы иметь доступ извне

  ws.onopen = () => {
    console.log('WebSocket успешно подключен');
    // Теперь сессия ТОЧНО есть в sessionRef.current
    if (sessionRef.current?.sessionId) {
      ws.send(JSON.stringify({ 
        type: 'session', 
        session_id: sessionRef.current.sessionId 
      }));
    }
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    // Внутренняя асинхронная функция для расшифровки контента
    const apply = async () => {
      // Расшифровываем описание задачи, если есть ключи
      // если у нас есть aes ключ начинаем разшифровывать описание
      if (sessionRef.current?.aesKey && data.task?.description) {
        try {
          data.task.description = await decryptDescription(sessionRef.current.aesKey, data.task.description);
        } catch (decryptErr) {
          console.error('Ошибка расшифровки задачи через сокет:', decryptErr);
        }
      }

      // Обновляем стейт задач в реальном времени
      if (data.event === 'task_created') {
        // Защита от дублирования: добавляем, только если такой задачи еще нет в стейте
        setTasks((prev) => prev.some(t => t.id === data.task.id) ? prev : [data.task, ...prev]);
      }
      if (data.event === 'task_updated') {
        setTasks((prev) => prev.map((t) => t.id === data.task.id ? data.task : t));
      }
      if (data.event === 'task_deleted') {
        setTasks((prev) => prev.filter((t) => t.id !== data.task.id));
      }
    };

    // Вызываем функцию строго ВНУТРИ тела onmessage
    void apply();
  };
    
  ws.onerror = (error) => {
    console.error('Ошибка WebSocket:', error);
  };

  // Очистка при размонтировании: закрываем сокет, чтобы не плодить утечки памяти
  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}, [sessionReady]); 


// 3. Обработчик создания задачи
const handleCreate = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!title.trim()) return;

  try {
    let encryptedDescription = description;

    // шифруем description если сессия есть
    if (sessionRef.current && description.trim()) {
      encryptedDescription = await encryptDescription(sessionRef.current.aesKey, description);
    }

    await fetch(`${apiUrlRef.current}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // передаем зашифрованный session_id чтобы бэк знал каким ключом расшифровать 
        'X-Session-Id': sessionRef.current?.sessionId ?? '',
      },
      body: JSON.stringify({ title, description: encryptedDescription, priority, status: 'todo' }), // отправляем на бэк в формате джсон
    });

    // Очищаем форму. Сама карточка прилетит автоматически через WebSocket в onmessage!
    setTitle('');
    setDescription('');
    setPriority('medium');
  } catch (err) {
    console.error('Ошибка создания задачи:', err);
  }
};

  const handleMove = async (taskId: string, nextStatus: string) => {
    // так же с методом патч
    try {
      await fetch(`${apiUrlRef.current}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },                             
        body: JSON.stringify({ status: nextStatus }), // отправляем на бэк в формате джсон
      });
    } catch (err) {
      console.error('Ошибка обновления:', err);
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await fetch(`${apiUrlRef.current}/tasks/${taskId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Ошибка удаления:', err);
    }
  };

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', padding: '24px', position: 'relative' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <Canvas camera={{ fov: 75, position: [0, 0, 8] }} gl={{ alpha: true, antialias: true }}>
          <BackgroundScene />
        </Canvas>
      </div>

      <main style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700 }}>DevBoard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '12px', color: sessionReady && sessionRef.current ? '#22c55e' : '#94a3b8' }}>
              {sessionReady && sessionRef.current ? 'Шифрование активно' : 'Без шифрования'}
            </span>
            <a href="/status" style={{ color: '#94a3b8', fontSize: '14px', textDecoration: 'none' }}>Статистика →</a>
          </div>
        </div>

        <form onSubmit={handleCreate} style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '32px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <input
            style={{ background: '#334155', border: '1px solid #475569', padding: '8px 12px', borderRadius: '8px', flex: 1, minWidth: '160px', color: 'white' }}
            placeholder="Название задачи"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            style={{ background: '#334155', border: '1px solid #475569', padding: '8px 12px', borderRadius: '8px', flex: 1, minWidth: '160px', color: 'white' }}
            placeholder="Описание (будет зашифровано)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <select
            style={{ background: '#334155', border: '1px solid #475569', padding: '8px 12px', borderRadius: '8px', color: 'white' }}
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
          >
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
          </select>
          <button type="submit" style={{ background: '#4f46e5', padding: '8px 24px', borderRadius: '8px', fontWeight: 600, border: 'none', color: 'white', cursor: 'pointer' }}>
            Создать
          </button>
        </form>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {COLUMNS.map((col) => (
            <div key={col.status} style={{ background: 'rgba(30, 41, 59, 0.85)', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
              <h3 style={{ fontWeight: 700, color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase', fontSize: '13px', letterSpacing: '0.05em' }}>
                {col.label} ({tasks.filter((t) => t.status === col.status).length})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {tasks.filter((t) => t.status === col.status).map((task) => (
                  <div key={task.id} style={{ background: '#334155', padding: '12px', borderRadius: '8px', border: '1px solid #475569' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#eab308' : '#22c55e'
                      }} />
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>{PRIORITY_LABEL[task.priority]}</span>
                    </div>

                    <h4 style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{task.title}</h4>
                    {task.description && (
                      <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>{task.description}</p>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {col.status !== 'todo' && (
                        <button onClick={() => handleMove(task.id, 'todo')}
                          style={{ fontSize: '12px', background: '#475569', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                          ← Todo
                        </button>
                      )}
                      {col.status === 'todo' && (
                        <button onClick={() => handleMove(task.id, 'in_progress')}
                          style={{ fontSize: '12px', background: '#4f46e5', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                          → Progress
                        </button>
                      )}
                      {col.status === 'in_progress' && (
                        <button onClick={() => handleMove(task.id, 'done')}
                          style={{ fontSize: '12px', background: '#16a34a', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                          ✓ Done
                        </button>
                      )}
                      <button onClick={() => handleDelete(task.id)}
                        style={{ fontSize: '12px', background: '#b91c1c', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', marginLeft: 'auto' }}>
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}

                {tasks.filter((t) => t.status === col.status).length === 0 && (
                  <p style={{ color: '#475569', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>Пусто</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
