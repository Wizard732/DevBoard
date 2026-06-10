const API_URL = window.location.port === '3000'
  ? 'http://localhost:8000'
  : `${window.location.origin}/api`;

let chart = null;

async function updateStats() {
  try {
    const res = await fetch(`${API_URL}/tasks`);
    const tasks = await res.json();

    document.getElementById('total').textContent = tasks.length;
    document.getElementById('todo').textContent = tasks.filter(t => t.status === 'todo').length;
    document.getElementById('in_progress').textContent = tasks.filter(t => t.status === 'in_progress').length;
    document.getElementById('done').textContent = tasks.filter(t => t.status === 'done').length;
    document.getElementById('priority-low').textContent = tasks.filter(t => t.priority === 'low').length;
    document.getElementById('priority-medium').textContent = tasks.filter(t => t.priority === 'medium').length;
    document.getElementById('priority-high').textContent = tasks.filter(t => t.priority === 'high').length;

    const counts = [
      tasks.filter(t => t.status === 'todo').length,
      tasks.filter(t => t.status === 'in_progress').length,
      tasks.filter(t => t.status === 'done').length,
    ];

    if (chart) {
      chart.data.datasets[0].data = counts;
      chart.update();
    } else {
      const ctx = document.getElementById('statusChart').getContext('2d');
      chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Todo', 'In Progress', 'Done'],
          datasets: [{
            label: 'Задачи',
            data: counts,
            backgroundColor: ['#3b82f6', '#eab308', '#22c55e'],
            borderRadius: 6,
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, color: '#94a3b8' }, grid: { color: '#1e293b' } },
            x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
          }
        }
      });
    }

    document.getElementById('updated-at').textContent =
      'Обновлено: ' + new Date().toLocaleTimeString('ru');
  } catch (err) {
    console.error('Ошибка загрузки статистики:', err);
  }
}

updateStats();
setInterval(updateStats, 15000);