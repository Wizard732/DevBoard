// Статистика на чистом JS: fetch + DOM API + Chart.js без React.
let chart = null;

function countBy(tasks, field, value) {
  return tasks.filter((task) => task[field] === value).length;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.innerText = String(value);
  }
}

async function updateStats() {
  try {
    const response = await fetch('/api/tasks', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const tasks = await response.json();
    const todoCount = countBy(tasks, 'status', 'todo');
    const inProgressCount = countBy(tasks, 'status', 'in_progress');
    const doneCount = countBy(tasks, 'status', 'done');
    const lowCount = countBy(tasks, 'priority', 'low');
    const mediumCount = countBy(tasks, 'priority', 'medium');
    const highCount = countBy(tasks, 'priority', 'high');

    setText('total', tasks.length);
    setText('todo', todoCount);
    setText('in_progress', inProgressCount);
    setText('done', doneCount);
    setText('priority-low', lowCount);
    setText('priority-medium', mediumCount);
    setText('priority-high', highCount);
    setText('updated-at', `Обновлено в ${new Date().toLocaleTimeString('ru-RU')}`);

    updateChart(todoCount, inProgressCount, doneCount);
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error);
    setText('updated-at', 'Ошибка загрузки. API недоступен');
  }
}

function updateChart(todo, inProgress, done) {
  const canvas = document.getElementById('statusChart');
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  if (chart) {
    chart.data.datasets[0].data = [todo, inProgress, done];
    chart.update();
    return;
  }

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Todo', 'In Progress', 'Done'],
      datasets: [
        {
          label: 'Количество задач',
          data: [todo, inProgress, done],
          backgroundColor: ['#64748b', '#3b82f6', '#22c55e'],
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8' },
          grid: { color: '#1e293b' },
        },
        y: {
          ticks: { color: '#94a3b8', stepSize: 1 },
          grid: { color: '#334155' },
          beginAtZero: true,
        },
      },
    },
  });
}

updateStats();
setInterval(updateStats, 15000);
