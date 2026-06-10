const API_URL = process.env.FASTAPI_URL || "http://localhost:8000"

async function parseResponse(response) {
  const text = await response.text()

  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}: ${text}`)
  }

  return text ? JSON.parse(text) : {}
}

async function getTasks() {
  const response = await fetch(`${API_URL}/tasks`)
  return parseResponse(response)
}

async function createTask(title) {
  const url = `${API_URL}/tasks`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: title,
      description: "...",
      priority: "medium",
      status: "todo"
    })
  });

  return parseResponse(response);
}

async function markTaskDone(taskId) {
  const response = await fetch(`${API_URL}/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      status: "done"
    })
  })
  return parseResponse(response)
}

async function deleteTask(taskId) {
  const response = await fetch(`${API_URL}/tasks/${taskId}`, {
    method: "DELETE"
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Server responded with ${response.status}: ${text}`)
  }
}

export { getTasks, createTask, markTaskDone, deleteTask }
