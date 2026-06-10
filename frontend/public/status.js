async function updateStats() {
  const res = await fetch('http://localhost:8000/tasks');
  const tasks = await res.json();

  const stats = document.getElementById('stats');
  stats.innerText = `Всего задач: ${tasks.length}`;

  // Здесь логика для Chart.js
  const ctx = document.getElementById('myChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Todo', 'In Progress', 'Done'],
      datasets: [{ label: 'Кол-во', data: [/* посчитай тут */] }]
    }
  });
}
setInterval(updateStats, 15000); // Раз в 15 секунд
updateStats();